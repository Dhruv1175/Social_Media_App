import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Check, MoreHorizontal, Trash2, X } from 'lucide-react';
import axios from 'axios';
import '../styles/Posts.css';

const Posts = ({ posts: initialPosts, user }) => {
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedPostText, setEditedPostText] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptions, setShowOptions] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const optionsRef = useRef(null);

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
        axios.get('http://localhost:3080/api/getPosts', {
          headers: authHeaders()
        }),
        axios.get(`http://localhost:3080/user/${userId}/likes`, {
          headers: authHeaders()
        })
      ]);
      
      if (postsResponse.data.success) {
        let postsData = postsResponse.data.posts;
        
        if (likesResponse?.data?.success) {
          const likedPostIds = new Set(likesResponse.data.likedPosts.map(post => post._id));
          
          // Fetch the latest like counts for all posts
          const likesCountsResponse = await axios.get('http://localhost:3080/api/posts/likeCounts', {
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
        `http://localhost:3080/api/post/${postId}`,
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
        `http://localhost:3080/api/post/${postId}`,
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

    // Optimistic update: toggle like state and adjust likes count.
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post._id === postId) {
          const newIsLiked = !post.isLiked;
          const newLikes = newIsLiked ? (post.likes || 0) + 1 : Math.max((post.likes || 0) - 1, 0);
          return { ...post, isLiked: newIsLiked, likes: newLikes };
        }
        return post;
      })
    );

    const endpoint = `http://localhost:3080/user/${userId}/post/userpost/${postId}/like`;
    try {
      const response = await axios.post(endpoint, null, { headers: authHeaders() });
      
      // Update UI with backend values.
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post._id === postId) {
            return { 
              ...post, 
              isLiked: response.data.isLiked, 
              likes: response.data.likes 
            };
          }
          return post;
        })
      );
      
      // Store both like status AND count in localStorage
      const likedPosts = JSON.parse(localStorage.getItem('likedPosts') || '{}');
      likedPosts[postId] = response.data.isLiked;
      localStorage.setItem('likedPosts', JSON.stringify(likedPosts));
      
      const likeCounts = JSON.parse(localStorage.getItem('postLikeCounts') || '{}');
      likeCounts[postId] = response.data.likes;
      localStorage.setItem('postLikeCounts', JSON.stringify(likeCounts));
      
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert optimistic update on error.
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId ? { 
            ...post, 
            isLiked: currentIsLiked, 
            likes: currentLikes 
          } : post
        )
      );
    }
  };

  // Toggle save status
  const toggleSave = async (e, postId) => {
    e.preventDefault();
    e.stopPropagation();

    // Get current state
    const currentPost = posts.find(post => post._id === postId);
    const currentIsSaved = currentPost?.isSaved || false;
    const newIsSaved = !currentIsSaved;

    // Optimistic update
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post._id === postId ? { ...post, isSaved: newIsSaved } : post
      )
    );

    try {
      // Update in localStorage
      const savedPosts = JSON.parse(localStorage.getItem('savedPosts') || '{}');
      savedPosts[postId] = newIsSaved;
      localStorage.setItem('savedPosts', JSON.stringify(savedPosts));
      
      // If we had a backend endpoint for saving posts, we'd call it here
      // Example:
      // const response = await axios.post(
      //  `http://localhost:3080/user/post/${postId}/save`,
      //  { saved: newIsSaved },
      //  { headers: authHeaders() }
      // );
      
    } catch (error) {
      console.error('Error toggling save:', error);
      // Revert optimistic update on error.
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId ? { ...post, isSaved: !newIsSaved } : post
        )
      );
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
          prevPosts.map(post => ({
            ...post,
            isLiked: post.isLiked || Boolean(likedPosts[post._id]),
            likes: post.likes || likeCounts[post._id] || 0,
            isSaved: post.isSaved || Boolean(savedPosts[post._id])
          }))
        );
      } catch (error) {
        console.error('Error initializing from localStorage:', error);
      }
    }
  }, [posts.length]);

  return (
    <div className="instagram-feed-grid">
      {posts?.length > 0 ? (
        posts.map(post => (
          <article key={post._id} className="instagram-post">
            {/* Post Header */}
            <header className="post-header">
              <div className="user-info">
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
              {post.likes > 0 ? `${post.likes} ${post.likes === 1 ? 'like' : 'likes'}` : 'Be the first to like this'}
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
                  <span className="username">{post.user?.name || user?.name || 'User'}</span>
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
              {new Date(post.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
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