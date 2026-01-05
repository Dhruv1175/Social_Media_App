import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import UserModel from '../models/UserModel.js';
import NotificationModel from '../models/NotificationModel.js';

let io;

// Initialize WebSocket server
export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        },
        transports: ['websocket', 'polling']
    });

    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || 
                         socket.handshake.query.token;
            
            if (!token) {
                return next(new Error('Authentication error: Token required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await UserModel.findById(decoded.id).select('_id name');
            
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.userId = user._id.toString();
            socket.userName = user.name;
            
            next();
        } catch (error) {
            console.error('Socket authentication error:', error.message);
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId} (${socket.userName})`);
        
        // Join user's personal room for notifications
        socket.join(socket.userId);
        
        // Handle join events
        socket.on('join', (data) => {
            console.log(`User ${socket.userId} joined notification room`);
            socket.emit('connected', { 
                userId: socket.userId, 
                message: 'Connected to notification service' 
            });
        });

        // Handle mark as read
        socket.on('mark-read', async (data) => {
            try {
                const { notificationId } = data;
                
                await NotificationModel.findByIdAndUpdate(notificationId, {
                    isRead: true
                });
                
                // Notify user
                socket.emit('notification-read', { notificationId });
                
                // Broadcast to user's room
                io.to(socket.userId).emit('notification-read', { notificationId });
                
                // Update unread count
                const unreadCount = await NotificationModel.countDocuments({
                    user: socket.userId,
                    isRead: false
                });
                
                io.to(socket.userId).emit('unread-count-updated', {
                    count: unreadCount
                });
                
            } catch (error) {
                console.error('Error marking notification as read via socket:', error);
            }
        });

        // Handle delete notification
        socket.on('delete-notification', async (data) => {
            try {
                const { notificationId } = data;
                
                await NotificationModel.findByIdAndDelete(notificationId);
                
                // Broadcast to user's room
                io.to(socket.userId).emit('notification-deleted', { notificationId });
                
            } catch (error) {
                console.error('Error deleting notification via socket:', error);
            }
        });

        // Handle mark all as read
        socket.on('mark-all-read', async () => {
            try {
                await NotificationModel.updateMany(
                    { user: socket.userId, isRead: false },
                    { isRead: true }
                );
                
                // Broadcast to user's room
                io.to(socket.userId).emit('all-notifications-read');
                io.to(socket.userId).emit('unread-count-updated', { count: 0 });
                
            } catch (error) {
                console.error('Error marking all as read via socket:', error);
            }
        });

        // Handle ping/pong for connection health
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            console.log(`User disconnected: ${socket.userId} - ${reason}`);
            socket.leave(socket.userId);
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error(`Socket error for user ${socket.userId}:`, error);
        });
    });

    // Periodic connection health check
    setInterval(() => {
        io.emit('ping', { timestamp: Date.now() });
    }, 30000); // Every 30 seconds

    return io;
};

// Get io instance
export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

// Send notification to specific user
export const sendNotificationToUser = (userId, notification) => {
    if (!io) return;
    
    io.to(userId.toString()).emit('new-notification', notification);
    
    // Also update unread count
    NotificationModel.countDocuments({
        user: userId,
        isRead: false
    }).then(count => {
        io.to(userId.toString()).emit('unread-count-updated', { count });
    });
};

// Broadcast notification to multiple users
export const broadcastNotification = (userIds, notification) => {
    if (!io) return;
    
    userIds.forEach(userId => {
        io.to(userId.toString()).emit('new-notification', notification);
    });
};