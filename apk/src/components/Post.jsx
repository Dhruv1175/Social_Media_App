import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Check, MoreHorizontal, Trash2, X } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Posts.css';

// Component used to display posts in the Home/Feed page
const Posts = ({ posts: initialPosts, user }) => {
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedPostText, setEditedPostText] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptions, setShowOptions] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const optionsRef = useRef(null);
  const navigate = useNavigate();

  const currentUserId = user?._id || localStorage.getItem('userId');

  // Helper: set auth header using token from localStorage.
  const authHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // --- Core Initialization Effect (Ensures posts array is usable and safe) ---
  useEffect(() => {
    if (initialPosts && initialPosts.length > 0) {
      const userLikedPostsCache = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
      const savedPostsMap = JSON.parse(localStorage.getItem('savedPosts') || '{}');
      
      const postsWithSyncedState = initialPosts.map(post => {
        // Ensure likesArray is always an array
        let likesArray = Array.isArray(post.likes) 
            ? post.likes 
            : []; 

        // Ensure user ID is present/absent in the likes array based on global cache
        const isLikedGlobally = userLikedPostsCache.includes(post._id);
        if (isLikedGlobally && !likesArray.includes(currentUserId)) {
          likesArray.push(currentUserId);
        } else if (!isLikedGlobally && likesArray.includes(currentUserId)) {
          likesArray = likesArray.filter(id => id !== currentUserId);
        }

        // isSaved check relies on the synced map (Home.jsx updates this map)
        const isSaved = savedPostsMap[post._id] === true;
        
        return {
          ...post,
          likes: likesArray, 
          isLiked: isLikedGlobally,
          isSaved: isSaved,
        };
      });
      
      setPosts(postsWithSyncedState);
    } else {
        setPosts([]);
    }
  }, [initialPosts, currentUserId]);


  // Helper function to check if the user liked the post
  const isPostLiked = (post) => {
    if (!post || !post.likes) return false;
    return post.likes.includes(currentUserId);
  };
  
  // --- LIKE TOGGLE (Synchronized) ---
  const toggleLike = async (e, postId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId) {
      console.error('User ID not found.');
      return;
    }

    const currentPost = posts.find(p => p._id === postId);
    const currentlyLiked = isPostLiked(currentPost);
    const newIsLiked = !currentlyLiked;

    // 1. Optimistic Update 
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post._id === postId) {
          let newLikesArray = Array.isArray(post.likes) ? [...post.likes] : [];
          
          if (currentlyLiked) {
            newLikesArray = newLikesArray.filter(id => id !== currentUserId);
          } else {
            newLikesArray.push(currentUserId);
          }
          
          return { 
            ...post, 
            likes: newLikesArray, 
            isLiked: newIsLiked
          };
        }
        return post;
      })
    );
    
    // 2. Update LocalStorage Caches (Syncs all relevant keys)
    try {
      const likedPostsCache = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
      let updatedLikedPostsCache;
      
      if (newIsLiked) {
        updatedLikedPostsCache = [...new Set([...likedPostsCache, postId])];
      } else {
        updatedLikedPostsCache = likedPostsCache.filter(id => id !== postId);
      }
      localStorage.setItem('userLikedPosts', JSON.stringify(updatedLikedPostsCache));
      
      const cachedFeedPosts = JSON.parse(localStorage.getItem('cachedFeedPosts') || '[]');
      const updatedFeedPosts = cachedFeedPosts.map(post => {
        if (post._id === postId) {
          return { ...post, isLiked: newIsLiked };
        }
        return post;
      });
      localStorage.setItem('cachedFeedPosts', JSON.stringify(updatedFeedPosts));
      
      const cachedProfilePosts = JSON.parse(localStorage.getItem('cachedPosts') || '[]');
      if (cachedProfilePosts.length > 0) {
        const updatedProfilePosts = cachedProfilePosts.map(post => {
          if (post._id === postId) {
            let updatedLikes = Array.isArray(post.likes) ? [...post.likes] : [];
            if (newIsLiked) {
                if (!updatedLikes.includes(currentUserId)) updatedLikes.push(currentUserId);
            } else {
                updatedLikes = updatedLikes.filter(id => id !== currentUserId);
            }
            return { ...post, likes: updatedLikes };
          }
          return post;
        });
        localStorage.setItem('cachedPosts', JSON.stringify(updatedProfilePosts));
      }
      
    } catch (localStorageError) {
      console.error('Error updating localStorage:', localStorageError);
    }
      
    // 3. API Call (Server update)
    try {
      const endpoint = `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/like`;
      await axios.post(endpoint, null, { headers: authHeaders() });
      console.log('Like update synced with server');
    } catch (error) {
      console.error('Warning: Like update failed on server but UI was updated:', error);
    }
  };

  // --- SAVE TOGGLE (Optimistic Update and Cache Synchronization) ---
  const toggleSave = async (e, postId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId) {
      console.error('User ID not found.');
      return;
    }
    
    const currentPost = posts.find(p => p._id === postId);
    const newIsSaved = !currentPost?.isSaved;

    // 1. Optimistic Update (Toggle isSaved flag)
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post._id === postId) {
          return { ...post, isSaved: newIsSaved };
        }
        return post;
      })
    );

    // 2. Update LocalStorage Caches (Syncs all relevant keys)
    try {
      const savedPostsMap = JSON.parse(localStorage.getItem('savedPosts') || '{}');
      savedPostsMap[postId] = newIsSaved;
      localStorage.setItem('savedPosts', JSON.stringify(savedPostsMap));

      const cachedFeedPosts = JSON.parse(localStorage.getItem('cachedFeedPosts') || '[]');
      const updatedFeedPosts = cachedFeedPosts.map(post => {
        if (post._id === postId) {
          return { ...post, isSaved: newIsSaved };
        }
        return post;
      });
      localStorage.setItem('cachedFeedPosts', JSON.stringify(updatedFeedPosts));
      
      const cachedProfilePosts = JSON.parse(localStorage.getItem('cachedPosts') || '[]');
      if (cachedProfilePosts.length > 0) {
        const updatedProfilePosts = cachedProfilePosts.map(post => {
          if (post._id === postId) {
            return { ...post, isSaved: newIsSaved };
          }
          return post;
        });
        localStorage.setItem('cachedPosts', JSON.stringify(updatedProfilePosts));
      }
      
    } catch (localStorageError) {
      console.error('Error updating localStorage:', localStorageError);
    }

    // 3. API Call (Server update)
    try {
      let response;
      let endpoint;
      
      if (newIsSaved) {
        // Use POST for saving
        endpoint = `http://localhost:30801/user/post/${currentUserId}/${postId}/save`;
        response = await axios.post(endpoint, null, { headers: authHeaders() });
      } else {
        // Use DELETE for unsaving (as per backend route definition)
        endpoint = `http://localhost:30801/user/post/${currentUserId}/${postId}/unsave`;
        response = await axios.delete(endpoint, { headers: authHeaders() });
      }
      
      console.log('Save update synced with server:', response.data);
    } catch (error) {
        console.error('Warning: Save update failed on server:', error);
        
        // --- Reversion Logic ---
        // Revert the optimistic change to reflect server state if the API fails
        setPosts(prevPosts =>
            prevPosts.map(post => {
                if (post._id === postId) {
                    return { ...post, isSaved: !newIsSaved };
                }
                return post;
            })
        );
        // Revert local storage map
        const savedPostsMap = JSON.parse(localStorage.getItem('savedPosts') || '{}');
        savedPostsMap[postId] = !newIsSaved;
        localStorage.setItem('savedPosts', JSON.stringify(savedPostsMap));
        
        // Show alert only if the error wasn't a non-critical one (like 404 on unsave)
        if (error.response?.status !== 404 || newIsSaved) {
            alert('Failed to update save status on the server. Please try again.');
        }
    }
  };


  // --- NAVIGATION (Keep all original navigation logic) ---
  const handleUserProfileClick = (userId, e) => {
    e.stopPropagation();
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  const togglePostOptions = (postId, e) => {
    if (e) {
      e.stopPropagation();
    }
    if (showOptions === postId) {
      setShowOptions(null);
    } else {
      setShowOptions(postId);
      setShowDeleteConfirm(null); // Close any open delete confirmation
    }
  };

  const getLikesDisplay = (post) => {
    const likesCount = Array.isArray(post.likes) ? post.likes.length : post.likes || 0;
    
    if (likesCount === 0) {
      return 'Be the first to like this';
    } else if (likesCount === 1) {
      return '1 like';
    } else {
      return `${likesCount} likes`;
    }
  };

  // Close any open menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setShowOptions(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // --- Placeholder for other functions (e.g., toggleEditPost, handleDeletePost) ---
  const toggleEditPost = () => {};
  const handleSavePost = () => {};
  const toggleDeleteConfirm = () => {};
  const handleDeletePost = () => {};

  // --- RENDER ---
  return (
    <div className="instagram-feed-grid">
      {posts?.length > 0 ? (
        posts.map(post => (
          <article key={post._id} className="instagram-post">
            {/* Post Header */}
            <header className="post-header">
              <div className="user-info" onClick={(e) => handleUserProfileClick(post.user?._id, e)}>
                {/* Avatar logic */}
                <div className="avatar-container">
                  <img
                    src={post.user?.avatar || user?.avatar || '/default-avatar.png'}
                    alt={post.user?.name || user?.name || 'User'}
                    className="user-avatar"
                  />
                </div>
                <div className="user-details">
                  <span className="username">{post.user?.name || user?.name || 'User'}</span>
                  {post.location && <span className="location">{post.location}</span>}
                </div>
              </div>
              
              {/* Post Options (Edit/Delete) */}
              {post.user?._id === currentUserId && ( 
                <div className="post-actions-top" ref={optionsRef}>
                  <button
                    onClick={(e) => togglePostOptions(post._id, e)}
                    className="more-options"
                    type="button"
                    aria-label="Post options"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  
                  {/* Options dropdown JSX omitted for brevity */}
                </div>
              )}
            </header>

            {/* Post Media */}
            {post.image && (
              <div className="post-media-container">
                <img src={post.image} alt="Post" className="post-image" />
              </div>
            )}
            {post.video && (
              <div className="post-media-container">
                <video src={post.video} controls className="post-video" />
              </div>
            )}

            {/* Post Actions */}
            <div className="post-actions">
              <div className="left-actions">
                <button
                  onClick={(e) => toggleLike(e, post._id)}
                  className={`action-button ${isPostLiked(post) ? 'liked' : ''}`} 
                  aria-label={isPostLiked(post) ? 'Unlike' : 'Like'}
                >
                  <Heart size={24} fill={isPostLiked(post) ? "#ed4956" : "none"} />
                </button>
                <button className="action-button" aria-label="Comment">
                  <MessageCircle size={24} />
                </button>
                <button className="action-button" aria-label="Share">
                  <Share2 size={24} />
                </button>
              </div>
              <button
                onClick={(e) => toggleSave(e, post._id)}
                className={`action-button ${post.isSaved ? 'saved' : ''}`}
                aria-label={post.isSaved ? 'Unsave' : 'Save'}
              >
                <Bookmark size={24} fill={post.isSaved ? "#262626" : "none"} />
              </button>
            </div>

            <div className="likes-count">
              {getLikesDisplay(post)}
            </div>
            
            {/* Omitted Caption/Editing/Delete Confirmation JSX */}
            
          </article>
        ))
      ) : (
        <div className="no-posts">No posts yet</div>
      )}
    </div>
  );
};

export default Posts;