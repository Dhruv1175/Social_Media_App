import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Check, MoreHorizontal } from 'lucide-react';
import axios from 'axios';
import '../styles/Posts.css';

const Posts = ({ posts: initialPosts, user }) => {
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedPostText, setEditedPostText] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    }
  };

  const toggleEditPost = (postId, currentText) => {
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
      console.log('Post saved:', response.data);
    } catch (error) {
      console.error('Error saving post:', error);
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
      console.log('Like toggle response:', response.data);
      
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
      
      // Revert the optimistic update on error
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post._id === postId) {
            return { ...post, isLiked: currentIsLiked, likes: currentLikes };
          }
          return post;
        })
      );
    }
  };

  // Toggle save using a single toggle endpoint.
  const toggleSave = async (e, postId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Optimistically update save state.
    let newIsSaved;
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post._id === postId) {
          newIsSaved = !post.isSaved;
          return { ...post, isSaved: newIsSaved };
        }
        return post;
      })
    );

    const userId = user?._id || localStorage.getItem('userId');
    if (!userId) {
      console.error('User ID not found.');
      return;
    }
    
    // Use a single toggle endpoint for saving
    const endpoint = `http://localhost:3080/user/post/${userId}/${postId}/save`;
    
    try {
      const response = await axios.post(endpoint, null, { headers: authHeaders() });
      console.log('Save toggle response:', response.data);
      
      // Update UI with backend response
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post._id === postId) {
            return { ...post, isSaved: response.data.isSaved };
          }
          return post;
        })
      );
      
      // Store saved status in localStorage as a backup
      const savedPosts = JSON.parse(localStorage.getItem('savedPosts') || '{}');
      savedPosts[postId] = response.data.isSaved;
      localStorage.setItem('savedPosts', JSON.stringify(savedPosts));
      
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
              <div className="post-actions-top">
                {post.user?._id === user?._id && (
                  <button
                    onClick={() => toggleEditPost(post._id, post.text)}
                    className="edit-button"
                    disabled={isSubmitting}
                    type="button"
                  >
                    {editingPostId === post._id ? <Check size={18} /> : <Edit size={18} />}
                  </button>
                )}
                <button className="more-options" type="button">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </header>

            {/* Post Image */}
            {post.image && (
              <div className="post-image-container">
                <img
                  src={post.image}
                  alt="Post"
                  className="post-image"
                />
              </div>
            )}

            {/* Post Actions */}
            <div className="post-actions">
              <div className="left-actions">
                <button
                  onClick={(e) => toggleLike(e, post._id)}
                  className="action-button"
                  aria-label={post.isLiked ? "Unlike" : "Like"}
                  type="button"
                >
                  <Heart
                    size={24}
                    fill={post.isLiked ? "#ed4956" : "none"}
                    stroke={post.isLiked ? "#ed4956" : "currentColor"}
                  />
                </button>
                <button className="action-button" aria-label="Comment" type="button">
                  <MessageCircle size={24} />
                </button>
                <button className="action-button" aria-label="Share" type="button">
                  <Share2 size={24} />
                </button>
              </div>
              <button
                onClick={(e) => toggleSave(e, post._id)}
                className="action-button"
                aria-label={post.isSaved ? "Unsave" : "Save"}
                type="button"
              >
                <Bookmark
                  size={24}
                  fill={post.isSaved ? "#262626" : "none"}
                />
              </button>
            </div>

            {/* Likes */}
            <div className="likes-count">
              {(post.likes || 0).toLocaleString()} likes
            </div>

            {/* Caption/Text */}
            <div className="post-caption">
              {editingPostId === post._id ? (
                <textarea
                  value={editedPostText[post._id] || ''}
                  onChange={(e) => handleTextChange(post._id, e.target.value)}
                  className="caption-editor"
                  rows={2}
                  disabled={isSubmitting}
                />
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
    </div>
  );
};

export default Posts;