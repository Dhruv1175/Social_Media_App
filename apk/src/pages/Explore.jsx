import React, { useEffect, useState, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { 
  Heart, MessageCircle, Bookmark, X, Upload, 
  Image as ImageIcon, Video as VideoIcon, Film, 
  MoreHorizontal, Trash2, Edit, Share2, 
  BookmarkCheck, Send, User, Play
} from 'lucide-react';
import '../styles/Explore.css';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import API from '../utils/api';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';
const DEFAULT_POST = '/assets/default-post.svg';
const DEFAULT_VIDEO = '/assets/default-video.svg';

const PostOptions = ({ post, onEdit, onDelete }) => {
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef(null);
  
  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Check if post is owned by logged in user
  const isOwnPost = () => {
    const userId = localStorage.getItem('userId');
    return post?.user?._id === userId || post?.userId === userId || post?.user === userId;
  };
  
  // Only show options to post creator
  if (!isOwnPost()) return null;
  
  return (
    <div className="explore-post-options-container" ref={optionsRef}>
      <button 
        className="explore-post-options-button" 
        onClick={(e) => {
          e.stopPropagation();
          setShowOptions(!showOptions);
        }}
      >
        <MoreHorizontal size={20} />
      </button>
      
      {showOptions && (
        <div className="explore-post-options-menu">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(e);
              setShowOptions(false);
            }}
          >
            <Edit size={16} /> Edit
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
              setShowOptions(false);
            }} 
            className="delete-option"
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const Explore = () => {
  const { theme } = useTheme();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'posts', 'reels'
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [editPostMode, setEditPostMode] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [postComments, setPostComments] = useState({});
  const [newCommentText, setNewCommentText] = useState({});
  const [isLoadingComments, setIsLoadingComments] = useState({});
  const [postCommentCounts, setPostCommentCounts] = useState({});
  const [commentUsers, setCommentUsers] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [newFileUpload, setNewFileUpload] = useState(null);
  const [uploadPreview, setUploadPreview] = useState('');
  const [uploadType, setUploadType] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const shareMenuRef = useRef(null);

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!userId || !token) return;
        
        const response = await API.get(
          `/user/profile/${userId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setUser(response.data.exist);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };
    
    fetchUserData();
  }, []);

  // Fetch all posts from database
  useEffect(() => {
    const fetchAllPosts = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');
        const userId = localStorage.getItem('userId');
        
        if (!token || !userId) {
          console.error('Authentication required');
          setLoading(false);
          return;
        }

        // Fetch all posts (both posts and reels)
        const response = await API.get('/user/posts/get', {
          params: {
            page: 1,
            limit: 100 // Fetch large batch to get all posts
          },
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.posts) {
          const allPosts = response.data.posts || [];
          
          // Fetch user's liked posts
          let likedPostIds = [];
          try {
            const userLikesResponse = await API.get(
              `/user/${userId}/likes`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (userLikesResponse.data && userLikesResponse.data.success) {
              likedPostIds = userLikesResponse.data.likedPosts.map(post => post._id);
              localStorage.setItem('userLikedPosts', JSON.stringify(likedPostIds));
            }
          } catch (error) {
            console.warn('Could not fetch user likes:', error);
            const cachedLikes = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
            likedPostIds = cachedLikes;
          }

          // Fetch saved posts
          let savedPostIds = [];
          try {
            const savedPostsResponse = await API.get(
              `/user/post/${userId}/saved`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (savedPostsResponse.data && savedPostsResponse.data.saved) {
              savedPostIds = savedPostsResponse.data.saved.map(post => post._id);
            }
          } catch (error) {
            console.warn('Could not fetch saved posts:', error);
          }

          // Process posts
          const processedPosts = allPosts.map(post => {
            const isLiked = likedPostIds.includes(post._id);
            const isSaved = savedPostIds.includes(post._id);
            
            return {
              ...post,
              isLiked,
              isSaved,
              likes: post.likes || [],
              likesCount: post.likes?.length || 0
            };
          });

          setPosts(processedPosts);
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllPosts();
  }, []);

  // Filter posts based on active tab
  const getFilteredPosts = useCallback(() => {
    if (!posts || posts.length === 0) return [];
    
    switch (activeTab) {
      case 'posts':
        return posts.filter(post => post.postType === 'post' || (!post.postType && !post.video));
      case 'reels':
        return posts.filter(post => post.postType === 'reel' || (!post.postType && post.video));
      default:
        return posts;
    }
  }, [posts, activeTab]);

  // Handle like functionality
  const handleLikePost = async (postId, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      const userId = user?._id || localStorage.getItem('userId');
      
      if (!token || !userId) {
        console.error('Authentication required');
        return;
      }

      // Find the post
      const post = posts.find(p => p._id === postId);
      if (!post) return;

      // Update UI optimistically
      // Update the optimistic update in handleLikePost function
const updatedPosts = posts.map(p => {
  if (p._id === postId) {
    const isLiked = p.isLiked;
    // Calculate new like count
    const currentLikesCount = p.likesCount || p.likes?.length || 0;
    const newLikeCount = isLiked ? currentLikesCount - 1 : currentLikesCount + 1;
    
    return {
      ...p,
      isLiked: !isLiked,
      likesCount: newLikeCount,
      // Also update the likes array for consistency
      likes: isLiked 
        ? (p.likes || []).filter(id => id !== userId)
        : [...(p.likes || []), userId]
    };
  }
  return p;
});

setPosts(updatedPosts);

// Update selected post if in modal
if (selectedPost && selectedPost._id === postId) {
  setSelectedPost(prev => {
    const currentLikesCount = prev.likesCount || prev.likes?.length || 0;
    const newLikeCount = prev.isLiked ? currentLikesCount - 1 : currentLikesCount + 1;
    
    return {
      ...prev,
      isLiked: !prev.isLiked,
      likesCount: newLikeCount,
      likes: prev.isLiked 
        ? (prev.likes || []).filter(id => id !== userId)
        : [...(prev.likes || []), userId]
    };
  });
}

      // Update localStorage for user's liked posts
      const likedPostsCache = JSON.parse(localStorage.getItem('userLikedPosts') || '[]');
      const newLikedPosts = post.isLiked 
        ? likedPostsCache.filter(id => id !== postId)
        : [...likedPostsCache, postId];
      localStorage.setItem('userLikedPosts', JSON.stringify(newLikedPosts));

      // Make API call
      const response = await API.post(
        `/user/${userId}/post/userpost/${postId}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        // Update with server response if needed
        if (response.data.likes !== undefined) {
          const finalPosts = updatedPosts.map(p => {
            if (p._id === postId) {
              return {
                ...p,
                likesCount: response.data.likes
              };
            }
            return p;
          });
          setPosts(finalPosts);
        }
      }
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert optimistic update on error
      const revertedPosts = posts.map(p => {
        if (p._id === postId) {
          return {
            ...p,
            isLiked: !p.isLiked,
            likesCount: p.isLiked ? (p.likesCount || 0) + 1 : (p.likesCount || 0) - 1
          };
        }
        return p;
      });
      setPosts(revertedPosts);
    }
  };

  // Handle save functionality
  const handleSavePost = async (postId, event) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      const userId = user?._id || localStorage.getItem('userId');
      
      if (!token || !userId) {
        console.error('Authentication required');
        return;
      }

      // Find the post
      const post = posts.find(p => p._id === postId);
      if (!post) return;

      // Update UI optimistically
      const updatedPosts = posts.map(p => {
        if (p._id === postId) {
          return {
            ...p,
            isSaved: !p.isSaved
          };
        }
        return p;
      });
      
      setPosts(updatedPosts);
      
      // Update selected post if in modal
      if (selectedPost && selectedPost._id === postId) {
        setSelectedPost(prev => ({
          ...prev,
          isSaved: !prev.isSaved
        }));
      }

      // Make API call
      const response = await API.post(
        `/user/post/${userId}/${postId}/save`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('Save/unsave response:', response.data);
    } catch (error) {
      console.error('Error saving post:', error);
      // Revert optimistic update on error
      const revertedPosts = posts.map(p => {
        if (p._id === postId) {
          return {
            ...p,
            isSaved: !p.isSaved
          };
        }
        return p;
      });
      setPosts(revertedPosts);
    }
  };

  // Fetch comments for a post
  const fetchComments = async (postId) => {
    if (isLoadingComments[postId]) return;
    
    setIsLoadingComments(prev => ({ ...prev, [postId]: true }));
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await API.get(
        `/user/post/userpost/${postId}/comment/get`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success && response.data.comdata) {
        const processedComments = await Promise.all(
          response.data.comdata.map(async (comment) => {
            let userData = null;
            const userId = comment.user;
            
            if (userId) {
              try {
                const userResponse = await API.get(
                  `/user/profile/${userId}`,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                userData = userResponse.data.exist;
              } catch (error) {
                console.error('Error fetching user data:', error);
              }
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
              likes: comment.likes || []
            };
          })
        );
        
        setPostComments(prev => ({
          ...prev,
          [postId]: processedComments
        }));
        
        // Update comment count
        setPostCommentCounts(prev => ({
          ...prev,
          [postId]: processedComments.length
        }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Post a comment
  const postComment = async (postId) => {
    const commentText = newCommentText[postId]?.trim();
    const userId = user?._id || localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    
    if (!commentText || !userId || !token) return;

    // Optimistic update
    const tempCommentId = `temp_${Date.now()}`;
    const optimisticComment = {
      _id: tempCommentId,
      text: commentText,
      user: {
        _id: userId,
        name: user?.name || 'You',
        avatar: user?.avatar
      },
      createdAt: new Date().toISOString()
    };

    setPostComments(prev => ({
      ...prev,
      [postId]: [optimisticComment, ...(prev[postId] || [])]
    }));

    // Update comment count optimistically
    setPostCommentCounts(prev => ({
      ...prev,
      [postId]: (prev[postId] || 0) + 1
    }));

    // Clear input
    setNewCommentText(prev => ({ ...prev, [postId]: '' }));

    try {
      const response = await API.post(
        `/user/${userId}/post/userpost/${postId}/comment/add`,
        { text: commentText },
        { headers: { Authorization: `Bearer ${token}` } }
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
      
      // Revert comment count
      setPostCommentCounts(prev => ({
        ...prev,
        [postId]: Math.max((prev[postId] || 0) - 1, 0)
      }));
      
      // Restore the text
      setNewCommentText(prev => ({ ...prev, [postId]: commentText }));
    }
  };

  // Open a post modal
  const handleOpenPost = async (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
    setEditPostMode(false);
    setEditedCaption(post.text || '');
    
    // Fetch comments for the post
    await fetchComments(post._id);
    
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';
  };

  // Close post modal
  const handleClosePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
    document.body.style.overflow = 'unset';
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format comment date
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

  // Render grid items
  const renderPostsGrid = () => {
    const filteredPosts = getFilteredPosts();
    
    if (loading) {
      return (
        <div className="explore-loading-container">
          <div className="explore-loading-spinner"></div>
          <p>Loading posts...</p>
        </div>
      );
    }

    if (filteredPosts.length === 0) {
      let message = 'No posts to explore';
      let subtitle = 'Follow more users to see their content here';
      let icon = <ImageIcon size={48} />;
      
      if (activeTab === 'posts') {
        message = 'No Posts Yet';
        subtitle = 'Share your first moment!';
      } else if (activeTab === 'reels') {
        message = 'No Reels Yet';
        subtitle = 'Create your first reel!';
        icon = <VideoIcon size={48} />;
      }
      
      return (
        <div className="explore-no-posts">
          <div className="explore-no-posts-icon">
            {icon}
          </div>
          <h3>{message}</h3>
          <p>{subtitle}</p>
        </div>
      );
    }

    return (
      <div className="explore-posts-grid">
        {filteredPosts.map((post) => (
          <div 
            key={post._id} 
            className="explore-post-grid-item"
            onClick={() => handleOpenPost(post)}
          >
            <div className="explore-post-grid-content">
              {post.video || post.postType === 'reel' ? (
                // Video/Reel post
                <div className="explore-reel-post-item">
                  <img 
                    src={post.image || post.thumbnail || DEFAULT_VIDEO} 
                    alt={post.text || 'Reel'} 
                    className="explore-grid-post-image" 
                  />
                  <div className="explore-video-indicator">
                    <Play size={20} fill="white" />
                  </div>
                </div>
              ) : post.image ? (
                // Image post
                <img 
                  src={post.image} 
                  alt={post.text || 'Post'} 
                  className="explore-grid-post-image" 
                />
              ) : (
                // Text-only post
                <div className="explore-text-post-grid">
                  <p>{post.text || 'Post'}</p>
                </div>
              )}
              
              <div className="explore-post-overlay">
                <div className="explore-post-interactions">
                  <span>
                    <Heart size={20} className="explore-interaction-icon" fill={post.isLiked ? "#ed4956" : "none"} /> 
                    {post.likesCount || 0}
                  </span>
                  <span>
                    <MessageCircle size={20} className="explore-interaction-icon" /> 
                    {postCommentCounts[post._id] || 0}
                  </span>
                </div>
                
                <div className="explore-post-grid-info">
                  <div className="explore-post-grid-date">
                    {formatDate(post.date || post.createdAt)}
                  </div>
                </div>
                
                <div className="explore-post-grid-options" onClick={(e) => e.stopPropagation()}>
                  <PostOptions 
                    post={post}
                    onEdit={(e) => {
                      e.stopPropagation();
                      setSelectedPost(post);
                      setEditPostMode(true);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      setSelectedPost(post);
                      setShowDeleteConfirm(true);
                    }}
                  />
                </div>
              </div>
            </div>
            
            <div className="explore-post-grid-actions">
              <button 
                className={`explore-action-icon-button ${post.isLiked ? 'liked' : ''}`}
                onClick={(e) => handleLikePost(post._id, e)}
              >
                <Heart size={20} fill={post.isLiked ? "#ed4956" : "none"} />
              </button>
              <button className="explore-action-icon-button">
                <Share2 size={18} />
              </button>
              <button 
                className={`explore-action-icon-button ${post.isSaved ? 'saved' : ''}`}
                onClick={(e) => handleSavePost(post._id, e)}
              >
                {post.isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`explore-page ${theme}`}>
      <Sidebar user={user} />
      
      <div className="explore-container">
        <div className="explore-section">
          <div className="explore-main">
            {/* Header */}
            <div className="explore-header">
              <h1>Explore</h1>
            </div>

            {/* Navigation Tabs */}
            <div className="explore-navigation">
              <button
                className={`explore-tab-button ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                <ImageIcon size={16} />
                <span>ALL</span>
              </button>
              <button
                className={`explore-tab-button ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                <ImageIcon size={16} />
                <span>POSTS</span>
              </button>
              <button
                className={`explore-tab-button ${activeTab === 'reels' ? 'active' : ''}`}
                onClick={() => setActiveTab('reels')}
              >
                <VideoIcon size={16} />
                <span>REELS</span>
              </button>
            </div>

            {/* Posts Grid */}
            <div className="explore-posts-container">
              {renderPostsGrid()}
            </div>
          </div>
        </div>
      </div>

      {/* Post Modal */}
      {showPostModal && selectedPost && (
        <div className="explore-modal-overlay" onClick={handleClosePostModal}>
          <div className="explore-post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="explore-post-modal-content">
              {/* Media Section */}
              <div className="explore-post-modal-image">
                {selectedPost.video || selectedPost.postType === 'reel' ? (
                  <video 
                    src={selectedPost.video} 
                    controls
                    poster={selectedPost.image || selectedPost.thumbnail}
                    className="explore-post-video"
                    autoPlay
                  />
                ) : selectedPost.image ? (
                  <img 
                    src={selectedPost.image} 
                    alt={selectedPost.text || 'Post'} 
                  />
                ) : (
                  <div className="explore-text-post-modal">
                    <p>{selectedPost.text || selectedPost.caption || 'No caption'}</p>
                  </div>
                )}
              </div>
              
              {/* Details Section */}
              <div className="explore-post-modal-details">
                {/* User Header */}
                <div className="explore-post-modal-header">
                  <Link 
                    to={`/profile/${selectedPost.user?._id}`}
                    className="explore-post-user-info"
                  >
                    <img 
                      src={selectedPost.user?.avatar || DEFAULT_AVATAR} 
                      alt="User" 
                      className="explore-post-user-avatar" 
                    />
                    <span className="explore-post-username">
                      {selectedPost.user?.name || 'User'}
                    </span>
                  </Link>
                  
                  <PostOptions 
                    post={selectedPost}
                    onEdit={() => setEditPostMode(true)}
                    onDelete={() => setShowDeleteConfirm(true)}
                  />
                </div>
                
                {/* Caption */}
                <div className="explore-post-modal-caption">
                  {editPostMode ? (
                    <div className="explore-edit-post-container">
                      <textarea
                        value={editedCaption}
                        onChange={(e) => setEditedCaption(e.target.value)}
                        placeholder="Write a caption..."
                        rows="3"
                        className="explore-edit-caption-textarea"
                      />
                      
                      <div className="explore-edit-caption-actions">
                        <button 
                          onClick={() => setEditPostMode(false)}
                          className="explore-cancel-edit-button"
                        >
                          Cancel
                        </button>
                        <button 
                          className="explore-save-edit-button"
                          onClick={() => {
                            // Handle save edit
                            setEditPostMode(false);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>{selectedPost.text || selectedPost.caption || 'No caption'}</p>
                  )}
                </div>
                
                {/* Interactions */}
                <div className="explore-post-modal-interactions">
                  <div className="explore-post-action-buttons">
                    <button 
                      className={`explore-post-action-button ${selectedPost.isLiked ? 'liked' : ''}`}
                      onClick={() => handleLikePost(selectedPost._id)}
                    >
                      <Heart size={24} fill={selectedPost.isLiked ? "#ed4956" : "none"} />
                    </button>
                    <button className="explore-post-action-button">
                      <Share2 size={22} />
                    </button>
                    <button 
                      className={`explore-post-action-button ${selectedPost.isSaved ? 'saved' : ''}`}
                      onClick={() => handleSavePost(selectedPost._id)}
                    >
                      {selectedPost.isSaved ? <BookmarkCheck size={22} /> : <Bookmark size={22} />}
                    </button>
                  </div>
                  
                  <div className="explore-post-likes">
                    <strong>{selectedPost.likesCount || 0} likes</strong>
                  </div>
                  
                  <div className="explore-post-date">
                    {formatDate(selectedPost.date || selectedPost.createdAt)}
                  </div>
                </div>
                
                {/* Comments Section */}
                <div className="explore-post-comments-section">
                  <div className="explore-post-comments-container">
                    {isLoadingComments[selectedPost._id] ? (
                      <div className="explore-loading-comments">Loading comments...</div>
                    ) : postComments[selectedPost._id] && postComments[selectedPost._id].length > 0 ? (
                      postComments[selectedPost._id].map(comment => {
                        const userName = comment.user?.name || 'User';
                        const userAvatar = comment.user?.avatar || DEFAULT_AVATAR;
                        const commentDate = formatCommentDate(comment.createdAt);
                        
                        return (
                          <div key={comment._id} className="explore-comment-item">
                            <div className="explore-comment-avatar">
                              <img 
                                src={userAvatar} 
                                alt={userName} 
                                className="explore-comment-user-avatar"
                              />
                            </div>
                            <div className="explore-comment-content">
                              <div className="explore-comment-header">
                                <span className="explore-comment-username">
                                  {userName}
                                </span>
                                {commentDate && (
                                  <span className="explore-comment-time">
                                    {commentDate}
                                  </span>
                                )}
                              </div>
                              <p className="explore-comment-text">{comment.text}</p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="explore-no-comments-yet">No comments yet.</p>
                    )}
                  </div>
                  
                  {/* Add Comment */}
                  <div className="explore-add-comment-container">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      className="explore-comment-input"
                      value={newCommentText[selectedPost._id] || ''}
                      onChange={(e) => setNewCommentText(prev => ({
                        ...prev,
                        [selectedPost._id]: e.target.value
                      }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          postComment(selectedPost._id);
                        }
                      }}
                    />
                    <button 
                      className="explore-post-comment-button"
                      onClick={() => postComment(selectedPost._id)}
                      disabled={!newCommentText[selectedPost._id]?.trim()}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="explore-close-modal-button" onClick={handleClosePostModal}>
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="explore-delete-confirmation-modal">
          <div className="explore-delete-confirmation-content">
            <h4>Delete Post?</h4>
            <p>Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="explore-delete-confirmation-actions">
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="explore-cancel-delete-button"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // Handle delete post
                  setShowDeleteConfirm(false);
                  setShowPostModal(false);
                }} 
                className="explore-confirm-delete-button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Explore;