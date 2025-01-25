import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Posts from '../components/Post';
import axios from 'axios';
import { Settings, Grid, Bookmark } from 'lucide-react';
import '../styles/ProfilePage.css';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

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

        // Fetch saved posts
        const savedPostsResponse = await axios.get(
          `http://localhost:3080/user/post/${userId}/saved`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setUser(userResponse.data.exist);
        setPosts(postsResponse.data.data);
        setSavedPosts(savedPostsResponse.data.data);
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

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
                <button className="primary-button">Edit Profile</button>
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
        {activeTab === 'posts' && <Posts posts={posts} user={user} />}
        {activeTab === 'saved' && <Posts posts={savedPosts} user={user} />}
      </div>
    </div>
  );
};

export default ProfilePage;
