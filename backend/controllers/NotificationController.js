import notificationmodel from "../models/NotificationModel.js";
import usermodel from "../models/UserModel.js";

// In NotificationController.js (backend)
export const getNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 15, type, unread } = req.query;
        
        const skip = (page - 1) * limit;
        
        // Build query object
        const query = { userId };
        
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (unread === 'true') {
            query.isRead = false;
        }
        
        const notifications = await Notification.find(query)
            .populate('fromUser', 'name avatar username')
            .populate('post', 'image')
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({
            userId,
            isRead: false
        });
        
        res.json({
            success: true,
            notifications,
            total,
            unreadCount,
            hasMore: total > skip + notifications.length
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications'
        });
    }
};

export const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        
        const notification = await notificationmodel.findByIdAndUpdate(
            notificationId,
            { isRead: true },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).send({ 
                success: false, 
                message: "Notification not found" 
            });
        }
        
        res.status(200).send({ 
            success: true, 
            notification 
        });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).send({ 
            success: false, 
            message: "Something went wrong" 
        });
    }
};

export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const { userid } = req.params;
        await notificationmodel.updateMany(
            { user: userid, isRead: false }, 
            { isRead: true }
        );

        res.status(200).send({ success: true, message: "All notifications marked as read." });
    } catch (error) {
        res.status(500).send({ success: false, message: "Something went wrong." });
    }
};

export const getUnreadCount = async (req, res) => {
    try {
        const { userid } = req.params;
        const count = await notificationmodel.countDocuments({ 
            user: userid, 
            isRead: false 
        });
        
        res.status(200).send({ 
            success: true, 
            count 
        });
    } catch (error) {
        console.error("Error getting unread count:", error);
        res.status(500).send({ 
            success: false, 
            message: "Something went wrong" 
        });
    }
};
