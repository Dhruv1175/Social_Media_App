import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/SearchBar.css';
import API from '../utils/api';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';

const SearchBar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('top');
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Handle clicks outside of the search container
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    // Add event listener when component mounts
    document.addEventListener('mousedown', handleClickOutside);
    
    // Remove event listener on cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    const storedSearches = localStorage.getItem('recentSearches');
    if (storedSearches) {
      try {
        setRecentSearches(JSON.parse(storedSearches).slice(0, 5));
      } catch (e) {
        console.error('Error parsing recent searches:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Check authentication on component mount
    const checkAuth = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.warn('No auth token found in localStorage. Search functionality may not work.');
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 1) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async () => {
    if (searchQuery.trim() === '') return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      console.log('Search query:', searchQuery);
      console.log('Token available?', !!token);
      
      if (!token) {
        console.error('Authentication token not available');
        setLoading(false);
        return;
      }
      
      const response = await API.get(
        `/user/search?q=${encodeURIComponent(searchQuery)}`, 
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: 5000 // 5 second timeout
        }
      );
      
      console.log('Search response:', response.data);
      
      if (response.data && response.data.users) {
        setSearchResults(response.data.users);
        setShowResults(true);
      } else {
        console.log('No users property in response data:', response.data);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      
      if (error.code === 'ECONNABORTED') {
        console.log('Request timed out. The server might be down or unreachable.');
      }
      
      if (error.response) {
        console.log('Error details:', error.response.data);
        console.log('Error status:', error.response.status);
        
        // Check for authentication errors
        if (error.response.status === 401) {
          console.log('Authentication error. Try logging out and back in.');
        }
      } else if (error.request) {
        console.log('No response received:', error.request);
      }
      
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value === '') {
      setActiveTab('recent');
    } else {
      setActiveTab('top');
    }
  };

  const handleInputFocus = () => {
    setShowResults(true);
    if (searchQuery === '') {
      setActiveTab('recent');
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab('recent');
    inputRef.current.focus();
  };

  const saveToRecentSearches = (user) => {
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
  };

  const handleResultClick = (user) => {
    setShowResults(false);
    
    // Save this search to recent searches
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

  const handleRemoveRecent = (e, userId) => {
    e.stopPropagation();
    
    // Remove from localStorage
    const existingSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    const updatedSearches = existingSearches.filter(search => search._id !== userId);
    localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
    
    // Update state
    setRecentSearches(updatedSearches);
  };

  const clearAllRecentSearches = () => {
    localStorage.removeItem('recentSearches');
    setRecentSearches([]);
  };

  return (
    <div className="search-container" ref={searchContainerRef}>
      <div className="search-bar">
        <Search size={16} className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
        />
        {searchQuery && (
          <button className="clear-search-button" onClick={handleClearSearch}>
            <X size={16} />
          </button>
        )}
      </div>
      
      {showResults && (
        <div className="search-results-panel">
          {!searchQuery && (
            <div className="search-results-header">
              <h4>Recent</h4>
              {recentSearches.length > 0 && (
                <button className="clear-all-button" onClick={clearAllRecentSearches}>
                  Clear all
                </button>
              )}
            </div>
          )}
          
          {!searchQuery && recentSearches.length > 0 ? (
            <div className="search-results-list">
              {recentSearches.map((user) => (
                <div 
                  key={user._id} 
                  className="search-result-item"
                  onClick={() => handleResultClick(user)}
                >
                  <div className="search-result-item-content">
                    <div className="search-result-icon recent">
                      <Clock size={16} />
                    </div>
                    <img 
                      src={user.avatar || DEFAULT_AVATAR} 
                      alt={user.name} 
                      className="search-result-avatar" 
                    />
                    <div className="search-result-details">
                      <div className="search-result-name">{user.name}</div>
                      <div className="search-result-username">@{user.username || user.name.toLowerCase().replace(/\s+/g, '_')}</div>
                    </div>
                  </div>
                  <button 
                    className="remove-recent-button"
                    onClick={(e) => handleRemoveRecent(e, user._id)}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : !searchQuery ? (
            <div className="search-no-results">
              <p>No recent searches</p>
            </div>
          ) : null}
          
          {searchQuery && searchResults.length > 0 && (
            <div className="search-results-list">
              {searchResults.map((user) => (
                <div 
                  key={user._id} 
                  className="search-result-item"
                  onClick={() => handleResultClick(user)}
                >
                  <div className="search-result-item-content">
                    <img 
                      src={user.avatar || DEFAULT_AVATAR} 
                      alt={user.name} 
                      className="search-result-avatar" 
                    />
                    <div className="search-result-details">
                      <div className="search-result-name">{user.name}</div>
                      <div className="search-result-username">@{user.username || user.name.toLowerCase().replace(/\s+/g, '_')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {searchQuery && searchResults.length === 0 && !loading && (
            <div className="search-no-results">
              <p>No results found for "{searchQuery}"</p>
              <span>Try searching for a name or username</span>
            </div>
          )}
          
          {loading && (
            <div className="search-loading">
              <div className="loading-spinner"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar; 