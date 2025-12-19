import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Check, MoreHorizontal, Trash2, X, Send, User, Heart as HeartOutline, MoreVertical, Smile, Image as ImageIcon } from 'lucide-react';
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
  
  // Comment states
  const [showComments, setShowComments] = useState({});
  const [postComments, setPostComments] = useState({});
  const [newCommentText, setNewCommentText] = useState({});
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const [commentUsers, setCommentUsers] = useState({});
  const [activeCommentMenu, setActiveCommentMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editedCommentText, setEditedCommentText] = useState({});
  
  const optionsRef = useRef(null);
  const commentsRef = useRef({});
  const commentMenuRef = useRef(null);
  const navigate = useNavigate();

  const currentUserId = user?._id || localStorage.getItem('userId');

  // Helper: set auth header using token from localStorage.
  const authHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // --- Core Initialization Effect ---
  useEffect(() => {
    if (initialPosts && initialPosts.length > 0) {
      const userLikedPostsCache = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
      const savedPostsMap = JSON.parse(localStorage.getItem('savedPosts') || '{}');
      
      const postsWithSyncedState = initialPosts.map(post => {
        let likesArray = Array.isArray(post.likes) ? post.likes : [];
        const isLikedGlobally = userLikedPostsCache.includes(post._id);
        
        if (isLikedGlobally && !likesArray.includes(currentUserId)) {
          likesArray.push(currentUserId);
        } else if (!isLikedGlobally && likesArray.includes(currentUserId)) {
          likesArray = likesArray.filter(id => id !== currentUserId);
        }

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

  // Fetch user data for a comment
  const fetchCommentUser = async (userId) => {
    if (!userId) return null;
    
    if (commentUsers[userId]) {
      return commentUsers[userId];
    }
    
    try {
      const response = await axios.get(
        `http://localhost:30801/user/profile/${userId}`,
        { headers: authHeaders() }
      );
      
      if (response.data.success && response.data.exist) {
        const userData = {
          _id: response.data.exist._id,
          name: response.data.exist.name || 'User',
          avatar: response.data.exist.avatar || null,
          username: response.data.exist.username || response.data.exist.name || 'User'
        };
        
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

  // Toggle comments visibility
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
      
      if (response.data.success && response.data.comdata) {
        const userIds = new Set();
        response.data.comdata.forEach(comment => {
          if (comment.user) {
            userIds.add(comment.user);
          }
        });
        
        const userFetchPromises = Array.from(userIds).map(userId => {
          if (commentUsers[userId]) {
            return Promise.resolve({ userId, userData: commentUsers[userId] });
          }
          return fetchCommentUser(userId).then(userData => ({ userId, userData }));
        });
        
        const userResults = await Promise.all(userFetchPromises);
        const userMap = {};
        userResults.forEach(({ userId, userData }) => {
          if (userData) {
            userMap[userId] = userData;
          }
        });
        
        setCommentUsers(prev => ({
          ...prev,
          ...userMap
        }));
        
        const processedComments = await Promise.all(
          response.data.comdata.map(async (comment) => {
            let userData = null;
            const userId = comment.user;
            
            if (userId && userMap[userId]) {
              userData = userMap[userId];
            } else if (userId) {
              userData = await fetchCommentUser(userId);
            }
            
            return {
              ...comment,
              user: userData || { 
                _id: userId || 'unknown', 
                name: 'User', 
                username: 'user',
                avatar: null 
              },
              createdAt: comment.createdAt || comment.date || new Date().toISOString(),
              likes: comment.likes || [],
              isLiked: comment.likes?.includes(currentUserId) || false
            };
          })
        );
        
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

    const tempCommentId = `temp_${Date.now()}`;
    const optimisticComment = {
      _id: tempCommentId,
      text: commentText,
      user: {
        _id: currentUserId,
        name: user?.name || 'You',
        username: user?.username || user?.name || 'you',
        avatar: user?.avatar
      },
      createdAt: new Date().toISOString(),
      likes: [],
      isLiked: false
    };

    setPostComments(prev => ({
      ...prev,
      [postId]: [optimisticComment, ...(prev[postId] || [])]
    }));

    setNewCommentText(prev => ({ ...prev, [postId]: '' }));
    setReplyingTo(prev => ({ ...prev, [postId]: null }));

    try {
      const response = await axios.post(
        `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/comment/add`,
        { text: commentText },
        { headers: authHeaders() }
      );

      if (response.data.success) {
        await fetchComments(postId);
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(comment => comment._id !== tempCommentId)
      }));
      setNewCommentText(prev => ({ ...prev, [postId]: commentText }));
    }
  };

  // Delete a comment
  const deleteComment = async (commentId, postId) => {
    try {
      const response = await axios.delete(
        `http://localhost:30801/user/post/userpost/comment/${commentId}/delete`,
        { headers: authHeaders() }
      );

      if (response.data.success) {
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(comment => comment._id !== commentId)
        }));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Toggle comment like
  const toggleCommentLike = async (commentId, postId) => {
    try {
      const response = await axios.post(
        `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/comment/${commentId}/like`,
        null,
        { headers: authHeaders() }
      );

      if (response.data.success) {
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(comment => 
            comment._id === commentId 
              ? { 
                  ...comment, 
                  isLiked: !comment.isLiked,
                  likes: comment.isLiked 
                    ? comment.likes.filter(id => id !== currentUserId)
                    : [...comment.likes, currentUserId]
                } 
              : comment
          )
        }));
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
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
        setPostComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(comment => 
            comment._id === commentId ? { ...comment, text: newText } : comment
          )
        }));
        setEditingCommentId(null);
        setEditedCommentText(prev => ({ ...prev, [commentId]: '' }));
      }
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  // Start editing a comment
  const startEditingComment = (commentId, currentText) => {
    setEditingCommentId(commentId);
    setEditedCommentText(prev => ({ ...prev, [commentId]: currentText }));
    setActiveCommentMenu(null);
  };

  // Cancel editing a comment
  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditedCommentText(prev => ({ ...prev, [editingCommentId]: '' }));
  };

  // Format date
  const formatCommentDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
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

  // Handle comment user click
  const handleCommentUserClick = (comment, e) => {
    e.stopPropagation();
    const userId = comment.user?._id || comment.user;
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  // Toggle comment menu
  const toggleCommentMenu = (commentId, e) => {
    if (e) e.stopPropagation();
    setActiveCommentMenu(activeCommentMenu === commentId ? null : commentId);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setShowOptions(null);
      }
      if (commentMenuRef.current && !commentMenuRef.current.contains(e.target)) {
        setActiveCommentMenu(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to bottom of comments
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
    
    try {
      const endpoint = `http://localhost:30801/user/${currentUserId}/post/userpost/${postId}/like`;
      await axios.post(endpoint, null, { headers: authHeaders() });
    } catch (error) {
      console.error('Warning: Like update failed on server:', error);
    }
  };

  // --- SAVE TOGGLE ---
  const toggleSave = async (e, postId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUserId) return;
    
    const currentPost = posts.find(p => p._id === postId);
    const newIsSaved = !currentPost?.isSaved;

    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post._id === postId) {
          return { ...post, isSaved: newIsSaved };
        }
        return post;
      })
    );

    try {
      let endpoint;
      
      if (newIsSaved) {
        endpoint = `http://localhost:30801/user/post/${currentUserId}/${postId}/save`;
        await axios.post(endpoint, null, { headers: authHeaders() });
      } else {
        endpoint = `http://localhost:30801/user/post/${currentUserId}/${postId}/unsave`;
        await axios.delete(endpoint, { headers: authHeaders() });
      }
    } catch (error) {
      console.error('Save update failed:', error);
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post._id === postId) {
            return { ...post, isSaved: !newIsSaved };
          }
          return post;
        })
      );
    }
  };

  // Navigation
  const handleUserProfileClick = (userId, e) => {
    e.stopPropagation();
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  const togglePostOptions = (postId, e) => {
    if (e) e.stopPropagation();
    setShowOptions(showOptions === postId ? null : postId);
    setShowDeleteConfirm(null);
  };

  const getLikesDisplay = (post) => {
    const likesCount = Array.isArray(post.likes) ? post.likes.length : post.likes || 0;
    if (likesCount === 0) return 'Be the first to like this';
    if (likesCount === 1) return '1 like';
    return `${likesCount} likes`;
  };

  // --- RENDER ---
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

            {/* View Comments Button */}
            {!showComments[post._id] && postComments[post._id]?.length > 0 && (
              <button 
                className="view-comments-btn"
                onClick={(e) => toggleComments(post._id, e)}
              >
                View all {postComments[post._id]?.length} comments
              </button>
            )}

            {/* Modern Comments Section */}
            {showComments[post._id] && (
              <div className="modern-comments-section">
                <div className="modern-comments-header">
                  <h3>Comments ({postComments[post._id]?.length || 0})</h3>
                  <button 
                    className="modern-close-comments"
                    onClick={(e) => toggleComments(post._id, e)}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Comments List */}
                <div 
                  className="modern-comments-list"
                  ref={el => commentsRef.current[post._id] = el}
                >
                  {isLoadingComments[post._id] ? (
                    <div className="modern-loading-comments">
                      <div className="loading-spinner"></div>
                      <span>Loading comments...</span>
                    </div>
                  ) : postComments[post._id]?.length > 0 ? (
                    postComments[post._id].map(comment => {
                      const userName = comment.user?.name || 'User';
                      const userId = comment.user?._id || comment.user;
                      const userAvatar = comment.user?.avatar || null;
                      const commentDate = formatCommentDate(comment.createdAt);
                      const isCommentByCurrentUser = userId === currentUserId;
                      
                      return (
                        <div key={comment._id} className="modern-comment-item">
                          <div 
                            className="modern-comment-avatar"
                            onClick={(e) => handleCommentUserClick(comment, e)}
                          >
                            {userAvatar ? (
                              <img 
                                src={userAvatar} 
                                alt={userName}
                                className="modern-comment-user-avatar"
                              />
                            ) : (
                              <div className="modern-avatar-fallback">
                                <User size={16} />
                              </div>
                            )}
                          </div>
                          
                          <div className="modern-comment-content">
                            <div className="modern-comment-header">
                              <div className="modern-comment-user-info">
                                <span 
                                  className="modern-comment-username"
                                  onClick={(e) => handleCommentUserClick(comment, e)}
                                >
                                  {userName}
                                </span>
                                <span className="modern-comment-time">
                                  {commentDate}
                                </span>
                              </div>
                              
                              {isCommentByCurrentUser && (
                                <div className="modern-comment-menu" ref={commentMenuRef}>
                                  <button
                                    className="modern-comment-menu-btn"
                                    onClick={(e) => toggleCommentMenu(comment._id, e)}
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  
                                  {activeCommentMenu === comment._id && (
                                    <div className="modern-comment-dropdown">
                                      <button 
                                        className="modern-comment-option"
                                        onClick={() => startEditingComment(comment._id, comment.text)}
                                      >
                                        <Edit size={14} />
                                        <span>Edit</span>
                                      </button>
                                      <button 
                                        className="modern-comment-option delete"
                                        onClick={() => {
                                          if (window.confirm('Are you sure you want to delete this comment?')) {
                                            deleteComment(comment._id, post._id);
                                          }
                                          setActiveCommentMenu(null);
                                        }}
                                      >
                                        <Trash2 size={14} />
                                        <span>Delete</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Edit Comment Mode */}
                            {editingCommentId === comment._id ? (
                              <div className="edit-comment-container">
                                <textarea
                                  value={editedCommentText[comment._id] || comment.text}
                                  onChange={(e) => setEditedCommentText(prev => ({
                                    ...prev,
                                    [comment._id]: e.target.value
                                  }))}
                                  className="edit-comment-textarea"
                                  rows={2}
                                  autoFocus
                                />
                                <div className="edit-comment-actions">
                                  <button 
                                    className="edit-comment-cancel"
                                    onClick={cancelEditingComment}
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    className="edit-comment-save"
                                    onClick={() => updateComment(comment._id, post._id, editedCommentText[comment._id])}
                                    disabled={!editedCommentText[comment._id]?.trim()}
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // Normal Comment Display
                              <>
                                <p className="modern-comment-text">{comment.text}</p>
                                
                                <div className="modern-comment-actions">
                                  <button 
                                    className={`modern-comment-like ${comment.isLiked ? 'liked' : ''}`}
                                    onClick={() => toggleCommentLike(comment._id, post._id)}
                                  >
                                    {comment.isLiked ? (
                                      <Heart size={14} fill="#ed4956" />
                                    ) : (
                                      <HeartOutline size={14} />
                                    )}
                                    <span>{comment.likes?.length || 0}</span>
                                  </button>
                                  <button 
                                    className="modern-comment-reply"
                                    onClick={() => {
                                      setReplyingTo(prev => ({ ...prev, [post._id]: comment.user?.name }));
                                      setNewCommentText(prev => ({ 
                                        ...prev, 
                                        [post._id]: `@${comment.user?.name || 'user'} ` 
                                      }));
                                    }}
                                  >
                                    Reply
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="modern-no-comments">
                      <MessageCircle size={48} />
                      <p>No comments yet</p>
                      <span>Be the first to share your thoughts!</span>
                    </div>
                  )}
                </div>

                {/* Comment Input */}
                <div className="modern-comment-input-container">
                  {replyingTo[post._id] && (
                    <div className="modern-replying-to">
                      <span>Replying to @{replyingTo[post._id]}</span>
                      <button onClick={() => setReplyingTo(prev => ({ ...prev, [post._id]: null }))}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  
                  <div className="modern-comment-input-wrapper">
                    <div className="modern-comment-avatar-input">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} />
                      ) : (
                        <div className="modern-input-avatar-fallback">
                          <User size={16} />
                        </div>
                      )}
                    </div>
                    
                    <div className="modern-comment-input-group">
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
                        className="modern-comment-input"
                      />
                      <div className="modern-comment-actions-input">
                        <button className="modern-comment-emoji">
                          <Smile size={20} />
                        </button>
                        <button 
                          onClick={(e) => postComment(post._id, e)}
                          disabled={!newCommentText[post._id]?.trim()}
                          className={`modern-comment-send ${newCommentText[post._id]?.trim() ? 'active' : ''}`}
                        >
                          <Send size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </article>
        ))
      ) : (
        <div className="no-posts">
          <MessageCircle size={48} />
          <p>No posts yet</p>
          <span>Follow users to see their posts here</span>
        </div>
      )}
    </div>
  );
};

export default Posts;