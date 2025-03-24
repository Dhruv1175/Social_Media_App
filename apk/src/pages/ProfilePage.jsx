import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { Settings, Grid, Bookmark, X, Upload, Heart, MessageCircle, Image, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import '../styles/ProfilePage.css';
import { useParams, Link } from 'react-router-dom';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [editPostMode, setEditPostMode] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    avatar: ''
  });
  const [avatarPreview, setAvatarPreview] = useState('');

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!userId || !token) {
          console.error('User ID or token not found');
          setLoading(false);
          return;
        }

        const authHeader = { Authorization: `Bearer ${token}` };

        // Fetch user profile
        const userResponse = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          { headers: authHeader }
        );

        // Fetch user posts
        const postsResponse = await axios.get(
          `http://localhost:3080/user/${userId}/post/userpost/get`,
          { headers: authHeader }
        );

        // Fetch saved posts
        const savedPostsResponse = await axios.get(
          `http://localhost:3080/user/post/${userId}/saved`,
          { headers: authHeader }
        );

        setUser(userResponse.data.exist);
        setPosts(postsResponse.data.data || []);
        
        // Transform saved posts - ensure we're handling the data structure correctly
        if (savedPostsResponse.data && savedPostsResponse.data.data) {
          const transformedSavedPosts = savedPostsResponse.data.data
            .filter(item => item.post) // Ensure post exists
            .map(item => ({
              ...item.post,
              isSaved: true,
              // Ensure user data is available
              user: item.post.user || userResponse.data.exist
            }));
        
        setSavedPosts(transformedSavedPosts);
        } else {
          setSavedPosts([]);
        }
        
        // Initialize form data with user data
        setFormData({
          name: userResponse.data.exist?.name || '',
          bio: userResponse.data.exist?.bio || '',
          avatar: userResponse.data.exist?.avatar || ''
        });
        setAvatarPreview(userResponse.data.exist?.avatar || '');
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const handleOpenEditModal = () => {
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
        setFormData({
          ...formData,
          avatar: file
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('accessToken');

      // Create form data for multipart/form-data
      const updateData = new FormData();
      updateData.append('name', formData.name);
      updateData.append('bio', formData.bio);
      if (formData.avatar && formData.avatar instanceof File) {
        updateData.append('avatar', formData.avatar);
      }

      // Update profile - using PATCH method as per your API endpoint
      const response = await axios({
        method: 'patch',
        url: `http://localhost:3080/user/update/${userId}`,
        data: updateData,
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // Check if response is successful
      if (response.data && response.status === 200) {
        // Update local user state
        setUser({
          ...user,
          name: formData.name,
          bio: formData.bio,
          avatar: avatarPreview
        });

        // Close modal
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  // Open a specific post
  const handleOpenPost = (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
    setEditPostMode(false);
    setEditedCaption(post.caption || '');
    setShowPostOptions(false);
    setShowDeleteConfirm(false);
  };

  // Close post modal
  const handleClosePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
  };

  // Toggle post options menu
  const togglePostOptions = () => {
    setShowPostOptions(!showPostOptions);
  };

  // Toggle edit post mode
  const toggleEditMode = () => {
    setEditPostMode(!editPostMode);
    setShowPostOptions(false);
  };

  // Handle caption change
  const handleCaptionChange = (e) => {
    setEditedCaption(e.target.value);
  };

  // Save edited post
  const handleSavePost = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await axios.patch(
        `http://localhost:3080/user/post/${selectedPost._id}/update`,
        { caption: editedCaption },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data && response.status === 200) {
        // Update the post in local state
        const updatedPost = { ...selectedPost, caption: editedCaption };
        setSelectedPost(updatedPost);
        
        // Update in posts array
        const postArray = activeTab === 'posts' ? posts : savedPosts;
        const updatedPosts = postArray.map(post => 
          post._id === selectedPost._id ? updatedPost : post
        );
        
        if (activeTab === 'posts') {
          setPosts(updatedPosts);
        } else {
          setSavedPosts(updatedPosts);
        }
        
        setEditPostMode(false);
      }
    } catch (error) {
      console.error('Error updating post:', error);
    }
  };

  // Toggle delete confirmation
  const toggleDeleteConfirm = () => {
    setShowDeleteConfirm(!showDeleteConfirm);
    setShowPostOptions(false);
  };

  // Delete post
  const handleDeletePost = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await axios.delete(
        `http://localhost:3080/user/post/${selectedPost._id}/delete`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data && response.status === 200) {
        // Remove post from local state
        const updatedPosts = posts.filter(post => post._id !== selectedPost._id);
        setPosts(updatedPosts);
        
        // Close modal
        setShowPostModal(false);
        setSelectedPost(null);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  };

  // Check if post is owned by logged in user
  const isOwnPost = (post) => {
    const userId = localStorage.getItem('userId');
    return post?.user?._id === userId || post?.userId === userId;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Render post grid items
  const renderPostsGrid = (postsToDisplay) => {
    if (!postsToDisplay || postsToDisplay.length === 0) {
      return (
        <div className="no-posts">
          <div className="no-posts-icon">
            <Image size={48} />
          </div>
          <h3>{activeTab === 'posts' ? 'No Posts Yet' : 'No Saved Posts'}</h3>
          <p>{activeTab === 'posts' ? 'Share your first moment!' : 'Save posts to see them here'}</p>
        </div>
      );
    }

    return (
      <div className="posts-grid">
        {postsToDisplay.map((post) => (
          <div 
            key={post._id} 
            className="post-grid-item"
            onClick={() => handleOpenPost(post)}
          >
            <img 
              src={post.image} 
              alt={post.caption || 'Post'} 
              className="grid-post-image" 
            />
            <div className="post-overlay">
              <div className="post-interactions">
                <span>
                  <Heart size={20} className="interaction-icon" /> 
                  {post.likes?.length || 0}
                </span>
                <span>
                  <MessageCircle size={20} className="interaction-icon" /> 
                  {post.comments?.length || 0}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Sidebar user={user} />
      
      <div className="profile-content">
        <div className="profile-section">
      <div className="profile-main">
        <div className="profile-header">
          <div className="profile-pic-container">
            <img
              src={user?.avatar || 'https://via.placeholder.com/150'}
              alt="Profile"
              className="profile-pic"
            />
          </div>
          <div className="profile-info">
            <div className="profile-top">
              <h2>{user?.name || 'Username'}</h2>
              <div className="action-buttons">
                <button className="primary-button" onClick={handleOpenEditModal}>Edit Profile</button>
                <button className="icon-button">
                  <Settings className="settings-icon" />
                </button>
              </div>
            </div>
            <div className="stats">
              <span><strong>{posts?.length}</strong> posts</span>
              <span><strong>{user?.followers?.length}</strong> followers</span>
              <span><strong>{user?.following?.length}</strong> following</span>
            </div>
            <div className="bio">
              <p>{user?.bio || 'Bio description here'}</p>
            </div>
          </div>
        </div>
        <div className="post-navigation">
          <button
            className={`tab-button ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            <Grid />
            POSTS
          </button>
          <button
            className={`tab-button ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
          >
            <Bookmark />
            SAVED
          </button>
        </div>
                
            <div className="posts-container">
              {activeTab === 'posts' && renderPostsGrid(posts)}
              {activeTab === 'saved' && renderPostsGrid(savedPosts)}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="edit-profile-modal">
            <div className="modal-header">
              <h4>Edit Profile</h4>
              <button className="close-button" onClick={handleCloseEditModal}>
                <X />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="avatar-upload">
                <div className="preview-container">
                  <img 
                    src={avatarPreview || 'https://via.placeholder.com/150'} 
                    alt="Avatar Preview" 
                    className="avatar-preview"
                  />
                </div>
                <label className="upload-button">
                  <Upload size={16} />
                  Change Profile Photo
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleAvatarChange} 
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="name">Username</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  rows="4"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={handleCloseEditModal}>
                  Cancel
                </button>
                <button type="submit" className="save-button">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Post Modal */}
      {showPostModal && selectedPost && (
        <div className="modal-overlay" onClick={handleClosePostModal}>
          <div className="post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="post-modal-content">
              <div className="post-modal-image">
                <img 
                  src={selectedPost.image} 
                  alt={selectedPost.caption || 'Post'} 
                />
              </div>
              <div className="post-modal-details">
                <div className="post-modal-header">
                  <div className="post-user-info">
                    <img 
                      src={selectedPost.user?.avatar || user?.avatar || 'https://via.placeholder.com/40'} 
                      alt="User" 
                      className="post-user-avatar" 
                    />
                    <span className="post-username">{selectedPost.user?.name || user?.name || 'User'}</span>
                  </div>
                  
                  {isOwnPost(selectedPost) && (
                    <div className="post-options-container">
                      <button className="post-options-button" onClick={togglePostOptions}>
                        <MoreHorizontal size={20} />
                      </button>
                      
                      {showPostOptions && (
                        <div className="post-options-menu">
                          <button onClick={toggleEditMode}>
                            <Edit size={16} /> Edit
                          </button>
                          <button onClick={toggleDeleteConfirm} className="delete-option">
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="post-modal-caption">
                  {editPostMode ? (
                    <div className="edit-caption-container">
                      <textarea
                        value={editedCaption}
                        onChange={handleCaptionChange}
                        placeholder="Write a caption..."
                        rows="3"
                      />
                      <div className="edit-caption-actions">
                        <button onClick={() => setEditPostMode(false)}>Cancel</button>
                        <button onClick={handleSavePost}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <p>{selectedPost.caption}</p>
                  )}
                </div>
                
                <div className="post-modal-interactions">
                  <div className="post-action-buttons">
                    <button className="post-action-button">
                      <Heart size={24} />
                    </button>
                    <button className="post-action-button">
                      <MessageCircle size={24} />
                    </button>
                  </div>
                  <div className="post-likes">
                    <strong>{selectedPost.likes?.length || 0} likes</strong>
                  </div>
                  <div className="post-date">
                    {formatDate(selectedPost.createdAt)}
                  </div>
                </div>
                
                <div className="post-comments-section">
                  <div className="post-comments-container">
                    {/* Comment section would go here */}
                    <p className="no-comments-yet">No comments yet.</p>
                  </div>
                  <div className="add-comment-container">
                    <input
                      type="text"
                      placeholder="Add a comment..."
                      className="comment-input"
                    />
                    <button className="post-comment-button">Post</button>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="close-modal-button" onClick={handleClosePostModal}>
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="delete-confirmation-modal">
          <div className="delete-confirmation-content">
            <h4>Delete Post?</h4>
            <p>Are you sure you want to delete this post? This action cannot be undone.</p>
            <div className="delete-confirmation-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-delete-button">
                Cancel
              </button>
              <button onClick={handleDeletePost} className="confirm-delete-button">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;