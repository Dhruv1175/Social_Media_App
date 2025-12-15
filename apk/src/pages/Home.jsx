import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Posts from '../components/Post';
import Story from '../components/Story';
import '../styles/Home.css';
import { useNavigate } from 'react-router-dom';
import { Users, RefreshCw } from 'lucide-react'; 

function Home() {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState([]); 
  const navigate = useNavigate();

  const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

  // --- FUNCTION: Fetch & Process Suggestions (Real Data) ---
  const fetchSuggestions = async (userId, token) => {
    try {
      const [allUsersResponse, followingResponse] = await Promise.all([
        axios.get(`http://localhost:30801/user/get/all`, { headers: authHeaders(token) }),
        axios.get(`http://localhost:30801/user/${userId}/following`, { headers: authHeaders(token) }),
      ]);

      const allUsers = allUsersResponse.data.users || [];
      const followingIds = new Set(
        (followingResponse.data.following || []).map(f => f.followingId || f._id)
      );

      const processedSuggestions = allUsers
        .filter(u => u._id !== userId && !followingIds.has(u._id))
        .map(u => ({
          id: u._id,
          username: u.username || u.name,
          name: u.name,
          avatar: u.avatar,
          isFollowing: false,
        }))
        .slice(0, 5); 

      setSuggestions(processedSuggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    }
  };
  // ----------------------------------------------------


  // Unified function to fetch and process primary feed data
  const fetchData = useCallback(async (ignoreCache = false) => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');

    if (!token || !userId) {
      navigate('/login');
      return;
    }

    const headers = authHeaders(token);
    const savedPostsMap = JSON.parse(localStorage.getItem('savedPosts') || '{}');
    
    // --- CACHING FOR FASTER INITIAL LOAD ---
    if (!ignoreCache) {
      const cachedPosts = localStorage.getItem('cachedFeedPosts');
      const cachedUser = localStorage.getItem('cachedUser');
      
      if (cachedPosts && cachedUser) {
        const parsedPosts = JSON.parse(cachedPosts);
        
        const updatedPosts = parsedPosts.map(post => ({
          ...post,
          isSaved: savedPostsMap[post._id] === true ? true : post.isSaved,
          likes: post.likes || [],
        }));
        
        setPosts(updatedPosts);
        setUser(JSON.parse(cachedUser));
        setLoading(false);
      }
    }

    // --- FETCH FRESH DATA & SYNC ---
    try {
      const [postsResponse, userResponse, likesResponse, savedPostsResponse] = await Promise.all([
        axios.get(`http://localhost:30801/user/post/${userId}/feed`, { headers }),
        axios.get(`http://localhost:30801/user/profile/${userId}`, { headers }),
        axios.get(`http://localhost:30801/user/${userId}/likes`, { headers }),
        axios.get(`http://localhost:30801/user/post/${userId}/saved`, { headers }).catch(e => ({ data: { saved: [] } })),
      ]);

      await fetchSuggestions(userId, token); 

      // --- Synchronization: Write fresh data to cache for Posts.jsx to read ---
      // 1. Liked Posts Sync
      let likedPostIdsArray = [];
      if (likesResponse.data?.likedPosts) {
          likedPostIdsArray = (likesResponse.data.likedPosts || [])
              .filter(post => post && post._id)
              .map(post => post._id);
      }
      localStorage.setItem('userLikedPosts', JSON.stringify(likedPostIdsArray));
      
      // 2. Saved Posts Sync
      const savedPostIdsSet = new Set((savedPostsResponse.data.saved || []).map(post => post._id));
      // -------------------------------------------------------------------------

      // Process posts: Use the raw server response data (postsResponse.data.posts)
      const processedPosts = (postsResponse.data.posts || []).map(post => {
        
        // This ensures the initial state is derived from the server for the Home feed
        const isSaved = savedPostIdsSet.has(post._id);

        return {
          ...post,
          isSaved, 
          likes: post.likes || [], 
        };
      });

      setPosts(processedPosts);
      setUser(userResponse.data.exist || null);
      setLoading(false);
      setRefreshing(false);

      // IMPORTANT: Update local cache map based on fresh server response
      const freshSavedPostsMap = {};
      (savedPostsResponse.data.saved || []).forEach(post => {
        freshSavedPostsMap[post._id] = true;
      });
      localStorage.setItem('savedPosts', JSON.stringify(freshSavedPostsMap));
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load your feed. Please try again later.');
      setLoading(false);
      setRefreshing(false);
      
      // Fallback: Load cached data on API error
      const cachedPosts = localStorage.getItem('cachedFeedPosts');
      const cachedUser = localStorage.getItem('cachedUser');
      
      if (cachedPosts && cachedUser) {
        const parsedPosts = JSON.parse(cachedPosts);
        const savedPostsMap = JSON.parse(localStorage.getItem('savedPosts') || '{}');
        
        const updatedPosts = parsedPosts.map(post => ({
          ...post,
          isSaved: savedPostsMap[post._id] === true ? true : post.isSaved,
          likes: post.likes || [],
        }));
        
        setPosts(updatedPosts);
        setUser(JSON.parse(cachedUser));
      }
    }
  }, [navigate]);

  // Call fetchData when component mounts
  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    localStorage.removeItem('cachedFeedPosts');
    fetchData(true);
  };
  
  const handleFollowToggle = async (suggestionId, isFollowing) => {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    
    if (!userId || !token) {
        navigate('/login');
        return;
    }

    try {
        const endpoint = isFollowing 
            ? `http://localhost:30801/user/${userId}/${suggestionId}/unfollow` 
            : `http://localhost:30801/user/${userId}/${suggestionId}/follow`;
        
        await axios.post(endpoint, {}, { headers: authHeaders(token) });

        setSuggestions(prevSuggestions => 
            prevSuggestions.map(s => 
                s.id === suggestionId ? { ...s, isFollowing: !s.isFollowing } : s
            )
        );
        fetchSuggestions(userId, token); 

    } catch (error) {
        console.error('Error toggling follow status:', error);
        alert('Failed to update follow status. Please try again.');
    }
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

  // --- FINAL CLEANED RENDER STRUCTURE ---
  return (
    <div className="home-container">
      {/* 1. Sidebar (Fixed Element - As requested) */}
      <Sidebar user={user} />

      <main className="main-content">
        <div className="content-container">
            
            {/* RESTORED: Original simple feed header */}
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
        
        {/* 2. Suggestions Sidebar (Floating/Sticky next to the content-container) */}
        <div className="suggestions-sidebar">
          
          {/* Current User Summary */}
          {user && (
            <div className="user-profile-summary">
              <div className="user-avatar" onClick={() => navigate(`/profile/${user._id}`)}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <div className="avatar-placeholder">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
              </div>
              <div className="user-info">
                <div className="username">{user.username || user.name}</div>
                <div className="user-bio">{user.bio || 'No bio yet'}</div>
              </div>
            </div>
          )}
          
          {/* Suggestions Header */}
          <div className="suggestions-header">
            <span>Suggestions For You</span>
            <a href="/search">See All</a>
          </div>
          
          {/* Suggestions List (Now displays real users and follow toggle) */}
          <div className="suggestions-list">
            {suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                    <div className="suggestion-item-detail" key={suggestion.id}>
                        {/* Avatar */}
                        <div className="suggestion-avatar" onClick={() => navigate(`/profile/${suggestion.id}`)}>
                            <img src={suggestion.avatar || '/assets/default-avatar.svg'} alt={suggestion.username} />
                        </div>
                        <div className="suggestion-info">
                            <div className="username">{suggestion.username}</div>
                            <div className="name-text">{suggestion.name}</div> 
                        </div>
                        {/* Follow Button */}
                        <button 
                            className={`follow-toggle-button ${suggestion.isFollowing ? 'unfollow' : 'follow'}`}
                            onClick={() => handleFollowToggle(suggestion.id, suggestion.isFollowing)}
                        >
                            {suggestion.isFollowing ? "Following" : "Follow"}
                        </button>
                    </div>
                ))
            ) : (
                <div className="suggestions-placeholder"> 
                    <p>No new suggestions at this time.</p>
                </div>
            )}
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