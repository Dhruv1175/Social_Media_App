import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Posts from '../components/Post';
import Story from '../components/Story';
import '../styles/Home.css';

function Home1() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch data from the database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const userId = localStorage.getItem('userId');

        if (!token || !userId) {
          window.location.href = '/';
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch posts for feed
        const postsResponse = await axios.get(
          `http://localhost:3080/user/post/${userId}/feed`,
          { headers }
        );

        // Fetch user data
        const userResponse = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
          { headers }
        );

        setPosts(postsResponse.data.posts || []);
        setUser(userResponse.data.exist || null);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="home-container">
      <Sidebar user={user} />
      
      <main className="main-content">
        <div className="content-container">
          {/* Stories Section */}
          <Story />
          
          {/* Posts Section */}
          <div className="posts-container">
            {posts.length > 0 ? (
              <Posts posts={posts} user={user} />
            ) : (
              <div className="no-posts">
                <h3>No posts yet</h3>
                <p>Follow users to see their posts in your feed</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Suggestions Section (can be implemented later) */}
        <div className="suggestions-sidebar">
          {/* User profile summary */}
          {user && (
            <div className="user-profile-summary">
              <div className="user-avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <div className="avatar-placeholder"></div>
                )}
              </div>
              <div className="user-info">
                <div className="username">{user.name}</div>
                <div className="user-bio">{user.bio || 'No bio yet'}</div>
              </div>
            </div>
          )}
          
          {/* Suggestions placeholder */}
          <div className="suggestions-header">
            <span>Suggestions For You</span>
            <a href="#">See All</a>
          </div>
          
          <div className="suggestions-placeholder">
            <p>Coming soon!</p>
          </div>
          
          {/* Footer links */}
          <div className="footer-links">
            <a href="#">About</a> · 
            <a href="#">Help</a> · 
            <a href="#">API</a> · 
            <a href="#">Privacy</a> · 
            <a href="#">Terms</a>
          </div>
          
          <div className="copyright">
            © 2023 Rizzit
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home1;
