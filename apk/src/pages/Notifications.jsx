import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/Notifications.css';
import { Link } from 'react-router-dom';
import { 
    Heart, MessageCircle, UserPlus, Bell, Globe, 
    Clock, Check, CheckCircle, MoreVertical, Settings,
    Trash2, Filter 
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
    }, []);

    const fetchNotifications = useCallback(async (pageNum = 1, reset = true) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');
            
            // Build query parameters
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
            // 'all' filter doesn't need additional params
            
            const response = await axios.get(
                `http://localhost:30801/user/${userId}/notifications`,
                {
                    params,
                    headers: { Authorization: `Bearer ${token}` }
                }
            );

            if (reset || pageNum === 1) {
                setNotifications(response.data.notifications || []);
            } else {
                setNotifications(prev => [...prev, ...(response.data.notifications || [])]);
            }
            
            setUnreadCount(response.data.unreadCount || 0);
            setHasMore(response.data.notifications && response.data.notifications.length === 15);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchNotifications(1, true);
        setPage(1);
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
            
            setNotifications(prev => prev.map(notif => 
                notif._id === notificationId ? { ...notif, isRead: true } : notif
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const token = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');
            
            // FIX: Changed from POST to GET to match backend route
            await axios.get(
                `http://localhost:30801/user/${userId}/notification`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Mark all notifications as read in state
            setNotifications(prev => prev.map(notif => ({ 
                ...notif, 
                isRead: true 
            })));
            
            // Reset unread count
            setUnreadCount(0);
            
            // Refetch notifications to sync with server
            fetchNotifications(1, true);
            
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            const token = localStorage.getItem('accessToken');
            const userId = localStorage.getItem('userId');
            
            await axios.delete(
                `http://localhost:30801/user/notification/${notificationId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // Remove from state
            setNotifications(prev => prev.filter(notif => notif._id !== notificationId));
            
            // Update unread count if the deleted notification was unread
            const deletedNotif = notifications.find(n => n._id === notificationId);
            if (deletedNotif && !deletedNotif.isRead) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
            
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
            default:
                return <Globe className="default-icon" size={20} />;
        }
    };

    const getNotificationMessage = (notification) => {
        const username = notification.fromUser?.name || 'Someone';
        
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
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    };

    const handleLoadMore = () => {
        if (hasMore && !loading) {
            const nextPage = page + 1;
            fetchNotifications(nextPage, false);
            setPage(nextPage);
        }
    };

    // Filter notifications in memory if backend doesn't support it
    const getFilteredNotifications = () => {
        if (filter === 'all') return notifications;
        if (filter === 'unread') return notifications.filter(n => !n.isRead);
        if (filter === 'likes') return notifications.filter(n => n.type === 'like');
        if (filter === 'comments') return notifications.filter(n => n.type === 'comment');
        if (filter === 'follows') return notifications.filter(n => n.type === 'follow');
        return notifications;
    };

    const filteredNotifications = getFilteredNotifications();

    return (
        <div className="notifications-page">
            <Sidebar user={user} />
            
            <main className="notifications-main-content">
                {/* Header */}
                <div className="notifications-header">
                    <h1>Notifications</h1>
                    <div className="header-actions">
                        {unreadCount > 0 && (
                            <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                                <CheckCircle size={18} />
                                <span>Mark all as read</span>
                            </button>
                        )}
                        <button className="settings-btn">
                            <Settings size={20} />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="notification-filters">
                    <button 
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        <span>All</span>
                        {filter === 'all' && unreadCount > 0 && (
                            <span className="unread-badge">{unreadCount}</span>
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
                    {filteredNotifications.length === 0 && !loading ? (
                        <div className="empty-notifications">
                            <div className="empty-icon">
                                <Bell size={48} />
                            </div>
                            <h3>No notifications yet</h3>
                            <p>When you get notifications, they'll show up here.</p>
                        </div>
                    ) : (
                        filteredNotifications.map(notification => (
                            <div 
                                key={notification._id} 
                                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
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
                                            {notification.fromUser?.avatar && (
                                                <img 
                                                    src={notification.fromUser.avatar} 
                                                    alt={notification.fromUser.name}
                                                    className="user-avatar"
                                                />
                                            )}
                                        </Link>
                                        
                                        <div className="message-time">
                                            <p className="notification-message">
                                                <Link 
                                                    to={`/profile/${notification.fromUser?._id}`}
                                                    className="username-link"
                                                >
                                                    {notification.fromUser?.name}
                                                </Link>
                                                {' '}
                                                {getNotificationMessage(notification)}
                                            </p>
                                            <span className="notification-time">
                                                <Clock size={12} />
                                                {formatTime(notification.date)}
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
                                    <button className="more-btn">
                                        <MoreVertical size={16} />
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

                {/* Footer Actions */}
                {filteredNotifications.length > 0 && hasMore && (
                    <div className="notifications-footer">
                        <button 
                            className="load-more-btn" 
                            onClick={handleLoadMore}
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Load more'}
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Notifications;