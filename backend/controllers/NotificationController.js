import NotificationModel from "../models/NotificationModel.js";

// Get notifications with filtering
export const getNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            page = 1, 
            limit = 15, 
            type, 
            isRead,
            since // For real-time updates
        } = req.query;
        
        const skip = (page - 1) * limit;
        
        // Build query object
        const query = { user: userId };
        
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (isRead !== undefined) {
            query.isRead = isRead === 'true';
        }
        
        // For real-time updates: get notifications after a specific ID
        if (since) {
            const sinceNotification = await NotificationModel.findById(since);
            if (sinceNotification) {
                query.date = { $gt: sinceNotification.date };
            }
        }
        
        // Fetch notifications with pagination
        const notifications = await NotificationModel.find(query)
            .populate('fromUser', 'name avatar username')
            .populate('post', 'image')
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        // Get counts
        const total = await NotificationModel.countDocuments(query);
        const unreadCount = await NotificationModel.countDocuments({
            user: userId,
            isRead: false
        });
        
        // Determine if there are more notifications
        const hasMore = total > skip + notifications.length;
        
        // Emit real-time update if socket is available
        if (req.io && page === 1) {
            req.io.to(userId).emit('notifications-updated', {
                userId,
                count: notifications.length,
                unreadCount
            });
        }
        
        res.status(200).json({
            success: true,
            notifications,
            total,
            unreadCount,
            hasMore,
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
};

// Get new notifications since last check
export const getNewNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const { since } = req.query;
        
        if (!since) {
            return res.status(400).json({
                success: false,
                message: 'Since parameter is required'
            });
        }
        
        const query = { 
            user: userId,
            date: { $gt: new Date(since) }
        };
        
        const newNotifications = await NotificationModel.find(query)
            .populate('fromUser', 'name avatar username')
            .populate('post', 'image')
            .sort({ date: -1 })
            .limit(50);
            
        const newCount = await NotificationModel.countDocuments({
            user: userId,
            isRead: false,
            date: { $gt: new Date(since) }
        });
        
        res.status(200).json({
            success: true,
            notifications: newNotifications,
            newCount,
            lastChecked: new Date()
        });
        
    } catch (error) {
        console.error('Error getting new notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get new notifications'
        });
    }
};

// Mark single notification as read
export const markNotificationAsRead = async (req, res) => {
    try {
        const { userId, notificationId } = req.params;
        
        // Verify notification belongs to user
        const notification = await NotificationModel.findOne({
            _id: notificationId,
            user: userId
        });
        
        if (!notification) {
            return res.status(404).json({ 
                success: false, 
                message: "Notification not found or unauthorized" 
            });
        }
        
        // Update notification
        notification.isRead = true;
        await notification.save();
        
        // Populate for response
        const populatedNotification = await NotificationModel.findById(notificationId)
            .populate('fromUser', 'name avatar username')
            .populate('post', 'image');
        
        // Emit real-time event
        if (req.io) {
            req.io.to(userId).emit('notification-read', {
                notificationId,
                userId
            });
            
            // Update unread count for user
            const unreadCount = await NotificationModel.countDocuments({
                user: userId,
                isRead: false
            });
            
            req.io.to(userId).emit('unread-count-updated', {
                userId,
                count: unreadCount
            });
        }
        
        res.status(200).json({ 
            success: true, 
            notification: populatedNotification,
            message: "Notification marked as read"
        });
        
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ 
            success: false, 
            message: "Something went wrong",
            error: error.message
        });
    }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Update all unread notifications
        const result = await NotificationModel.updateMany(
            { 
                user: userId, 
                isRead: false 
            }, 
            { 
                isRead: true 
            }
        );

        // Emit real-time event
        if (req.io) {
            req.io.to(userId).emit('all-notifications-read', {
                userId,
                count: result.modifiedCount
            });
            
            req.io.to(userId).emit('unread-count-updated', {
                userId,
                count: 0
            });
        }

        res.status(200).json({ 
            success: true, 
            message: "All notifications marked as read.",
            modifiedCount: result.modifiedCount
        });
        
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ 
            success: false, 
            message: "Something went wrong.",
            error: error.message
        });
    }
};

// Get unread notifications count
export const getUnreadCount = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const count = await NotificationModel.countDocuments({ 
            user: userId, 
            isRead: false 
        });
        
        res.status(200).json({ 
            success: true, 
            count,
            userId
        });
        
    } catch (error) {
        console.error("Error getting unread count:", error);
        res.status(500).json({ 
            success: false, 
            message: "Something went wrong",
            error: error.message
        });
    }
};

// Delete single notification
export const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user?.id || req.query.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User ID required"
            });
        }
        
        // Verify notification belongs to user
        const notification = await NotificationModel.findOne({
            _id: notificationId,
            user: userId
        });
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found or unauthorized"
            });
        }
        
        // Check if it was unread before deletion
        const wasUnread = !notification.isRead;
        
        // Delete the notification
        await NotificationModel.findByIdAndDelete(notificationId);
        
        // Emit real-time event
        if (req.io) {
            req.io.to(userId).emit('notification-deleted', {
                notificationId,
                userId
            });
            
            // Update unread count if needed
            if (wasUnread) {
                const unreadCount = await NotificationModel.countDocuments({
                    user: userId,
                    isRead: false
                });
                
                req.io.to(userId).emit('unread-count-updated', {
                    userId,
                    count: unreadCount
                });
            }
        }
        
        res.status(200).json({
            success: true,
            message: "Notification deleted successfully"
        });
        
    } catch (error) {
        console.error("Error deleting notification:", error);
        res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message
        });
    }
};

// Clear all notifications
export const clearAllNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Delete all notifications for user
        const result = await NotificationModel.deleteMany({ user: userId });
        
        // Emit real-time event
        if (req.io) {
            req.io.to(userId).emit('all-notifications-cleared', {
                userId,
                count: result.deletedCount
            });
            
            req.io.to(userId).emit('unread-count-updated', {
                userId,
                count: 0
            });
        }
        
        res.status(200).json({
            success: true,
            message: "All notifications cleared",
            deletedCount: result.deletedCount
        });
        
    } catch (error) {
        console.error("Error clearing all notifications:", error);
        res.status(500).json({
            success: false,
            message: "Something went wrong",
            error: error.message
        });
    }
};

// Create notification (utility function for other controllers)
export const createNotification = async (data, io = null) => {
    try {
        const { userId, type, fromUser, post, message } = data;
        
        const notification = new NotificationModel({
            user: userId,
            type,
            fromUser,
            post,
            message,
            date: new Date(),
            isRead: false
        });
        
        await notification.save();
        
        // Populate the notification
        const populatedNotification = await NotificationModel.findById(notification._id)
            .populate('fromUser', 'name avatar username')
            .populate('post', 'image');
        
        // Emit WebSocket event if io is provided
        if (io) {
            io.to(userId.toString()).emit('new-notification', populatedNotification);
            
            // Update unread count
            const unreadCount = await NotificationModel.countDocuments({
                user: userId,
                isRead: false
            });
            
            io.to(userId.toString()).emit('unread-count-updated', {
                userId,
                count: unreadCount
            });
        }
        
        return populatedNotification;
    } catch (error) {
        console.error("Error creating notification:", error);
        return null;
    }
};

// Get notification statistics
export const getNotificationStats = async (req, res) => {
    try {
        const { userId } = req.params;
        const mongoose = await import('mongoose');
        
        const totalCount = await NotificationModel.countDocuments({ user: userId });
        const unreadCount = await NotificationModel.countDocuments({ 
            user: userId, 
            isRead: false 
        });
        
        // Count by type
        const typeCounts = await NotificationModel.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { $group: { 
                _id: '$type', 
                count: { $sum: 1 },
                unread: { 
                    $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } 
                }
            }}
        ]);
        
        // Recent activity
        const recentActivity = await NotificationModel.find({ user: userId })
            .sort({ date: -1 })
            .limit(5)
            .populate('fromUser', 'name avatar')
            .select('type date isRead');
        
        res.status(200).json({
            success: true,
            stats: {
                total: totalCount,
                unread: unreadCount,
                byType: typeCounts.reduce((acc, curr) => {
                    acc[curr._id] = { total: curr.count, unread: curr.unread };
                    return acc;
                }, {}),
                recentActivity
            }
        });
        
    } catch (error) {
        console.error("Error getting notification stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get notification statistics"
        });
    }
};