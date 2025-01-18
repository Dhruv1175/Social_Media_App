import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import axios from 'axios';
import { Settings, Grid, Bookmark, Link } from 'lucide-react';
import '../styles/ProfilePage.css';

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');

        const userResponse = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const postsResponse = await axios.get(
          `http://localhost:3080/user/${userId}/post/userpost/get`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setUser(userResponse.data.exist);
        setPosts(postsResponse.data.data || []);
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
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="profile-page">
    {/* Sidebar */}
    <Sidebar user={user} />
  
    {/* Main Content */}
    <div className="profile-main">
      {/* Profile Header */}
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
            <p>{user?.bio?.description || 'Bio description here'}</p>
            {user?.bio?.website && (
              <a href={user.bio.website} target="_blank" rel="noopener noreferrer">
                <Link className="link-icon" />
                {user.bio.website}
              </a>
            )}
          </div>
        </div>
      </div>
  
      {/* Post Navigation */}
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
  
      {/* Posts Grid */}
      <div className="posts-grid">
        {posts?.length > 0 ? (
          posts.map((post, i) => (
            <div key={post._id || i} className="post-item">
              <img
                src={post.image || 'https://via.placeholder.com/600'}
                alt={`Post ${i + 1}`}
                className="post-img"
              />
            </div>
          ))
        ) : (
          <p className="no-posts">No posts yet</p>
        )}
      </div>
    </div>
  </div>
  
  );
};

export default ProfilePage;
