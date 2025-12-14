import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Posts from '../components/Post';
import Story from '../components/Story';
import '../styles/Home.css';
import { useNavigate } from 'react-router-dom';
import { Search, Users, RefreshCw } from 'lucide-react';

function Home() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  // Fetch data from the database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const userId = localStorage.getItem('userId');

        if (!token || !userId) {
          navigate('/login');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // First, check for cached data for faster initial load
        const cachedPosts = localStorage.getItem('cachedFeedPosts');
        const cachedUser = localStorage.getItem('cachedUser');
        const savedPostsMap = JSON.parse(localStorage.getItem('savedPosts') || '{}');
        
        if (cachedPosts && cachedUser) {
          // Apply any saved posts states that might have changed
          const parsedPosts = JSON.parse(cachedPosts);
          const updatedPosts = parsedPosts.map(post => ({
            ...post,
            isSaved: savedPostsMap[post._id] === true ? true : post.isSaved
          }));
          
          setPosts(updatedPosts);
          setUser(JSON.parse(cachedUser));
          setLoading(false);
        }

        // Fetch posts for feed
        const postsResponse = await axios.get(
          `http://localhost:30801/user/post/${userId}/feed`,
          { headers }
        );

        // Fetch user data
        const userResponse = await axios.get(
          `http://localhost:30801/user/profile/${userId}`,
          { headers }
        );

        // Fetch user likes
        const likesResponse = await axios.get(
          `http://localhost:30801/user/${userId}/likes`,
          { headers }
        );

        // Fetch saved posts list
        let savedPosts = [];
        try {
          const savedPostsResponse = await axios.get(
            `http://localhost:30801/user/post/${userId}/saved`,
            { headers }
          );
          if (savedPostsResponse.data && savedPostsResponse.data.success) {
            savedPosts = savedPostsResponse.data.saved || [];
          }
        } catch (error) {
          console.error('Error fetching saved posts:', error);
          // Continue without saved posts data
        }

        // Create a map of saved post IDs for quicker lookup
        const savedPostIds = new Set(savedPosts.map(post => post._id));
        
        // Process posts to include the right properties for the Posts component
        const likedPostIds = likesResponse.data?.likedPosts 
          ? new Set(likesResponse.data.likedPosts.filter(post => post && post._id).map(post => post._id)) 
          : new Set();

        const processedPosts = (postsResponse.data.posts || []).map(post => {
          // Check if the current user is in the likes array (if it exists)
          const isLiked = Array.isArray(post.likes) 
            ? post.likes.includes(userId) 
            : likedPostIds.has(post._id);

          // Check if post is saved by current user - use both backend data and localStorage
          const isSaved = savedPostIds.has(post._id) || savedPostsMap[post._id] === true;

          return {
            ...post,
            isLiked,
            isSaved,
            // Ensure likes is a number if it's an array of user IDs
            likes: Array.isArray(post.likes) ? post.likes.length : post.likes || 0,
          };
        });

        setPosts(processedPosts);
        setUser(userResponse.data.exist || null);
        setLoading(false);
        setRefreshing(false);

        // Save processed data to localStorage
        localStorage.setItem('cachedFeedPosts', JSON.stringify(processedPosts));
        localStorage.setItem('cachedUser', JSON.stringify(userResponse.data.exist || null));
        
        // Also update saved posts in localStorage to sync with backend
        const updatedSavedPostsMap = {};
        savedPosts.forEach(post => {
          updatedSavedPostsMap[post._id] = true;
        });
        localStorage.setItem('savedPosts', JSON.stringify({...savedPostsMap, ...updatedSavedPostsMap}));
        
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load your feed. Please try again later.');
        setLoading(false);
        setRefreshing(false);
        
        // Try to load cached data if available
        const cachedPosts = localStorage.getItem('cachedFeedPosts');
        const cachedUser = localStorage.getItem('cachedUser');
        
        if (cachedPosts && cachedUser) {
          // Still apply saved states from localStorage if available
          const parsedPosts = JSON.parse(cachedPosts);
          const savedPostsMap = JSON.parse(localStorage.getItem('savedPosts') || '{}');
          
          const updatedPosts = parsedPosts.map(post => ({
            ...post,
            isSaved: savedPostsMap[post._id] === true ? true : post.isSaved
          }));
          
          setPosts(updatedPosts);
          setUser(JSON.parse(cachedUser));
        }
      }
    };

    fetchData();
  }, [navigate]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Clear cache to force a fresh load
    localStorage.removeItem('cachedFeedPosts');
    // Trigger the effect to reload data
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const userId = localStorage.getItem('userId');

        if (!token || !userId) {
          navigate('/login');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch fresh data
        const postsResponse = await axios.get(
          `http://localhost:30801/user/post/${userId}/feed`,
          { headers }
        );

        const userResponse = await axios.get(
          `http://localhost:30801/user/profile/${userId}`,
          { headers }
        );

        const likesResponse = await axios.get(
          `http://localhost:30801/user/${userId}/likes`,
          { headers }
        );

        // Process and update state
        const processedPosts = (postsResponse.data.posts || []).map(post => {
          const isLiked = Array.isArray(post.likes) 
            ? post.likes.includes(userId) 
            : false;

          return {
            ...post,
            isLiked,
            isSaved: false,
            likes: Array.isArray(post.likes) ? post.likes.length : post.likes || 0,
          };
        });

        setPosts(processedPosts);
        setUser(userResponse.data.exist || null);
        
        // Update cache
        localStorage.setItem('cachedFeedPosts', JSON.stringify(processedPosts));
        localStorage.setItem('cachedUser', JSON.stringify(userResponse.data.exist || null));
        
        setRefreshing(false);
      } catch (error) {
        console.error('Error refreshing data:', error);
        setRefreshing(false);
      }
    };

    fetchData();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your feed...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="home-container">
      <Sidebar user={user} />

      <main className="main-content">
        <div className="content-container">
          {/* Page Header with refresh button */}
          <div className="feed-header">
            <h1 className="feed-title">Home</h1>
            <button 
              className={`refresh-button ${refreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh feed"
            >
              <RefreshCw size={20} />
            </button>
          </div>
          
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
                <button 
                  onClick={() => navigate('/search')}
                  className="find-users-button"
                >
                  <Users size={18} />
                  Find users to follow
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Suggestions Sidebar */}
        <div className="suggestions-sidebar">
          {/* User profile summary */}
          {user && (
            <div className="user-profile-summary">
              <div className="user-avatar">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <div className="avatar-placeholder">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
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
            <a href="/search">See All</a>
          </div>
          
          <div className="suggestions-placeholder">
            <Search size={24} className="suggestions-icon" />
            <p>Discover people to follow</p>
            <button 
              onClick={() => navigate('/search')}
              className="explore-users-button"
            >
              Explore
            </button>
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
            © {new Date().getFullYear()} Social Media App
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;
