import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import { Users, UserPlus, UserCheck, Search, X, Sparkles } from 'lucide-react';
import '../styles/FollowsPage.css';

// Default image placeholders
const DEFAULT_AVATAR = '/assets/default-avatar.svg';

const FollowsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get initial filter from navigation state if available
  const initialState = location.state || {};
  const [filter, setFilter] = useState(initialState.filter || 'recommended');
  const [profileId, setProfileId] = useState(initialState.userId || null);

  useEffect(() => {
    fetchData();
  }, [navigate, profileId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const userId = localStorage.getItem('userId');
      
      if (!token || !userId) {
        navigate('/');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch current user
      const currentUserResponse = await axios.get(
        `http://localhost:30801/user/profile/${userId}`,
        { headers }
      );
      setCurrentUser(currentUserResponse.data.exist);

      // Fetch all users - using correct endpoint from UserRoutes.js
      try {
        console.log("Fetching all users...");
        const allUsersResponse = await axios.get(
          `http://localhost:30801/user/get/all`,
          { headers }
        );
        
        if (allUsersResponse.data && allUsersResponse.data.users) {
          console.log(`Received ${allUsersResponse.data.users.length} users`);
          setAllUsers(allUsersResponse.data.users.filter(user => user._id !== userId));
        } else {
          console.error('Failed to get all users or unexpected response format:', allUsersResponse.data);
          setAllUsers([]);
        }
      } catch (allUsersError) {
        console.error('Error fetching all users:', allUsersError);
        // Don't fail the entire operation if we can't get all users
        setAllUsers([]);
        // If this is a 404, it means the endpoint isn't available yet
        if (allUsersError.response && allUsersError.response.status === 404) {
          console.warn('The /user/get/all endpoint is not available - this is expected if you just updated the backend');
        }
      }
      
      // Determine which user profile we're viewing
      const targetUserId = profileId || userId;
      console.log(`Fetching data for user: ${targetUserId} (${profileId ? 'Profile view' : 'Own profile'})`);

      // Get followers list - use profileId if available, otherwise use logged-in user
      try {
        const followersResponse = await axios.get(
          `http://localhost:30801/user/${targetUserId}/followers`,
          { headers }
        );
        
        if (followersResponse.data && followersResponse.data.success) {
          // Extract follower users from the response
          const followerUsers = followersResponse.data.followdetails
            .filter(f => f.follower && f.follower._id)
            .map(f => f.follower);
          
          setFollowers(followerUsers);
          console.log(`Loaded ${followerUsers.length} followers from server for user ${targetUserId}`);
          
          // Only update session storage if it's our own profile
          if (targetUserId === userId) {
            updateFollowSessionData(userId, followerUsers, 'followers');
          }
        } else {
          console.error('Failed to get followers or unexpected response format');
          setFollowers([]);
        }
      } catch (err) {
        console.error('Error fetching followers:', err);
        setFollowers([]);
      }
      
      // Get following list - use profileId if available, otherwise use logged-in user
      try {
        const followingResponse = await axios.get(
          `http://localhost:30801/user/${targetUserId}/following`,
          { headers }
        );
        
        if (followingResponse.data && followingResponse.data.success) {
          // Extract following users from the response
          const followingUsers = followingResponse.data.followdetails
            .filter(f => f.following && f.following._id)
            .map(f => f.following);
          
          setFollowing(followingUsers);
          console.log(`Loaded ${followingUsers.length} following from server for user ${targetUserId}`);
          
          // Only update our following data in session storage if it's our own profile
          if (targetUserId === userId) {
            // Update session storage with following data
            updateFollowSessionData(userId, followingUsers, 'following');
            
            // Update individual follow status in session storage
            followingUsers.forEach(followedUser => {
              if (followedUser && followedUser._id) {
                const sessionFollowKey = `follow_status_${userId}_${followedUser._id}`;
                sessionStorage.setItem(sessionFollowKey, 'true');
              }
            });
          }
        } else {
          console.error('Failed to get following or unexpected response format');
          setFollowing([]);
        }
      } catch (err) {
        console.error('Error fetching following:', err);
        setFollowing([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to update session storage with follow data
  const updateFollowSessionData = (userId, users, type) => {
    try {
      if (!Array.isArray(users)) return;
      
      // Store simplified version of users to reduce storage size
      const simplifiedUsers = users.map(user => ({
        _id: user._id,
        name: user.name,
        username: user.username,
        avatar: user.avatar
      }));
      
      // Use userId to make the key unique for each logged-in user
      const storageKey = `${userId}_${type}`;
      sessionStorage.setItem(storageKey, JSON.stringify(simplifiedUsers));
      
      console.log(`Updated session storage for ${type}`);
    } catch (error) {
      console.error(`Error saving ${type} to session storage:`, error);
    }
  };

  const handleUserClick = (userId) => {
    navigate(`/profile/${userId}`);
  };
  
  const handleFollow = async (user) => {
    if (!user || !user._id) return;
    
    // Disable button while processing
    const userId = localStorage.getItem('userId');
    const userBeingActedOn = user._id || user.id;
    
    // Generate a unique key for this follow operation
    const operationKey = `follow-${userId}-${userBeingActedOn}`;
    
    // Check if we're already processing this operation
    if (window[operationKey]) {
      console.log('Operation already in progress, skipping duplicate');
      return;
    }
    
    // Set flag to prevent duplicate operations
    window[operationKey] = true;
    
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token || !userId) {
        navigate('/');
        return;
      }
      
      const headers = { Authorization: `Bearer ${token}` };
      
      // Determine if we're following or unfollowing
      const isCurrentlyFollowing = following.some(f => f._id === userBeingActedOn);
      
      // Create session storage key for this follow relationship
      const sessionFollowKey = `follow_status_${userId}_${userBeingActedOn}`;
      
      // Use the correct endpoint format from the backend routes
      const endpoint = isCurrentlyFollowing
        ? `http://localhost:30801/user/${userId}/${userBeingActedOn}/unfollow`
        : `http://localhost:30801/user/${userId}/${userBeingActedOn}/follow`;
      
      console.log(`Using endpoint: ${endpoint} for ${isCurrentlyFollowing ? 'unfollow' : 'follow'} action`);
      
      // Clone current following list before optimistic update
      const previousFollowing = [...following];
      const newFollowStatus = !isCurrentlyFollowing;
      
      // Optimistically update UI
      if (isCurrentlyFollowing) {
        // Remove from following array if unfollowing
        setFollowing(prevFollowing => prevFollowing.filter(f => f._id !== userBeingActedOn));
        // Update session storage
        sessionStorage.setItem(sessionFollowKey, 'false');
      } else {
        // Add to following array if following
        setFollowing(prevFollowing => [...prevFollowing, user]);
        // Update session storage
        sessionStorage.setItem(sessionFollowKey, 'true');
      }
      
      console.log(`Starting ${isCurrentlyFollowing ? 'unfollow' : 'follow'} operation for user ${user.name}`);
      
      // Make API call with correct endpoint and empty body (as per backend implementation)
      try {
        const response = await axios.post(
          endpoint,
          {}, // Empty body as the backend uses route parameters
          { headers }
        );
        
        console.log('API Response:', response.data);
        
        if (!response.data || !response.data.success) {
          // If unsuccessful, revert the optimistic update
          console.error('Follow/unfollow failed:', response.data?.message || 'No success response');
          setFollowing(previousFollowing); // Restore previous state
          
          // Revert session storage as well
          sessionStorage.setItem(sessionFollowKey, isCurrentlyFollowing.toString());
          
          throw new Error(response.data?.message || 'Failed to update follow status');
        }
        
        console.log(`Successfully ${isCurrentlyFollowing ? 'unfollowed' : 'followed'} user:`, user.name);
        
        // Force update of following/followers lists
        const forceRefresh = async () => {
          try {
            // Refetch following status to ensure it's updated
            const followingResponse = await axios.get(
              `http://localhost:30801/user/${userId}/following`,
              { headers }
            );
            
            if (followingResponse.data && followingResponse.data.success) {
              const followingUsers = followingResponse.data.followdetails
                .filter(f => f.following && f.following._id)
                .map(f => f.following);
                
              setFollowing(followingUsers);
              console.log(`Updated following list, now following ${followingUsers.length} users`);
              
              // Update session storage with following data
              updateFollowSessionData(userId, followingUsers, 'following');
              
              // Update individual follow status in session storage
              followingUsers.forEach(followedUser => {
                if (followedUser && followedUser._id) {
                  const followSessionKey = `follow_status_${userId}_${followedUser._id}`;
                  sessionStorage.setItem(followSessionKey, 'true');
                }
              });
              
              // Make sure our directly updated user has the correct state
              const specificUserKey = `follow_status_${userId}_${userBeingActedOn}`;
              const isNowFollowing = followingUsers.some(f => f._id === userBeingActedOn);
              sessionStorage.setItem(specificUserKey, isNowFollowing.toString());
            }
          } catch (refreshError) {
            console.error('Error refreshing follow data:', refreshError);
          }
        };
        
        // Run immediate force refresh
        await forceRefresh();
        
        // Then do a full data refresh
        setTimeout(() => {
          fetchData();
        }, 500);
        
      } catch (error) {
        console.error('Follow/unfollow request failed:', error);
        
        // Revert UI state
        setFollowing(previousFollowing);
        sessionStorage.setItem(sessionFollowKey, isCurrentlyFollowing.toString());
        
        // Display specific error message
        alert(error.message || 'Failed to update follow status. Please try again.');
        
        // Full refresh to ensure UI is in sync with server
        fetchData();
      }
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
      alert(error.message || 'Failed to update follow status. Please try again.');
      // Full refresh to ensure UI is in sync with server
      fetchData();
    } finally {
      // Clear operation flag
      window[operationKey] = false;
    }
  };

  // Process users based on filter and search term
  const getProcessedUsers = () => {
    const currentUserId = localStorage.getItem('userId');
    const targetUserId = profileId || currentUserId; // Use profileId if available, otherwise use current user
    
    // Determine which users to display based on filter
    let filteredUsers = [];
    
    if (filter === 'followers') {
      filteredUsers = [...followers];
    } else if (filter === 'following') {
      filteredUsers = [...following];
    } else if (filter === 'recommended') {
      // Check if we have users data
      if (allUsers.length === 0) {
        // If we don't have allUsers, create recommendations from followers and following
        console.log('No users data, generating recommendations from followers and following');
        
        // Create a set of IDs to exclude (the current user and users already being followed)
        const excludeIds = new Set([
          currentUserId,
          ...following.map(f => f._id)
        ]);
        
        // Add followers who aren't being followed yet
        filteredUsers = followers.filter(user => !excludeIds.has(user._id));
        
        // We could also consider friends-of-friends recommendations here
      } else {
        // Check if we're viewing our own or another user's profile
        if (profileId && profileId !== currentUserId) {
          // For another user's profile, we should show a different set of recommendations
          // For example, users they follow that we don't follow yet
          // This is simplified - you might want more complex recommendation logic
          filteredUsers = allUsers.filter(user => 
            !following.some(f => f._id === user._id) && 
            user._id !== currentUserId
          );
        } else {
          // Standard recommendations for current user
          filteredUsers = allUsers.filter(user => 
            !following.some(f => f._id === user._id)
          );
        }
      }
    }
    
    // Apply search term filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.name?.toLowerCase().includes(searchLower) ||
        user.username?.toLowerCase().includes(searchLower)
      );
    }
    
    // Add additional info to each user
    return filteredUsers.map(user => {
      const userId = localStorage.getItem('userId');
      const userIdToCheck = user._id || user.id;
      
      // First check session storage for the most up-to-date follow status
      const sessionFollowKey = `follow_status_${userId}_${userIdToCheck}`;
      const sessionFollowStatus = sessionStorage.getItem(sessionFollowKey);
      
      // Determine if this user is followed by current user
      let isFollowed = false;
      
      if (sessionFollowStatus !== null) {
        // Use the value from session storage if available
        isFollowed = sessionFollowStatus === 'true';
      } else {
        // Fall back to checking the following array
        isFollowed = following.some(f => 
          (f._id === userIdToCheck) || (f._id === user.id) || (f.id === userIdToCheck)
        );
        
        // Update session storage with the computed value
        sessionStorage.setItem(sessionFollowKey, isFollowed.toString());
      }
      
      // Determine the type based on filter
      let type = 'User';
      if (filter === 'followers') {
        type = 'Follower';
      } else if (filter === 'following') {
        type = 'Following';
      } else {
        type = 'Suggested';
      }
      
      return {
        ...user,
        id: userIdToCheck, // Ensure we have a consistent id field
        type,
        date: user.createdAt || new Date().toISOString(),
        isFollowed
      };
    });
  };

  const processedUsers = getProcessedUsers();

  // Get the name of the user whose relationships we're viewing
  const getProfileName = () => {
    if (!profileId) return '';
    
    // Check if we're viewing our own profile
    const currentUserId = localStorage.getItem('userId');
    if (profileId === currentUserId && currentUser) {
      return currentUser.name || 'Your';
    }
    
    // Check if the user is in our following or followers list
    const userInFollowing = following.find(user => user._id === profileId);
    if (userInFollowing) {
      return userInFollowing.name || "User's";
    }
    
    const userInFollowers = followers.find(user => user._id === profileId);
    if (userInFollowers) {
      return userInFollowers.name || "User's";
    }
    
    // Check if the user is in the all users list
    const userInAll = allUsers.find(user => user._id === profileId);
    if (userInAll) {
      return userInAll.name || "User's";
    }
    
    // If we can't find the name, return a generic label
    return "User's";
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

  // Add button to follow or unfollow a user
  const renderFollowButton = (user) => {
    const isCurrentlyFollowed = user.isFollowed;
    
    return (
      <button
        className={`follow-btn ${isCurrentlyFollowed ? 'following' : ''}`}
        onClick={(e) => {
          e.stopPropagation(); // Prevent navigation
          handleFollow(user);
        }}
      >
        {isCurrentlyFollowed ? 'Unfollow' : 'Follow'}
      </button>
    );
  };

  return (
    <div className="follows-page">
      <Sidebar user={currentUser} />
      
      <div className="follows-content">
        {error && <div className="error-message">{error}</div>}
        
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
                    key={user._id || user.id} 
                    className="user-item"
                    onClick={() => handleUserClick(user._id || user.id)}
                  >
                    <img 
                      src={user.avatar || DEFAULT_AVATAR} 
                      alt={user.name} 
                      className="user-avatar"
                    />
                    <div className="user-details">
                      <span className="user-name">{user.name}</span>
                      <span className="user-username">{user.username}</span>
                    </div>
                    <div className="user-meta">
                      <span className="user-date">{formatDate(user.date)}</span>
                      <span className="user-type">{user.type}</span>
                    </div>
                    <div className="user-actions">
                      {renderFollowButton(user)}
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