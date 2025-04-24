import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Check, MoreHorizontal, Trash2, X } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/Posts.css';

const Posts = ({ posts: initialPosts, user }) => {
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedPostText, setEditedPostText] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptions, setShowOptions] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const optionsRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialPosts && initialPosts.length > 0) {
      const postsWithStatus = initialPosts.map(post => ({
        ...post,
        isLiked: Boolean(post.isLiked),
        isSaved: Boolean(post.isSaved)
      }));
      setPosts(postsWithStatus);
    } else {
      fetchPosts();
    }
  }, [initialPosts]);

  // Helper: set auth header using token from localStorage.
  const authHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Fetch posts from backend with complete like information
  const fetchPosts = async () => {
    try {
      setIsSubmitting(true);
      const userId = user?._id || localStorage.getItem('userId');
      if (!userId) {
        console.error('User ID not found.');
        return;
      }

      // Fetch both posts and like info in parallel
      const [postsResponse, likesResponse] = await Promise.all([
        axios.get('http://localhost:30801/api/getPosts', {
          headers: authHeaders()
        }),
        axios.get(`http://localhost:30801/user/${userId}/likes`, {
          headers: authHeaders()
        })
      ]);
      
      if (postsResponse.data.success) {
        let postsData = postsResponse.data.posts;
        
        if (likesResponse?.data?.success) {
          const likedPostIds = new Set(likesResponse.data.likedPosts.map(post => post._id));
          
          // Fetch the latest like counts for all posts
          const likesCountsResponse = await axios.get('http://localhost:30801/api/posts/likeCounts', {
            headers: authHeaders()
          });
          
          if (likesCountsResponse?.data?.success) {
            const likeCounts = likesCountsResponse.data.likeCounts || {};
            
            // Update posts with correct like status and counts
            postsData = postsData.map(post => ({
              ...post,
              isLiked: likedPostIds.has(post._id),
              likes: likeCounts[post._id] || post.likes || 0,
              isSaved: Boolean(post.isSaved)
            }));
          } else {
            // If we can't get like counts, still update like status
            postsData = postsData.map(post => ({
              ...post,
              isLiked: likedPostIds.has(post._id),
              isSaved: Boolean(post.isSaved)
            }));
          }
        }
        
        setPosts(postsData);
        
        // Store the like counts in localStorage for backup
        const likeCounts = {};
        postsData.forEach(post => {
          likeCounts[post._id] = post.likes || 0;
        });
        localStorage.setItem('postLikeCounts', JSON.stringify(likeCounts));
        
      } else {
        console.error('getPosts endpoint did not return success:', postsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      
      // If API fails, try to load from localStorage
      try {
        const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '{}');
        const likeCounts = JSON.parse(localStorage.getItem('postLikeCounts') || '{}');
        const savedPosts = JSON.parse(localStorage.getItem('savedPosts') || '{}');
        
        if (posts.length > 0) {
          setPosts(prevPosts =>
            prevPosts.map(post => ({
              ...post,
              isLiked: Boolean(likedPosts[post._id]),
              likes: likeCounts[post._id] || post.likes || 0,
              isSaved: Boolean(savedPosts[post._id])
            }))
          );
        }
      } catch (localStorageError) {
        console.error('Error loading from localStorage:', localStorageError);
      }
    } finally {
      setIsSubmitting(false);
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

  const toggleEditPost = (postId, currentText, e) => {
    if (e) {
      e.stopPropagation();
    }
    setShowOptions(null); // Close options menu
    
    if (editingPostId === postId) {
      handleSavePost(postId);
    } else {
      setEditingPostId(postId);
      setEditedPostText(prev => ({ ...prev, [postId]: currentText }));
    }
  };

  const handleTextChange = (postId, text) => {
    setEditedPostText(prev => ({ ...prev, [postId]: text }));
  };

  // Update post text via PATCH.
  const handleSavePost = async (postId) => {
    try {
      setIsSubmitting(true);
      const response = await axios.patch(
        `http://localhost:30801/api/post/${postId}`,
        { text: editedPostText[postId] },
        { headers: authHeaders() }
      );
      if (response.status === 200) {
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post._id === postId ? { ...post, text: editedPostText[postId] } : post
          )
        );
        setEditingPostId(null);
      }
    } catch (error) {
      console.error('Error saving post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle delete confirmation dialog
  const toggleDeleteConfirm = (postId, e) => {
    if (e) {
      e.stopPropagation();
    }
    setShowOptions(null); // Close options menu
    setShowDeleteConfirm(showDeleteConfirm === postId ? null : postId);
  };

  // Delete post
  const handleDeletePost = async (postId) => {
    try {
      setIsSubmitting(true);
      const response = await axios.delete(
        `http://localhost:30801/api/post/${postId}`,
        { headers: authHeaders() }
      );
      
      if (response.status === 200) {
        // Remove the post from state
        setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle like via the provided endpoint.
  const toggleLike = async (e, postId) => {
    e.preventDefault();
    e.stopPropagation();

    const userId = user?._id || localStorage.getItem('userId');
    if (!userId) {
      console.error('User ID not found.');
      return;
    }

    // Get current state before updating
    const currentPost = posts.find(post => post._id === postId);
    const currentIsLiked = currentPost?.isLiked || false;
    const currentLikes = currentPost?.likes || 0;
    const newIsLiked = !currentIsLiked;

    // Optimistic update: toggle like state and adjust likes count.
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post._id === postId) {
          const newLikes = newIsLiked ? (post.likes || 0) + 1 : Math.max((post.likes || 0) - 1, 0);
          return { ...post, isLiked: newIsLiked, likes: newLikes };
        }
        return post;
      })
    );

    // Update localStorage immediately - we'll keep the optimistic update even if API fails
    try {
      const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '{}');
      likedPosts[postId] = newIsLiked;
      localStorage.setItem('likedPosts', JSON.stringify(likedPosts));
      
      const likeCounts = JSON.parse(localStorage.getItem('postLikeCounts') || '{}');
      likeCounts[postId] = newIsLiked ? currentLikes + 1 : Math.max(currentLikes - 1, 0);
      localStorage.setItem('postLikeCounts', JSON.stringify(likeCounts));
    } catch (localStorageError) {
      console.error('Error updating localStorage:', localStorageError);
    }
      
    // Try API update but don't revert UI on failure
    try {
      const endpoint = `http://localhost:30801/user/${userId}/post/userpost/${postId}/like`;
      await axios.post(endpoint, null, { headers: authHeaders() });
      console.log('Like update synced with server');
    } catch (error) {
      console.error('Warning: Like update failed on server but UI was updated:', error);
    }
  };

  // Navigate to user profile when username is clicked
  const handleUserProfileClick = (userId, e) => {
    e.stopPropagation();
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  // Toggle save for a post
  const toggleSave = async (e, postId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const userId = user?._id || localStorage.getItem('userId');
    if (!userId) {
      console.error('User ID not found.');
      return;
    }

    // Get current state before updating
    const currentPost = posts.find(post => post._id === postId);
    const currentIsSaved = currentPost?.isSaved || false;
    const newIsSaved = !currentIsSaved;

    // Optimistic update
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post._id === postId) {
          return { ...post, isSaved: newIsSaved };
        }
        return post;
      })
    );

    // Update localStorage immediately - we'll keep the optimistic update even if API fails
    try {
      const savedPosts = JSON.parse(localStorage.getItem('savedPosts') || '{}');
      savedPosts[postId] = newIsSaved;
      localStorage.setItem('savedPosts', JSON.stringify(savedPosts));
    } catch (localStorageError) {
      console.error('Error updating localStorage:', localStorageError);
    }

    // Try API update but don't revert UI on failure
    try {
      const endpoint = `http://localhost:30801/user/post/${userId}/${postId}/save`;
      await axios.post(endpoint, null, { headers: authHeaders() });
      
      // After successful save, update the cachedFeedPosts to reflect this change
      const cachedFeedPosts = JSON.parse(localStorage.getItem('cachedFeedPosts') || '[]');
      const updatedFeedPosts = cachedFeedPosts.map(post => {
        if (post._id === postId) {
          return { ...post, isSaved: newIsSaved };
        }
        return post;
      });
      localStorage.setItem('cachedFeedPosts', JSON.stringify(updatedFeedPosts));
      
      // Also update any cached user profile posts if they exist
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
      
      console.log('Save update synced with server');
    } catch (error) {
      console.error('Warning: Save update failed on server but UI was updated:', error);
    }
  };

  // Close any open menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setShowOptions(null);
      }
      
      // Don't close delete confirmation on outside click since it has its own overlay
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize posts with localStorage backup data when component mounts
  useEffect(() => {
    // Only use localStorage if we have posts but need to restore state
    if (posts.length > 0) {
      try {
        const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '{}');
        const likeCounts = JSON.parse(localStorage.getItem('postLikeCounts') || '{}');
        const savedPosts = JSON.parse(localStorage.getItem('savedPosts') || '{}');
        
        setPosts(prevPosts =>
          prevPosts.map(post => {
            // Get the latest state, prioritizing explicit settings from saved/liked state
            const isLiked = likedPosts[post._id] !== undefined ? likedPosts[post._id] : post.isLiked;
            const isSaved = savedPosts[post._id] !== undefined ? savedPosts[post._id] : post.isSaved;
            
            // Get like count, preferring explicitly stored counts
            const likeCount = likeCounts[post._id] !== undefined ? likeCounts[post._id] : post.likes || 0;
            
            return {
            ...post,
              isLiked,
              isSaved,
              likes: likeCount
            };
          })
        );
      } catch (error) {
        console.error('Error initializing from localStorage:', error);
      }
    }
  }, [posts.length]);

  const getLikesDisplay = (post) => {
    let likesCount = 0;
    
    if (Array.isArray(post.likes)) {
      likesCount = post.likes.length;
    } else if (typeof post.likes === 'number') {
      likesCount = post.likes;
    }
    
    if (likesCount === 0) {
      return 'Be the first to like this';
    } else if (likesCount === 1) {
      return '1 like';
    } else {
      return `${likesCount} likes`;
    }
  };

  return (
    <div className="instagram-feed-grid">
      {posts?.length > 0 ? (
        posts.map(post => (
          <article key={post._id} className="instagram-post">
            {/* Post Header */}
            <header className="post-header">
              <div className="user-info" onClick={(e) => handleUserProfileClick(post.user?._id, e)}>
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
                {post.user?._id === user?._id && (
                <div className="post-actions-top" ref={optionsRef}>
                  <button
                    onClick={(e) => togglePostOptions(post._id, e)}
                    className="more-options"
                    type="button"
                    aria-label="Post options"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  
                  {/* Options dropdown */}
                  {showOptions === post._id && (
                    <div className="post-options-dropdown" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={(e) => toggleEditPost(post._id, post.text, e)}
                        className="option-button"
                        disabled={isSubmitting}
                      >
                        <Edit size={16} />
                        <span>Edit</span>
                      </button>
                      <button 
                        onClick={(e) => toggleDeleteConfirm(post._id, e)}
                        className="option-button delete-option"
                        disabled={isSubmitting}
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                </button>
              </div>
                  )}
                </div>
              )}
            </header>

            {/* Post Media - Support both image and video */}
            {post.image && (
              <div className="post-media-container">
                <img
                  src={post.image}
                  alt="Post"
                  className="post-image"
                />
              </div>
            )}
            
            {post.video && (
              <div className="post-media-container">
                <video 
                  src={post.video}
                  controls
                  className="post-video"
                />
              </div>
            )}

            {/* Post Actions */}
            <div className="post-actions">
              <div className="left-actions">
                <button
                  onClick={(e) => toggleLike(e, post._id)}
                  className={`action-button ${post.isLiked ? 'liked' : ''}`}
                  aria-label={post.isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart size={24} fill={post.isLiked ? "#ed4956" : "none"} />
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

            <div className="post-caption">
              {editingPostId === post._id ? (
                <div className="caption-edit-container">
                <textarea
                  value={editedPostText[post._id] || ''}
                  onChange={(e) => handleTextChange(post._id, e.target.value)}
                  className="caption-editor"
                    rows={3}
                  disabled={isSubmitting}
                    placeholder="Edit your caption..."
                  />
                  <div className="caption-edit-actions">
                    <button 
                      onClick={() => setEditingPostId(null)} 
                      className="cancel-edit-button"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleSavePost(post._id)} 
                      className="save-edit-button"
                      disabled={isSubmitting || !editedPostText[post._id]?.trim()}
                    >
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="caption-text">
                  <span 
                    className="username" 
                    onClick={(e) => handleUserProfileClick(post.user?._id, e)}
                  >
                    {post.user?.name || user?.name || 'User'}
                  </span>
                  <span className="caption-content">{post.text || ''}</span>
                </div>
              )}
            </div>

            {/* View comments */}
            {post.comments?.length > 0 && (
              <div className="view-comments">
                <button className="comments-button" type="button">
                  View all {post.comments.length} comments
                </button>
              </div>
            )}

            {/* Date */}
            <div className="post-date">
              {new Date(post.date || post.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
            </div>
          </article>
        ))
      ) : (
        <div className="no-posts">No posts yet</div>
      )}
      
      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <>
          <div className="overlay" onClick={() => setShowDeleteConfirm(null)}></div>
          <div className="delete-confirm-dialog">
            <h4>Delete Post?</h4>
            <p>Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="delete-confirm-actions">
              <button 
                onClick={() => handleDeletePost(showDeleteConfirm)}
                className="delete-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="cancel-button"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Posts;