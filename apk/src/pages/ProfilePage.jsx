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
  const [showEditModal, setShowEditModal] = useState(true);
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

  const handleEdit = () => {
    setEditData({
      avatar: user?.avatar || '',
      name: user?.name || '',
      bio: user?.bio?.description || ''
    });
    setShowEditModal(true);
  };

  const handleImageUpload = async (file) => {
    const storage = getStorage(firebaseApp);
    const storageRef = ref(storage, `avatars/${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const saveChanges = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      let avatarUrl = editData.avatar;

      if (editData.avatar instanceof File) {
        avatarUrl = await handleImageUpload(editData.avatar);
      }

      await axios.put(
        `http://localhost:3080/user/profile/update`,
        { name: editData.name, bio: editData.bio, avatar: avatarUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUser({ ...user, name: editData.name, bio: { description: editData.bio }, avatar: avatarUrl });
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
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
                <button className="primary-button" onClick={handleEdit}>
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
              <p>{user?.bio?.description || 'Bio description here'}</p>
            </div>
          </div>
        </div>

        <div className="post-navigation">
          <button className="tab-button active">
            <Grid />
            POSTS
          </button>
          <button className="tab-button">
            <Bookmark />
            SAVED
          </button>
        </div>

        <div className="posts-grid">
          {posts?.length > 0 ? (
            posts.map((post) => (
              <div
                key={post._id}
                className="post-card"
              >
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
      </div>

      
        <div className="modal">
          <div className="modal-content">
            <h2>Edit Profile</h2>
            <input
              type="file"
              onChange={(e) => setEditData({ ...editData, avatar: e.target.files[0] })}
              accept="image/*"
            />
            <input
              type="text"
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              placeholder="Name"
            />
            <textarea
              value={editData.bio}
              onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
              placeholder="Bio"
            />
            <div className="modal-actions">
              <button onClick={saveChanges}>Save</button>
              <button onClick={() => setShowEditModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
     
    </div>
  );
};

export default ProfilePage;
