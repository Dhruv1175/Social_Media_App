import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Search, User } from 'lucide-react';
import '../styles/SearchPage.css';
import API from '../utils/api';

const SearchPage = () => {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');

        if (!userId || !token) {
          navigate('/');
          return;
        }

        const response = await API.get(
          `/user/profile/${userId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        setUser(response.data.exist);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Handle search input change and perform search
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value.trim().length >= 1) {
      performSearch(e.target.value);
    } else {
      setSearchResults([]);
    }
  };

  // Search function
  const performSearch = async (query) => {
    if (query.trim() === '') return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.error('Authentication token not available');
        setLoading(false);
        return;
      }
      
      const response = await API.get(
        `/user/search?q=${encodeURIComponent(query)}`, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      if (response.data && response.data.users) {
        setSearchResults(response.data.users);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle clicking on a search result
  const handleResultClick = (user) => {
    // Navigate to the user's profile
    const currentUserId = localStorage.getItem('userId');
    
    // If the user clicked their own profile, go to the main profile page
    if (user._id === currentUserId) {
      navigate('/profile');
    } else {
      // Otherwise go to the user profile page with the user's ID
      navigate(`/profile/${user._id}`);
    }
  };

  // Format follower/following counts
  const formatCount = (count) => {
    if (!count) return 0;
    
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count;
  };

  if (loading && !user) {
    return (
      <div className="loading-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="search-page">
      <Sidebar user={user} />
      
      <div className="search-container">
        <div className="search-content">
          <div className="search-header">
            <h1>Search</h1>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search for users..."
              className="search-input"
            />
          </div>
          
          {searchResults.length > 0 ? (
            <div className="search-results">
              {searchResults.map((user) => (
                <div 
                  key={user._id} 
                  className="user-card"
                  onClick={() => handleResultClick(user)}
                >
                  <div className="user-avatar">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} />
                    ) : (
                      <User size={36} />
                    )}
                  </div>
                  <h3 className="user-name">{user.name}</h3>
                  <p className="user-username">@{user.username || user.name.toLowerCase().replace(/\s+/g, '_')}</p>
                  
                  <div className="user-stats">
                    <div className="stat">
                      <div className="stat-value">{formatCount(user.followers?.length || 0)}</div>
                      <div className="stat-label">Followers</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{formatCount(user.following?.length || 0)}</div>
                      <div className="stat-label">Following</div>
                    </div>
                  </div>
                  
                  <button className="follow-button">
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-results">
              {searchQuery ? (
                <p>No users found for "{searchQuery}"</p>
              ) : (
                <p>Search for users</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage; 