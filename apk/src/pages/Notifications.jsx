import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import '../styles/Notifications.css';
import { Link } from 'react-router-dom';
import { 
    Heart, MessageCircle, UserPlus, Bell, Globe, 
    Clock, Check, CheckCircle, MoreVertical, Settings,
    Trash2, Filter, RefreshCw, Wifi, WifiOff
} from 'lucide-react';
import Sidebar from '../components/Sidebar';

const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [user, setUser] = useState(null);
    const [totalUnreadCount, setTotalUnreadCount] = useState(0);
    const [socketConnected, setSocketConnected] = useState(false);
    const [realTimeMode, setRealTimeMode] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    
    const socketRef = useRef(null);
    const pollingIntervalRef = useRef(null);
    const retryCountRef = useRef(0);
    const maxRetries = 5;

    // Initialize WebSocket connection
    const initializeSocket = useCallback(() => {
        const token = localStorage.getItem('accessToken');
        const userId = localStorage.getItem('userId');
        
        if (!token || !userId) return;

        try {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }

            // Create WebSocket connection
            socketRef.current = new WebSocket(`ws://localhost:30801?token=${token}&userId=${userId}`);

            socketRef.current.onopen = () => {
                console.log('WebSocket connected for notifications');
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
                    console.log('WebSocket message received:', data);
                    
                    switch (data.type) {
                        case 'new-notification':
                            handleNewNotification(data.notification);
                            break;
                        case 'notification-read':
                            handleNotificationRead(data.notificationId);
                            break;
                        case 'notification-deleted':
                            handleNotificationDeleted(data.notificationId);
                            break;
                        case 'all-notifications-read':
                            handleAllNotificationsRead();
                            break;
                        case 'unread-count-updated':
                            setTotalUnreadCount(data.count);
                            break;
                        case 'ping':
                            socketRef.current.send(JSON.stringify({ type: 'pong' }));
                            break;
                    }
                } catch (error) {
                    console.error('Error processing WebSocket message:', error);
                }
            };

            socketRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setSocketConnected(false);
            };

            socketRef.current.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                setSocketConnected(false);
                
                // Attempt reconnection with exponential backoff
                if (retryCountRef.current < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
                    retryCountRef.current++;
                    
                    console.log(`Reconnecting in ${delay}ms...`);
                    setTimeout(() => {
                        if (realTimeMode) {
                            initializeSocket();
                        }
                    }, delay);
                }
            };

        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            setSocketConnected(false);
        }
    }, [realTimeMode]);

    // Initialize polling as fallback
    const initializePolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        pollingIntervalRef.current = setInterval(async () => {
            if (!realTimeMode || !socketConnected) {
                await fetchUnreadCount();
                
                // If we have notifications, check for updates
                if (notifications.length > 0) {
                    const latestNotification = notifications[0];
                    checkForNewNotifications(latestNotification._id);
                }
            }
        }, 30000); // Poll every 30 seconds
    }, [realTimeMode, socketConnected, notifications]);

    // Handle new notification from WebSocket
    const handleNewNotification = useCallback((notification) => {
        setNotifications(prev => {
            // Avoid duplicates
            const exists = prev.some(n => n._id === notification._id);
            if (exists) return prev;
            
            // Add new notification at the beginning
            return [notification, ...prev];
        });
        
        // Update unread count
        if (!notification.isRead) {
            setTotalUnreadCount(prev => prev + 1);
            if (filter === 'unread' || filter === 'all') {
                setUnreadCount(prev => prev + 1);
            }
        }
        
        setLastUpdated(new Date());
        
        // Show desktop notification
        if (Notification.permission === 'granted') {
            new Notification('New Notification', {
                body: getNotificationMessage(notification),
                icon: notification.fromUser?.avatar || '/default-avatar.png'
            });
        }
    }, [filter]);

    const handleNotificationRead = useCallback((notificationId) => {
        setNotifications(prev => prev.map(notif => 
            notif._id === notificationId ? { ...notif, isRead: true } : notif
        ));
        setTotalUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    const handleNotificationDeleted = useCallback((notificationId) => {
        const deletedNotif = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
        
        if (deletedNotif && !deletedNotif.isRead) {
            setTotalUnreadCount(prev => Math.max(0, prev - 1));
        }
    }, [notifications]);

    const handleAllNotificationsRead = useCallback(() => {
        setNotifications(prev => prev.map(notif => ({ 
            ...notif, 
            isRead: true 
        })));
        setTotalUnreadCount(0);
    }, []);

    // Check for new notifications since last seen
    const checkForNewNotifications = async (latestNotificationId) => {
        try {
            const token = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');
            
            const response = await axios.get(
                `http://localhost:30801/user/${userId}/notifications/new`,
                {
                    params: { since: latestNotificationId },
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            
            if (response.data.notifications && response.data.notifications.length > 0) {
                setNotifications(prev => {
                    const newNotifications = response.data.notifications.filter(
                        newNotif => !prev.some(existing => existing._id === newNotif._id)
                    );
                    return [...newNotifications, ...prev];
                });
                
                setTotalUnreadCount(prev => prev + response.data.newCount);
            }
        } catch (error) {
            console.error('Error checking for new notifications:', error);
        }
    };

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userId = localStorage.getItem('userId');
                const token = localStorage.getItem('accessToken');
                
                if (!userId || !token) return;
                
                const response = await axios.get(
                    `http://localhost:30801/user/profile/${userId}`,
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
        
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

    // Initialize real-time connection when component mounts or realTimeMode changes
    useEffect(() => {
        if (realTimeMode) {
            initializeSocket();
            initializePolling();
        } else {
            if (socketRef.current) {
                socketRef.current.close();
            }
            initializePolling(); // Still use polling but less frequently
        }
        
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [realTimeMode, initializeSocket, initializePolling]);

    const fetchUnreadCount = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');
            
            const response = await axios.get(
                `http://localhost:30801/user/${userId}/notifications/unread`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            
            setTotalUnreadCount(response.data.count || 0);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const fetchNotifications = useCallback(async (pageNum = 1, reset = true) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');
            
            // Build query parameters matching backend
            const params = { 
                page: pageNum, 
                limit: 15
            };
            
            // Apply filter based on selection
            if (filter === 'unread') {
                params.isRead = false;
            } else if (filter === 'likes') {
                params.type = 'like';
            } else if (filter === 'comments') {
                params.type = 'comment';
            } else if (filter === 'follows') {
                params.type = 'follow';
            }
            
            const response = await axios.get(
                `http://localhost:30801/user/${userId}/notifications`,
                {
                    params,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            const fetchedNotifications = response.data.notifications || [];
            
            if (reset || pageNum === 1) {
                setNotifications(fetchedNotifications);
            } else {
                setNotifications(prev => [...prev, ...fetchedNotifications]);
            }
            
            // Update counts
            setTotalUnreadCount(response.data.unreadCount || 0);
            setUnreadCount(fetchedNotifications.filter(n => !n.isRead).length);
            setHasMore(fetchedNotifications.length === 15);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching notifications:', error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchNotifications(1, true);
        setPage(1);
        fetchUnreadCount();
    }, [filter, fetchNotifications]);

    const handleMarkAsRead = async (notificationId) => {
        try {
            const token = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');
            
            await axios.patch(
                `http://localhost:30801/user/${userId}/notification/${notificationId}/read`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Update locally
            handleNotificationRead(notificationId);
            
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');
            
            await axios.post(
                `http://localhost:30801/user/${userId}/notification/mark-all-read`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Update all notifications to read in state
            handleAllNotificationsRead();
            
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            const token = localStorage.getItem('accessToken');
            
            await axios.delete(
                `http://localhost:30801/user/notification/${notificationId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Update locally
            handleNotificationDeleted(notificationId);
            
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'like':
                return <Heart className="like-icon" size={20} />;
            case 'comment':
                return <MessageCircle className="comment-icon" size={20} />;
            case 'follow':
                return <UserPlus className="follow-icon" size={20} />;
            case 'message':
                return <MessageCircle className="message-icon" size={20} />;
            default:
                return <Globe className="default-icon" size={20} />;
        }
    };

    const getNotificationMessage = (notification) => {
        const username = notification.fromUser?.name || notification.fromUser?.username || 'Someone';
        
        switch (notification.type) {
            case 'like':
                return `${username} liked your post`;
            case 'comment':
                return `${username} commented on your post`;
            case 'follow':
                return `${username} started following you`;
            case 'message':
                return `${username} sent you a message`;
            default:
                return 'New notification';
        }
    };

    const formatTime = (dateString) => {
        if (!dateString) return 'Just now';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const handleLoadMore = () => {
        if (hasMore && !loading) {
            const nextPage = page + 1;
            fetchNotifications(nextPage, false);
            setPage(nextPage);
        }
    };

    const handleRefresh = () => {
        fetchNotifications(1, true);
        fetchUnreadCount();
    };

    const toggleRealTimeMode = () => {
        setRealTimeMode(!realTimeMode);
    };

    // Get filtered notifications for display
    const getFilteredNotifications = () => {
        let filtered = notifications;
        
        switch (filter) {
            case 'unread':
                filtered = filtered.filter(n => !n.isRead);
                break;
            case 'likes':
                filtered = filtered.filter(n => n.type === 'like');
                break;
            case 'comments':
                filtered = filtered.filter(n => n.type === 'comment');
                break;
            case 'follows':
                filtered = filtered.filter(n => n.type === 'follow');
                break;
            default:
                // 'all' - show all
                break;
        }
        
        return filtered;
    };

    const displayedNotifications = getFilteredNotifications();

    return (
        <div className="notifications-page">
            <Sidebar user={user} />
            
            <main className="notifications-main-content">
                {/* Header */}
                <div className="notifications-header">
                    <div className="header-left">
                        <h1>Notifications</h1>
                        <div className="connection-status">
                            <button 
                                className={`real-time-toggle ${realTimeMode ? 'active' : ''}`}
                                onClick={toggleRealTimeMode}
                                title={realTimeMode ? 'Disable real-time updates' : 'Enable real-time updates'}
                            >
                                {socketConnected ? (
                                    <Wifi size={16} />
                                ) : (
                                    <WifiOff size={16} />
                                )}
                                <span>{realTimeMode ? 'Live' : 'Polling'}</span>
                            </button>
                            {lastUpdated && (
                                <span className="last-updated">
                                    Updated {formatTime(lastUpdated)}
                                </span>
                            )}
                        </div>
                    </div>
                    
                    <div className="header-actions">
                        <button 
                            className="refresh-btn"
                            onClick={handleRefresh}
                            disabled={loading}
                            title="Refresh notifications"
                        >
                            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
                        </button>
                        {totalUnreadCount > 0 && (
                            <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                                <CheckCircle size={18} />
                                <span>Mark all as read ({totalUnreadCount})</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="notification-filters">
                    <button 
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        <span>All</span>
                        {filter === 'all' && totalUnreadCount > 0 && (
                            <span className="unread-badge">{totalUnreadCount}</span>
                        )}
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
                        onClick={() => setFilter('unread')}
                    >
                        <span>Unread</span>
                        {filter === 'unread' && (
                            <span className="unread-badge">{notifications.filter(n => !n.isRead).length}</span>
                        )}
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'likes' ? 'active' : ''}`}
                        onClick={() => setFilter('likes')}
                    >
                        <Heart size={16} />
                        <span>Likes</span>
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'comments' ? 'active' : ''}`}
                        onClick={() => setFilter('comments')}
                    >
                        <MessageCircle size={16} />
                        <span>Comments</span>
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'follows' ? 'active' : ''}`}
                        onClick={() => setFilter('follows')}
                    >
                        <UserPlus size={16} />
                        <span>Follows</span>
                    </button>
                </div>

                {/* Notifications List */}
                <div className="notifications-list">
                    {displayedNotifications.length === 0 && !loading ? (
                        <div className="empty-notifications">
                            <div className="empty-icon">
                                <Bell size={48} />
                            </div>
                            <h3>No notifications yet</h3>
                            <p>When you get notifications, they'll show up here.</p>
                            <button className="refresh-btn-large" onClick={handleRefresh}>
                                <RefreshCw size={18} />
                                Refresh
                            </button>
                        </div>
                    ) : (
                        displayedNotifications.map(notification => (
                            <div 
                                key={notification._id} 
                                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                                data-notification-id={notification._id}
                            >
                                <div className="notification-content">
                                    <div className="notification-icon">
                                        {getNotificationIcon(notification.type)}
                                    </div>
                                    
                                    <div className="notification-details">
                                        <Link 
                                            to={`/profile/${notification.fromUser?._id}`}
                                            className="user-link"
                                        >
                                            {notification.fromUser?.avatar ? (
                                                <img 
                                                    src={notification.fromUser.avatar} 
                                                    alt={notification.fromUser.name}
                                                    className="user-avatar"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="default-avatar">
                                                    {notification.fromUser?.name?.charAt(0) || 'U'}
                                                </div>
                                            )}
                                        </Link>
                                        
                                        <div className="message-time">
                                            <p className="notification-message">
                                                <Link 
                                                    to={`/profile/${notification.fromUser?._id}`}
                                                    className="username-link"
                                                >
                                                    {notification.fromUser?.name || 'User'}
                                                </Link>
                                                {' '}
                                                {getNotificationMessage(notification)}
                                            </p>
                                            <span className="notification-time">
                                                <Clock size={12} />
                                                {formatTime(notification.createdAt || notification.date)}
                                            </span>
                                        </div>
                                        
                                        {notification.post?.image && (
                                            <Link 
                                                to={`/post/${notification.post?._id}`}
                                                className="post-preview"
                                            >
                                                <img 
                                                    src={notification.post.image} 
                                                    alt="Post preview"
                                                    loading="lazy"
                                                />
                                            </Link>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="notification-actions">
                                    {!notification.isRead && (
                                        <button 
                                            className="mark-read-btn"
                                            onClick={() => handleMarkAsRead(notification._id)}
                                            title="Mark as read"
                                        >
                                            <Check size={16} />
                                        </button>
                                    )}
                                    <button 
                                        className="delete-btn"
                                        onClick={() => handleDeleteNotification(notification._id)}
                                        title="Delete notification"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                    
                    {loading && (
                        <div className="loading-notifications">
                            <div className="spinner"></div>
                            <span>Loading notifications...</span>
                        </div>
                    )}
                </div>

                {/* Load More */}
                {displayedNotifications.length > 0 && hasMore && (
                    <div className="notifications-footer">
                        <button 
                            className="load-more-btn" 
                            onClick={handleLoadMore}
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Load more notifications'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Notifications;