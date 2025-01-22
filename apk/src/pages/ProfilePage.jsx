import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { Settings, Grid, Bookmark, Heart, MessageCircle, Share2 } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import '../styles/ProfilePage.css';
import { firebaseApp } from '../utils/firebaseConfig';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ avatar: '', name: '', bio: '' });

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');

        // Fetch user profile
        const userResponse = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        // Fetch user posts
        const postsResponse = await axios.get(
          `http://localhost:3080/user/${userId}/post/userpost/get`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setUser(userResponse.data.exist);
        setPosts(postsResponse.data.data);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const handleImageUpload = async (file) => {
    const storage = getStorage(firebaseApp);
    const storageRef = ref(storage, `avatars/${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const saveChanges = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');

      let updatedData = {};
      if (editData.name) updatedData.name = editData.name;
      if (editData.bio) updatedData.bio = editData.bio; // Bio as a string
      if (editData.avatar instanceof File) {
        const avatarUrl = await handleImageUpload(editData.avatar);
        updatedData.avatar = avatarUrl;
      }

      await axios.patch(
        `http://localhost:3080/user/update/${userId}`,
        updatedData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUser({
        ...user,
        ...updatedData, // Update user state
      });
      setEditMode(false);
    } catch (error) {
      console.error('Error updating profile:', error);
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
        {editMode ? (
          <div className="edit-profile-form">
            <h2>Edit Profile</h2>
            <div className="edit-avatar">
              <img
                src={
                  editData.avatar instanceof File
                    ? URL.createObjectURL(editData.avatar)
                    : editData.avatar || user?.avatar || 'https://via.placeholder.com/150'
                }
                alt="Avatar Preview"
                className="avatar-preview"
              />
              <input
                type="file"
                onChange={(e) => setEditData({ ...editData, avatar: e.target.files[0] })}
                accept="image/*"
              />
            </div>
            <div className="edit-fields">
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder={user?.name || 'Name'}
              /><br></br><br></br>
              <textarea
                value={editData.bio}
                onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                placeholder={user?.bio || 'Bio'}
              />
            </div>
            <div className="edit-actions">
              <button className="primary-button" onClick={saveChanges}>
                Save Changes
              </button>
              <button className="secondary-button" onClick={() => setEditMode(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
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
                    <button className="primary-button" onClick={() => setEditMode(true)}>
                      Edit Profile
                    </button>
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
            <br></br>
            <div className="post-navigation">
              <button className="tab-button active">
                <Grid />
                POSTS
              </button>
              <button className="tab-button active">
                <Bookmark />
                SAVED
              </button>
            </div>

            <div className="posts-grid">
              {posts?.length > 0 ? (
                posts.map((post) => (
                  <div key={post._id} className="post-card">
                    <div className="post-header">
                      <img
                        src={user?.avatar || 'default-avatar.png'}
                        alt={user?.name || 'User'}
                        className="post-user-avatar"
                      />
                      <div>
                        <div className="post-user-name">{user?.name || 'User'}</div>
                        <div className="post-date">{new Date(post.date).toLocaleString()}</div>
                      </div>
                    </div>
                    {post.image && <img src={post.image} alt="Post" className="post-image" />}
                    <div className="post-actions">
                      <div className="post-icons">
                        <Heart size={20} /> <MessageCircle size={20} /> <Share2 size={20} />
                      </div>
                      <Bookmark size={20} />
                    </div>
                    <div className="post-likes">{post.likes || 0} likes</div>
                    <div className="post-text">
                      <span className="post-user-name">{user?.name || 'User'}</span> {post.text || ''}
                    </div>
                    <div className="post-comments">{post.comments?.length || 0} comments</div>
                  </div>
                ))
              ) : (
                <p className="no-posts">No posts yet</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
