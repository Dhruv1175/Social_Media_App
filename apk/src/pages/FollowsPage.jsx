import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { ArrowLeft, RefreshCw, Users, UserPlus, UserCheck, Search, X, Sparkles } from 'lucide-react';
import '../styles/FollowsPage.css';

const FollowsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get initial filter from navigation state if available
  const initialState = location.state || {};
  const [filter, setFilter] = useState(initialState.filter || 'recommended');
  const [profileId, setProfileId] = useState(initialState.userId || null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('accessToken');
        const currentUserId = localStorage.getItem('userId');
        
        if (!token || !currentUserId) {
          navigate('/');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        // Fetch current user
        const currentUserResponse = await axios.get(
          `http://localhost:3080/user/profile/${currentUserId}`,
          { headers }
        );
        setCurrentUser(currentUserResponse.data.exist);

        // Fetch all follow relationships
        const relationshipsResponse = await axios.get(
          'http://localhost:3080/follows/all'
        );

        if (relationshipsResponse.data.success) {
          setRelationships(relationshipsResponse.data.relationships || []);
        } else {
          setError('Failed to fetch follow relationships');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('An error occurred while fetching data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3080/follows/all');
      
      if (response.data.success) {
        setRelationships(response.data.relationships || []);
        setError(null);
      } else {
        setError('Failed to refresh follow relationships');
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      setError('An error occurred while refreshing data');
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  const handleUserClick = (userId) => {
    navigate(`/profile/${userId}`);
  };

  // Process relationships based on filter and create a list of user objects
  const getProcessedUsers = () => {
    const currentUserId = localStorage.getItem('userId');
    const targetId = profileId || currentUserId;
    
    // First filter relationships based on search and current filter
    const filteredRels = relationships.filter(rel => {
      // Apply search term filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const followerMatch = rel.follower.name.toLowerCase().includes(searchLower);
        const followingMatch = rel.following.name.toLowerCase().includes(searchLower);
        
        if (!followerMatch && !followingMatch) {
          return false;
        }
      }
      
      // Apply user type filter
      if (filter === 'followers') {
        return rel.following.id === targetId;
      }
      
      if (filter === 'following') {
        return rel.follower.id === targetId;
      }
      
      return true;
    });
    
    // Convert relationships to user objects
    let processedUsers = filteredRels.map(rel => {
      let user;
      let type;
      
      if (filter === 'followers' || (filter !== 'recommended' && rel.following.id === targetId)) {
        // This user follows the target
        user = rel.follower;
        type = 'Follower';
      } else if (filter === 'following' || (filter !== 'recommended' && rel.follower.id === targetId)) {
        // Target follows this user
        user = rel.following;
        type = 'Following';
      } else {
        // For other cases in non-recommended filters
        user = rel.follower.id === targetId ? rel.following : rel.follower;
        type = rel.follower.id === targetId ? 'Following' : 'Follower';
      }
      
      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        type: type,
        date: rel.date
      };
    });
    
    // For recommended filter, apply special logic to prioritize:
    // 1. Users who are followed by people you follow
    // 2. Users with more followers
    // 3. Recent users
    if (filter === 'recommended') {
      const currentUserId = localStorage.getItem('userId');
      
      // Get users the current user is following
      const followingIds = relationships
        .filter(rel => rel.follower.id === currentUserId)
        .map(rel => rel.following.id);
      
      // Count followers for each user
      const followerCounts = {};
      relationships.forEach(rel => {
        if (!followerCounts[rel.following.id]) {
          followerCounts[rel.following.id] = 0;
        }
        followerCounts[rel.following.id]++;
      });
      
      // Find users that are followed by users the current user follows
      const followedByFollowing = new Set();
      relationships.forEach(rel => {
        if (followingIds.includes(rel.follower.id) && rel.following.id !== currentUserId) {
          followedByFollowing.add(rel.following.id);
        }
      });
      
      // Create a list of all unique users that are not the current user and not already followed
      const allUserIds = new Set();
      const alreadyFollowing = new Set(followingIds);
      
      relationships.forEach(rel => {
        if (rel.follower.id !== currentUserId && !alreadyFollowing.has(rel.follower.id)) {
          allUserIds.add(rel.follower.id);
        }
        if (rel.following.id !== currentUserId && !alreadyFollowing.has(rel.following.id)) {
          allUserIds.add(rel.following.id);
        }
      });
      
      // Build recommended users list and sort them
      const recommendedUsers = [];
      
      // Extract unique users and eliminate duplicates
      const seenIds = new Set();
      
      processedUsers.forEach(user => {
        if (!seenIds.has(user.id) && user.id !== currentUserId && !alreadyFollowing.has(user.id)) {
          const score = (followedByFollowing.has(user.id) ? 100 : 0) + 
                       (followerCounts[user.id] || 0);
          
          recommendedUsers.push({
            ...user,
            score: score,
            type: 'Suggested'
          });
          
          seenIds.add(user.id);
        }
      });
      
      // Sort by score (users followed by your follows first, then by follower count)
      recommendedUsers.sort((a, b) => b.score - a.score);
      
      // Return top recommendations
      return recommendedUsers;
    }
    
    return processedUsers;
  };

  const processedUsers = getProcessedUsers();

  // Get the name of the user whose relationships we're viewing
  const getProfileName = () => {
    if (!profileId || !relationships.length) return '';
    
    const userRelationship = relationships.find(
      rel => rel.follower.id === profileId || rel.following.id === profileId
    );
    
    if (!userRelationship) return '';
    
    return userRelationship.follower.id === profileId 
      ? userRelationship.follower.name 
      : userRelationship.following.name;
  };

  // Render empty state based on filter
  const renderEmptyState = () => {
    const icon = filter === 'followers' ? <UserCheck size={48} /> : 
                 filter === 'following' ? <UserPlus size={48} /> : 
                 <Sparkles size={48} />;
                 
    const mainText = filter === 'followers' ? "No followers yet" :
                    filter === 'following' ? "Not following anyone yet" :
                    "No recommendations available";
                    
    const subText = filter === 'followers' ? "When people follow you, they'll appear here" :
                   filter === 'following' ? "When you follow people, they'll appear here" :
                   "We'll show you recommended profiles based on your activity";
    
    return (
      <div className="empty-state">
        <div className="empty-state-icon">{icon}</div>
        <h3 className="empty-state-text">{mainText}</h3>
        <p className="empty-state-subtext">{subText}</p>
      </div>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="follows-page">
      <Sidebar user={currentUser} />
      
      <div className="follows-content">
        <div className="follows-header">
          <h1>
            {profileId && filter !== 'recommended' 
              ? `${getProfileName()}'s ${filter === 'followers' ? 'Followers' : 'Following'}`
              : filter === 'followers' ? 'Followers' : 
                filter === 'following' ? 'Following' : 'Suggestions'}
          </h1>
          <button className="refresh-button" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>

        <div className="search-filter-container">
          <div className="search-input-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                className="clear-search" 
                onClick={() => setSearchTerm('')}
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <div className="filter-buttons">
            <button 
              className={`filter-button ${filter === 'recommended' ? 'active' : ''}`}
              onClick={() => { 
                setFilter('recommended');
                setProfileId(null);
              }}
            >
              <Sparkles size={16} />
              Suggested
            </button>
            <button 
              className={`filter-button ${filter === 'followers' ? 'active' : ''}`}
              onClick={() => setFilter('followers')}
            >
              <UserCheck size={16} />
              Followers
            </button>
            <button 
              className={`filter-button ${filter === 'following' ? 'active' : ''}`}
              onClick={() => setFilter('following')}
            >
              <UserPlus size={16} />
              Following
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        {loading ? (
          <div className="loading-container">
            <div className="loader"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <>
            <div className="relationships-stats">
              <p>Showing <strong>{processedUsers.length}</strong> {processedUsers.length === 1 ? 'user' : 'users'}</p>
              {searchTerm && <p>Filtering by: <strong>"{searchTerm}"</strong></p>}
            </div>
            
            {processedUsers.length > 0 ? (
              <div className="relationships-list">
                {processedUsers.map((user) => (
                  <div 
                    key={`${user.id}-${user.type}`} 
                    className="user-item"
                    onClick={() => handleUserClick(user.id)}
                  >
                    <img 
                      src={user.avatar || 'https://via.placeholder.com/50'} 
                      alt={user.name} 
                      className="user-avatar"
                    />
                    <div className="user-details">
                      <span className="user-name">{user.name}</span>
                      <span className="user-id">ID: {user.id}</span>
                    </div>
                    <div className="user-meta">
                      <span className="user-date">{formatDate(user.date)}</span>
                      <span className="user-type">{user.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              renderEmptyState()
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FollowsPage; 