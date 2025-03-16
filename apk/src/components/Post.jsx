import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Edit, Check, MoreHorizontal } from 'lucide-react';
import axios from 'axios';
import '../styles/Posts.css';

const Posts = ({ posts: initialPosts, user }) => {
  const [posts, setPosts] = useState([]);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editedPostText, setEditedPostText] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If posts are provided via props, initialize state; otherwise, fetch them.
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

  // Fetch posts from backend.
  const fetchPosts = async () => {
    try {
      const response = await axios.get('http://localhost:3080/api/getPosts', {
        headers: authHeaders()
      });
      if (response.data.success) {
        setPosts(response.data.posts);
      } else {
        console.error('getPosts endpoint did not return success:', response.data);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
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

    // Optimistic update: toggle like state and adjust likes count.
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post._id === postId) {
          const newIsLiked = !post.isLiked;
          const newLikes = newIsLiked ? (post.likes || 0) + 1 : (post.likes || 0) - 1;
          return { ...post, isLiked: newIsLiked, likes: newLikes };
        }
        return post;
      })
    );

    const userId = user?._id || localStorage.getItem('userId');
    if (!userId) {
      console.error('User ID not found.');
      return;
    }

    const endpoint = `http://localhost:3080/user/${userId}/post/userpost/${postId}/like`;
    try {
      const response = await axios.post(endpoint, null, { headers: authHeaders() });
      console.log('Like toggle response:', response.data);
      // Update UI with backend values.
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post._id === postId) {
            return { ...post, isLiked: response.data.isLiked, likes: response.data.likes };
          }
          return post;
        })
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      // Optionally re-fetch posts to re-sync state.
      fetchPosts();
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
