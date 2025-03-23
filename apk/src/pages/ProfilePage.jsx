import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Posts from '../components/Post';
import axios from 'axios';
import { Settings, Grid, Bookmark, X, Upload } from 'lucide-react';
import '../styles/ProfilePage.css';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [showEditModal, setShowEditModal] = useState(false);
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

        console.log('Saved posts response:', savedPostsResponse.data);

        setUser(userResponse.data.exist);
        setPosts(postsResponse.data.data);
        
        // Transform saved posts to match the format expected by the Posts component
        const transformedSavedPosts = savedPostsResponse.data.data
          .filter(item => item.post) // Ensure post exists
          .map(item => {
            // Add isSaved flag to each saved post
            const postData = {
              ...item.post,
              isSaved: true
            };
            
            // If the post has a user reference but not populated, use current user
            if (!postData.user || typeof postData.user === 'string') {
              postData.user = userResponse.data.exist;
            }
            
            return postData;
          });
        
        console.log('Transformed saved posts:', transformedSavedPosts);
        setSavedPosts(transformedSavedPosts);
        
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
        console.log('Profile updated successfully:', response.data);
        
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
      // You might want to show an error message to the user here
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Sidebar user={user} />
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
        {activeTab === 'posts' && <Posts posts={posts} user={user} isSavedPosts={false} />}
        {activeTab === 'saved' && <Posts posts={savedPosts} user={user} isSavedPosts={true} />}
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
    </div>
  );
};

export default ProfilePage;