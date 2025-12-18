import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Check, MoreHorizontal, Trash2, X, Send, User } from 'lucide-react';
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
  
  // New comment states
  const [showComments, setShowComments] = useState({});
  const [postComments, setPostComments] = useState({}); // { postId: [comments] }
  const [newCommentText, setNewCommentText] = useState({}); // { postId: text }
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const [commentUsers, setCommentUsers] = useState({}); // Cache for user data
  
  const optionsRef = useRef(null);
  const commentsRef = useRef({});
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

  // --- COMMENT FUNCTIONS ---

  // Fetch user data for a comment if not already cached
  const fetchCommentUser = async (userId) => {
    if (!userId) return null;
    
    // Check cache first
    if (commentUsers[userId]) {
      return commentUsers[userId];
    }
    
    try {
      const response = await axios.get(
        `http://localhost:30801/user/profile/${userId}`,
        { headers: authHeaders() }
      );
      
      if (response.data.success && response.data.data) {
        const userData = {
          _id: response.data.data._id,
          name: response.data.data.name || 'User',
          avatar: response.data.data.avatar || null
        };
        
        // Update cache
        setCommentUsers(prev => ({
          ...prev,
          [userId]: userData
        }));
        
        return userData;
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
    return null;
  };

  // Toggle comments visibility for a post
  const toggleComments = async (postId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const newShowState = !showComments[postId];
    setShowComments(prev => ({
      ...prev,
      [postId]: newShowState
    }));

    // If showing comments and not loaded yet, fetch them
    if (newShowState && !postComments[postId]) {
      await fetchComments(postId);
    }
  };

  // Fetch comments for a specific post
  const fetchComments = async (postId) => {
    if (isLoadingComments[postId]) return;
    
    setIsLoadingComments(prev => ({ ...prev, [postId]: true }));
    
    try {
      const response = await axios.get(
        `http://localhost:30801/user/post/userpost/${postId}/comment/get`,
        { headers: authHeaders() }
      );
      
      console.log('Comments API response:', response.data);
      console.log('Comments data:', response.data.comdata);
      
      if (response.data.success && response.data.comdata) {
        // Debug each comment
        response.data.comdata.forEach((comment, index) => {
          console.log(`Comment ${index}:`, comment);
          console.log(`Comment ${index} user:`, comment.user);
        });
        
        // First, collect all unique user IDs from comments
        const userIds = new Set();
        response.data.comdata.forEach(comment => {
          if (comment.user && typeof comment.user === 'string') {
            userIds.add(comment.user);
          } else if (comment.user && comment.user._id) {
            userIds.add(comment.user._id);
          }
        });
        
        // Fetch all user data in parallel
        const userFetchPromises = Array.from(userIds).map(userId => {
          // Check cache first
          if (commentUsers[userId]) {
            return Promise.resolve({ userId, userData: commentUsers[userId] });
          }
          return fetchCommentUser(userId).then(userData => ({ userId, userData }));
        });
        
        const userResults = await Promise.all(userFetchPromises);
        
        // Create a map of user data
        const userMap = {};
        userResults.forEach(({ userId, userData }) => {
          if (userData) {
            userMap[userId] = userData;
          }
        });
        
        // Update the user cache
        setCommentUsers(prev => ({
          ...prev,
          ...userMap
        }));
        
        // Process comments with proper user data
        const processedComments = response.data.comdata.map(comment => {
          let userData = null;
          
          // Get user ID from comment
          let userId = null;
          if (typeof comment.user === 'string') {
            userId = comment.user;
          } else if (comment.user && comment.user._id) {
            userId = comment.user._id;
          }
          
          // Get user data from map
          if (userId && userMap[userId]) {
            userData = userMap[userId];
          } else if (comment.user && typeof comment.user === 'object' && comment.user.name) {
            // If user data is already embedded in the comment
            userData = comment.user;
          } else {
            // Fallback to minimal user object
            userData = { 
              _id: userId || 'unknown', 
              name: 'User', 
              avatar: null 
            };
          }
          
          return {
            ...comment,
            user: userData,
            createdAt: comment.createdAt || comment.date || new Date().toISOString()
          };
        });
        
        console.log('Processed comments:', processedComments);
        
        setPostComments(prev => ({
          ...prev,
          [postId]: processedComments
        }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Post a new comment
  const postComment = async (postId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const commentText = newCommentText[postId]?.trim();
    if (!commentText || !currentUserId) return;

    // Optimistic update
    const tempCommentId = `temp_${Date.now()}`;
    const optimisticComment = {
      _id: tempCommentId,
      text: commentText,
      user: {
        _id: currentUserId,
        name: user?.name || 'You',
        avatar: user?.avatar
      },
      createdAt: new Date().toISOString()
    };

    setPostComments(prev => ({
      ...prev,
      [postId]: [optimisticComment, ...(prev[postId] || [])]
    }));

    // Clear input
    setNewCommentText(prev => ({ ...prev, [postId]: '' }));

    try {
      const response = await axios.post(
        `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/comment/add`,
        { text: commentText },
        { headers: authHeaders() }
      );

      if (response.data.success) {
        // Refetch comments to get the actual comment with proper ID
        await fetchComments(postId);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      // Remove optimistic comment on error
      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(comment => comment._id !== tempCommentId)
      }));
      // Restore the text
      setNewCommentText(prev => ({ ...prev, [postId]: commentText }));
    }
  };

  // Delete a comment
  const deleteComment = async (commentId, postId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await axios.delete(
        `http://localhost:30801/user/post/userpost/comment/${commentId}/delete`,
        { headers: authHeaders() }
      );

      if (response.data.success) {
        // Remove comment from state
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(comment => comment._id !== commentId)
        }));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Update a comment
  const updateComment = async (commentId, postId, newText) => {
    if (!newText.trim()) return;

    try {
      const response = await axios.patch(
        `http://localhost:30801/user/post/userpost/comment/${commentId}/update`,
        { text: newText },
        { headers: authHeaders() }
      );

      if (response.data.success) {
        // Update comment in state
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(comment => 
            comment._id === commentId ? { ...comment, text: newText } : comment
          )
        }));
      }
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  // Format date safely
  const formatCommentDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      // Show relative time for recent comments
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
      return '';
    }
  };

  // Get user name safely
  const getCommentUserName = (comment) => {
    if (!comment.user) return 'User';
    
    if (typeof comment.user === 'string') {
      return 'User';
    }
    
    return comment.user.name || 'User';
  };

  // Get user ID safely
  const getCommentUserId = (comment) => {
    if (!comment.user) return null;
    
    if (typeof comment.user === 'string') {
      return comment.user;
    }
    
    return comment.user._id;
  };

  // Get user avatar safely
  const getCommentUserAvatar = (comment) => {
    if (!comment.user || typeof comment.user === 'string') {
      return null;
    }
    
    return comment.user.avatar || null;
  };

  // Handle comment user click
  const handleCommentUserClick = (comment, e) => {
    e.stopPropagation();
    const userId = getCommentUserId(comment);
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  // Scroll to bottom of comments when they open
  useEffect(() => {
    Object.keys(showComments).forEach(postId => {
      if (showComments[postId] && commentsRef.current[postId]) {
        const commentsContainer = commentsRef.current[postId];
        commentsContainer.scrollTop = commentsContainer.scrollHeight;
      }
    });
  }, [showComments, postComments]);

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
                <button 
                  onClick={(e) => toggleComments(post._id, e)}
                  className={`action-button ${showComments[post._id] ? 'active' : ''}`} 
                  aria-label="Comment"
                >
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

            {/* Post Caption */}
            {post.text && (
              <div className="post-caption">
                <span className="caption-username">{post.user?.name || 'User'}</span>
                <span className="caption-text">{post.text}</span>
              </div>
            )}

            {/* Comments Section */}
            {showComments[post._id] && (
              <div className="comments-section">
                <div className="comments-header">
                  <h4>Comments</h4>
                  <button 
                    className="close-comments-btn"
                    onClick={(e) => toggleComments(post._id, e)}
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div 
                  className="comments-list"
                  ref={el => commentsRef.current[post._id] = el}
                >
                  {isLoadingComments[post._id] ? (
                    <div className="loading-comments">Loading comments...</div>
                  ) : postComments[post._id]?.length > 0 ? (
                    postComments[post._id].map(comment => {
                      const userName = getCommentUserName(comment);
                      const userId = getCommentUserId(comment);
                      const userAvatar = getCommentUserAvatar(comment);
                      const commentDate = formatCommentDate(comment.createdAt);
                      
                      return (
                        <div key={comment._id} className="comment-item">
                          <div 
                            className="comment-avatar"
                            onClick={(e) => handleCommentUserClick(comment, e)}
                          >
                            {userAvatar ? (
                              <img 
                                src={userAvatar} 
                                alt={userName} 
                                className="comment-user-avatar"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = '<div class="avatar-fallback"><User size={16} /></div>';
                                }}
                              />
                            ) : (
                              <div className="avatar-fallback">
                                <User size={16} />
                              </div>
                            )}
                          </div>
                          <div className="comment-content">
                            <div className="comment-header">
                              <span 
                                className="comment-username"
                                onClick={(e) => handleCommentUserClick(comment, e)}
                                style={{ cursor: userId ? 'pointer' : 'default' }}
                              >
                                {userName}
                              </span>
                              {commentDate && (
                                <span className="comment-time">
                                  {commentDate}
                                </span>
                              )}
                            </div>
                            <p className="comment-text">{comment.text}</p>
                            {userId === currentUserId && (
                              <div className="comment-actions">
                                <button 
                                  className="comment-action-btn"
                                  onClick={() => {
                                    const newText = prompt('Edit your comment:', comment.text);
                                    if (newText !== null) {
                                      updateComment(comment._id, post._id, newText);
                                    }
                                  }}
                                >
                                  Edit
                                </button>
                                <button 
                                  className="comment-action-btn delete"
                                  onClick={() => deleteComment(comment._id, post._id)}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-comments">No comments yet. Be the first to comment!</div>
                  )}
                </div>

                {/* Comment Input */}
                <div className="comment-input-container">
                  <input
                    type="text"
                    placeholder="Add a comment..."
                    value={newCommentText[post._id] || ''}
                    onChange={(e) => setNewCommentText(prev => ({
                      ...prev,
                      [post._id]: e.target.value
                    }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        postComment(post._id, e);
                      }
                    }}
                    className="comment-input"
                  />
                  <button
                    onClick={(e) => postComment(post._id, e)}
                    disabled={!newCommentText[post._id]?.trim()}
                    className="comment-submit-btn"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            )}
            
            {/* Omitted Editing/Delete Confirmation JSX */}
            
          </article>
        ))
      ) : (
        <div className="no-posts">No posts yet</div>
      )}
    </div>
  );
};

export default Posts;