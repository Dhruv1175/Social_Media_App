import React, { useEffect, useState, useRef } from 'react';
import '../styles/Sidebar.css';
import { useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Instagram, Home, Compass, MessageCircle, Heart, PlusSquare, Menu, LogOut, User, Search, Settings } from 'lucide-react';
import axios from 'axios';
import CreatePost from './CreatePost';
import { useTheme } from '../context/ThemeContext';
import API from '../utils/api';

const Sidebar = ({ user: propUser }) => {
  const [user, setUser] = useState(propUser || null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { theme } = useTheme();

  const socketRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 5;

  // Initialize WebSocket connection for real-time notifications
  const initializeSocket = useCallback(() => {
    const token = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId');
    
    if (!token || !userId) return;

    try {
      // Close existing socket if any
      if (socketRef.current) {
        socketRef.current.close();
      }

      // Create WebSocket connection
      socketRef.current = new WebSocket(`ws://localhost:30801?token=${token}&userId=${userId}`);

      socketRef.current.onopen = () => {
        console.log('Sidebar WebSocket connected');
        setSocketConnected(true);
        retryCountRef.current = 0;
        
        // Join user's notification room
        socketRef.current.send(JSON.stringify({
          type: 'join',
          userId: userId
        }));
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              console.log('Connected to real-time notification service');
              break;
            case 'new-notification':
              // Update unread count when new notification arrives
              setUnreadCount(prev => prev + 1);
              break;
            case 'notification-read':
              // Decrease count when notification is marked as read
              setUnreadCount(prev => Math.max(0, prev - 1));
              break;
            case 'all-notifications-read':
              // Reset count when all notifications are marked as read
              setUnreadCount(0);
              break;
            case 'notification-deleted':
              // Decrease count if deleted notification was unread
              // We'll fetch fresh count for accuracy
              fetchUnreadCount();
              break;
            case 'unread-count-updated':
              // Update count from server
              if (data.count !== undefined) {
                setUnreadCount(data.count);
              }
              break;
            case 'ping':
              // Respond to keep-alive ping
              socketRef.current.send(JSON.stringify({ type: 'pong' }));
              break;
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      socketRef.current.onerror = (error) => {
        console.error('Sidebar WebSocket error:', error);
        setSocketConnected(false);
      };

      socketRef.current.onclose = (event) => {
        console.log('Sidebar WebSocket disconnected:', event.code, event.reason);
        setSocketConnected(false);
        
        // Attempt reconnection with exponential backoff
        if (retryCountRef.current < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current++;
          
          setTimeout(() => {
            initializeSocket();
          }, delay);
        } else {
          // Fall back to polling
          console.log('Max retries reached, falling back to polling');
          startPolling();
        }
      };

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setSocketConnected(false);
      startPolling();
    }
  }, []);

  // Start polling as fallback
  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (window.sidebarPollingInterval) {
      clearInterval(window.sidebarPollingInterval);
    }
    
    // Poll every 30 seconds
    window.sidebarPollingInterval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);
    
    console.log('Sidebar polling started');
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('accessToken');
      
      if (!userId || !token) return;
      
      const response = await API.get(
        `/user/${userId}/notifications/unread`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        setUnreadCount(response.data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  useEffect(() => {
    // If user is provided as a prop, use that
    if (propUser) {
      setUser(propUser);
      return;
    }

    // Otherwise fetch user data
    const fetchUserData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('accessToken');
        
        if (!userId || !token) {
          console.error('User ID or token not found');
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
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
  }, [propUser]);

  useEffect(() => {
    // Initialize real-time connection
    initializeSocket();
    
    // Fetch initial count
    fetchUnreadCount();
    
    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (window.sidebarPollingInterval) {
        clearInterval(window.sidebarPollingInterval);
      }
    };
  }, [initializeSocket, fetchUnreadCount]);

  const handleLogout = () => {
    // Clean up WebSocket connection
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    // Clear polling interval
    if (window.sidebarPollingInterval) {
      clearInterval(window.sidebarPollingInterval);
    }
    
    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('cachedFeedPosts');
    localStorage.removeItem('cachedUser');
    localStorage.removeItem('savedPosts');
    
    // Redirect to login
    window.location.href = '/';
  };

  const handleCreate = (e) => {
    e.preventDefault();
    setShowCreateModal(true);
  };

  const isActive = (path) => {
    if (path === '/home') {
      return location.pathname === '/home' || location.pathname === '/';
    }
    return location.pathname === path;
  };

  const handlePostCreated = () => {
    setShowCreateModal(false);
    // Redirect to the user's profile page
    const userId = localStorage.getItem('userId');
    if (userId) {
      navigate(`/profile/${userId}`);
    } else {
      navigate('/');
    }
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
  };

  return (
    <>
      <div className="sidebar">
        <div className="sidebar-logo">
          <Instagram className="logo-icon" />
          <span className="logo-text">Rizzit</span>
        </div>
        
        <nav className="sidebar-nav">
          <Link to="/home" className={`nav-item ${isActive('/home') ? 'active' : ''}`}>
            <Home className="nav-icon" />
            <span className="nav-text">Home</span>
          </Link>
          
          <Link to="/search" className={`nav-item ${isActive('/search') ? 'active' : ''}`}>
            <Search className="nav-icon" />
            <span className="nav-text">Search</span>
          </Link>
          
          <Link to="/explore" className={`nav-item ${isActive('/explore') ? 'active' : ''}`}>
            <Compass className="nav-icon" />
            <span className="nav-text">Explore</span>
          </Link>
          
          <Link to="/messages" className={`nav-item ${isActive('/messages') ? 'active' : ''}`}>
            <MessageCircle className="nav-icon" />
            <span className="nav-text">Messages</span>
          </Link>
          
          <Link to="#" className={`nav-item ${isActive('/create') ? 'active' : ''}`} onClick={handleCreate}>
            <PlusSquare className="nav-icon" />
            <span className="nav-text">Create</span>
          </Link>
          
          <Link to="/notifications" className={`nav-item ${isActive('/notifications') ? 'active' : ''}`}>
            <div className="notification-wrapper">
              <Heart className="nav-icon" />
              {unreadCount > 0 && (
                <span className={`notification-badge ${socketConnected ? 'live' : ''}`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                  {socketConnected && <span className="live-dot"></span>}
                </span>
              )}
            </div>
            <span className="nav-text">Notifications</span>
          </Link>
          
          <Link to="/profile" className={`nav-item ${isActive('/profile') ? 'active' : ''}`}>
            {user && user.avatar ? (
              <img src={user.avatar} alt="Profile" className="nav-icon profile-pic" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
            ) : (
              <User className="nav-icon" size={24} />
            )}
            <span className="nav-text">{user?.name || 'Profile'}</span>
          </Link>
          
          <Link to="/settings" className={`nav-item ${isActive('/settings') ? 'active' : ''}`}>
            <Settings className="nav-icon" />
            <span className="nav-text">Settings</span>
          </Link>
        </nav>
        
        <div className="sidebar-footer">
          <Link to="#" className="nav-item" onClick={handleLogout}>
            <LogOut className="nav-icon" />
            <span className="nav-text">Logout</span>
          </Link>
          
          <Link to="#" className="nav-item">
            <Menu className="nav-icon" />
            <span className="nav-text">More</span>
          </Link>
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <CreatePost 
              onPostCreated={handlePostCreated} 
              onCancel={handleCancelCreate} 
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;