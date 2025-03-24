import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Search, User, ArrowLeft, UsersRound } from 'lucide-react';
import '../styles/SearchPage.css';

const SearchPage = () => {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('recent');
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

        const response = await axios.get(
          `http://localhost:3080/user/profile/${userId}`,
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
    loadRecentSearches();
  }, [navigate]);

  // Load recent searches from localStorage
  const loadRecentSearches = () => {
    try {
      const storedSearches = localStorage.getItem('recentSearches');
      if (storedSearches) {
        setRecentSearches(JSON.parse(storedSearches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value.trim() === '') {
      setActiveTab('recent');
    }
  };

  // Perform search when query changes
  useEffect(() => {
    if (searchQuery.trim().length >= 1) {
      setActiveTab('results');
      performSearch();
    }
  }, [searchQuery]);

  // Search function
  const performSearch = async () => {
    if (searchQuery.trim() === '') return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.error('Authentication token not available');
        setLoading(false);
        return;
      }
      
      const response = await axios.get(
        `http://localhost:3080/user/search?q=${encodeURIComponent(searchQuery)}`, 
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

  // Save user to recent searches
  const saveToRecentSearches = (user) => {
    try {
      // Get existing recent searches
      const existingSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      
      // Remove the user if they already exist in the list
      const filteredSearches = existingSearches.filter(search => search._id !== user._id);
      
      // Add the user to the beginning of the list
      const newSearches = [user, ...filteredSearches].slice(0, 8);
      
      // Save to localStorage
      localStorage.setItem('recentSearches', JSON.stringify(newSearches));
      
      // Update state
      setRecentSearches(newSearches);
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  };

  // Handle clicking on a search result
  const handleResultClick = (user) => {
    saveToRecentSearches(user);
    
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

  // Remove a user from recent searches
  const handleRemoveRecent = (e, userId) => {
    e.stopPropagation();
    
    try {
      const existingSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      const updatedSearches = existingSearches.filter(search => search._id !== userId);
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      setRecentSearches(updatedSearches);
    } catch (error) {
      console.error('Error removing recent search:', error);
    }
  };

  // Clear all recent searches
  const clearAllRecentSearches = () => {
    localStorage.removeItem('recentSearches');
    setRecentSearches([]);
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
      
      <div className="search-page-container">
        <div className="search-sidebar">
          <div className="search-header">
            <h2>Search</h2>
          </div>
          
          <div className="search-input-container">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search"
                className="search-input"
              />
            </div>
          </div>
          
          <div className="search-tabs">
            <button 
              className={`search-tab ${activeTab === 'recent' ? 'active' : ''}`}
              onClick={() => setActiveTab('recent')}
            >
              Recent
            </button>
            {searchQuery.trim() !== '' && (
              <button 
                className={`search-tab ${activeTab === 'results' ? 'active' : ''}`}
                onClick={() => setActiveTab('results')}
              >
                Results
              </button>
            )}
          </div>
          
          {activeTab === 'recent' && (
            <div className="recent-searches">
              <div className="recent-searches-header">
                <h3>Recent</h3>
                {recentSearches.length > 0 && (
                  <button className="clear-all-button" onClick={clearAllRecentSearches}>
                    Clear all
                  </button>
                )}
              </div>
              
              {recentSearches.length > 0 ? (
                <div className="search-results-list">
                  {recentSearches.map((user) => (
                    <div 
                      key={user._id} 
                      className="search-result-item"
                      onClick={() => handleResultClick(user)}
                    >
                      <div className="search-result-avatar">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} />
                        ) : (
                          <User size={24} />
                        )}
                      </div>
                      <div className="search-result-details">
                        <h3>{user.name}</h3>
                        <p>@{user.username || user.name.toLowerCase().replace(/\s+/g, '_')}</p>
                      </div>
                      <button 
                        className="remove-button"
                        onClick={(e) => handleRemoveRecent(e, user._id)}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  <UsersRound size={48} />
                  <p>No recent searches</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'results' && (
            <div className="search-results">
              {loading ? (
                <div className="loading-spinner-container">
                  <div className="loading-spinner"></div>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="search-results-list">
                  {searchResults.map((user) => (
                    <div 
                      key={user._id} 
                      className="search-result-item"
                      onClick={() => handleResultClick(user)}
                    >
                      <div className="search-result-avatar">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} />
                        ) : (
                          <User size={24} />
                        )}
                      </div>
                      <div className="search-result-details">
                        <h3>{user.name}</h3>
                        <p>@{user.username || user.name.toLowerCase().replace(/\s+/g, '_')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  <Search size={48} />
                  <p>No results found for "{searchQuery}"</p>
                  <span>Try searching for a name or username</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="search-content">
          <div className="search-placeholder">
            <Search size={64} strokeWidth={1} />
            <h2>Search for people</h2>
            <p>Find people to follow and connect with</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage; 