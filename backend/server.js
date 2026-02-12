import express from "express";
import dotenv from "dotenv";
import {db} from "./config/db.js"
import CookieParser from "cookie-parser";
import route from "./routes/UserRoutes.js";
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import messagemodel from "./models/MessageModel.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import usermodel from "./models/UserModel.js";
import { MulterError } from "multer";
import jwt from 'jsonwebtoken';
import notificationmodel from "./models/NotificationModel.js";

dotenv.config()
const app = express()
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    const isVercel = origin.endsWith('.vercel.app');
    const isLocal = origin.includes('localhost');

    if (isVercel || isLocal || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(CookieParser())
app.use(express.json())

// Configure multer for handling file uploads
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
}

// Setup storage for uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
})

// Create the multer instance
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
    fileFilter: function (req, file, cb) {
        // Accept images and videos only
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|mp4|webm|mov)$/)) {
            return cb(new Error('Only image and video files are allowed!'), false)
        }
        cb(null, true)
    }
})

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: ["http://15.134.234.10", "http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                 socket.handshake.query.token;
    
    if (!token) {
      console.log('Socket authentication failed: No token provided');
      return next(new Error('Authentication error: Token required'));
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_KEY);
    const user = await usermodel.findById(decoded.id).select('_id name username');
    
    if (!user) {
      console.log('Socket authentication failed: User not found');
      return next(new Error('Authentication error: User not found'));
    }

    socket.userId = user._id.toString();
    socket.userName = user.name || user.username;
    
    console.log(`Socket authenticated: ${socket.userId} (${socket.userName})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id} (User ID: ${socket.userId})`);
  
  // Join user's personal rooms
  socket.join(socket.userId); // For notifications
  socket.join(`user_${socket.userId}`); // For private messaging
  
  // Send connection confirmation
  socket.emit('connected', { 
    userId: socket.userId, 
    message: 'Connected to real-time service' 
  });
  
  // Handle join room for messaging
  socket.on("join_room", (roomData) => {
    if (roomData.roomId) {
      socket.join(roomData.roomId);
      console.log(`User ${socket.userId} joined room: ${roomData.roomId}`);
    }
  });
  
  // Handle sending messages
  socket.on("send_message", async (messageData) => {
    try {
      const { senderId, receiverId, content, _id } = messageData;
      
      console.log(`Socket message: ${senderId} -> ${receiverId}: ${content}`);
      
      // If the message already has an ID, it was already saved to DB via HTTP
      if (_id) {
        console.log(`Forwarding existing message ${_id} to recipient ${receiverId}`);
        
        socket.to(receiverId).emit("receive_message", {
          _id: _id,
          sender: senderId,
          receiver: receiverId,
          content: content,
          timestamp: new Date()
        });
        
        return;
      }
      
      // Save message to database if it doesn't have an ID yet
      const newMessage = new messagemodel({
        sender: senderId,
        receiver: receiverId,
        content: content
      });
      
      await newMessage.save();
      
      // Send message to receiver's room
      socket.to(receiverId).emit("receive_message", {
        _id: newMessage._id,
        sender: senderId,
        receiver: receiverId,
        content: content,
        timestamp: newMessage.timestamp
      });
      
      // Create notification for the message
      const notification = new notificationmodel({
        user: receiverId,
        type: 'message',
        fromUser: senderId,
        message: content,
        date: new Date(),
        isRead: false
      });
      
      await notification.save();
      
      // Populate notification
      const populatedNotification = await notificationmodel.findById(notification._id)
        .populate('fromUser', 'name avatar username');
      
      // Emit new notification to receiver
      io.to(receiverId).emit('new-notification', populatedNotification);
      
      // Update unread count for receiver
      const unreadCount = await notificationmodel.countDocuments({
        user: receiverId,
        isRead: false
      });
      
      io.to(receiverId).emit('unread-count-updated', {
        userId: receiverId,
        count: unreadCount
      });
      
      console.log(`Message saved and sent from ${senderId} to ${receiverId} with ID ${newMessage._id}`);
    } catch (error) {
      console.error("Error handling socket message:", error);
    }
  });
  
  // Handle typing indicator
  socket.on("typing", (data) => {
    socket.to(data.receiverId).emit("typing_indicator", {
      senderId: data.senderId,
      isTyping: data.isTyping
    });
  });
  // Get unread count (for Sidebar)
socket.on('get-unread-count', async () => {
  try {
    const unreadCount = await notificationmodel.countDocuments({
      user: socket.userId,
      isRead: false
    });
    
    socket.emit('unread-count-response', {
      userId: socket.userId,
      count: unreadCount
    });
  } catch (error) {
    console.error('Error getting unread count via socket:', error);
  }
});

// Send initial unread count when user joins
socket.on('join', (data) => {
  console.log(`User ${socket.userId} joined notification room`);
  socket.emit('connected', { 
    userId: socket.userId, 
    message: 'Connected to notification service' 
  });
  
  // Send initial unread count
  notificationmodel.countDocuments({
    user: socket.userId,
    isRead: false
  }).then(count => {
    socket.emit('unread-count-response', {
      userId: socket.userId,
      count: count
    });
  });
});
  // NOTIFICATION EVENTS
  
  // Mark notification as read
  socket.on('mark-notification-read', async (data) => {
    try {
      const { notificationId } = data;
      
      const notification = await notificationmodel.findById(notificationId);
      
      if (!notification) {
        console.error('Notification not found:', notificationId);
        return;
      }
      
      // Verify notification belongs to user
      if (notification.user.toString() !== socket.userId) {
        console.error('Unauthorized: User does not own this notification');
        return;
      }
      
      // Update notification
      notification.isRead = true;
      await notification.save();
      
      // Emit to user's room
      io.to(socket.userId).emit('notification-read', {
        notificationId: notification._id
      });
      
      // Update unread count
      const unreadCount = await notificationmodel.countDocuments({
        user: socket.userId,
        isRead: false
      });
      
      io.to(socket.userId).emit('unread-count-updated', {
        userId: socket.userId,
        count: unreadCount
      });
      
      console.log(`Notification ${notificationId} marked as read by user ${socket.userId}`);
    } catch (error) {
      console.error('Error marking notification as read via socket:', error);
    }
  });
  
  // Delete notification
  socket.on('delete-notification', async (data) => {
    try {
      const { notificationId } = data;
      
      const notification = await notificationmodel.findById(notificationId);
      
      if (!notification) {
        console.error('Notification not found:', notificationId);
        return;
      }
      
      // Verify notification belongs to user
      if (notification.user.toString() !== socket.userId) {
        console.error('Unauthorized: User does not own this notification');
        return;
      }
      
      // Delete the notification
      await notificationmodel.findByIdAndDelete(notificationId);
      
      // Emit to user's room
      io.to(socket.userId).emit('notification-deleted', {
        notificationId
      });
      
      // Update unread count if needed
      if (!notification.isRead) {
        const unreadCount = await notificationmodel.countDocuments({
          user: socket.userId,
          isRead: false
        });
        
        io.to(socket.userId).emit('unread-count-updated', {
          userId: socket.userId,
          count: unreadCount
        });
      }
      
      console.log(`Notification ${notificationId} deleted by user ${socket.userId}`);
    } catch (error) {
      console.error('Error deleting notification via socket:', error);
    }
  });
  
  // Mark all notifications as read
  socket.on('mark-all-notifications-read', async () => {
    try {
      await notificationmodel.updateMany(
        { user: socket.userId, isRead: false },
        { isRead: true }
      );
      
      // Emit to user's room
      io.to(socket.userId).emit('all-notifications-read', {
        userId: socket.userId
      });
      
      // Update unread count
      io.to(socket.userId).emit('unread-count-updated', {
        userId: socket.userId,
        count: 0
      });
      
      console.log(`All notifications marked as read for user ${socket.userId}`);
    } catch (error) {
      console.error('Error marking all notifications as read via socket:', error);
    }
  });
  
  // Get unread count
  socket.on('get-unread-count', async () => {
    try {
      const unreadCount = await notificationmodel.countDocuments({
        user: socket.userId,
        isRead: false
      });
      
      socket.emit('unread-count-response', {
        userId: socket.userId,
        count: unreadCount
      });
    } catch (error) {
      console.error('Error getting unread count via socket:', error);
    }
  });
  
  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id} (User ID: ${socket.userId})`);
  });
});

// Attach io to request object for use in controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(route)
app.use('/uploads', express.static(uploadsDir))

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    websocket: io ? 'connected' : 'disconnected'
  });
});

// Handle file uploads
app.post('/api/upload', (req, res) => {
  upload.single('avatar')(req, res, function(err) {
    if (err) {
      console.error('Multer error:', err);
      // Handle Multer errors properly
      if (err.name === 'MulterError') {
        return res.status(400).json({ 
          message: `File upload error: ${err.message}`, 
          success: false 
        });
      } else {
        return res.status(500).json({ 
          message: `Unexpected error: ${err.message}`, 
          success: false 
        });
      }
    }

    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No file uploaded', 
        success: false 
      });
    }
    
    // Return the file path that can be stored in the database
    const filePath = `/uploads/${req.file.filename}`;
    return res.status(200).json({ 
      message: 'File uploaded successfully', 
      success: true,
      filePath: filePath
    });
  });
})

// Endpoint to update user avatar specifically
app.patch('/api/user/:id/avatar', (req, res) => {
  upload.single('avatar')(req, res, async function(err) {
    if (err) {
      console.error('Multer error:', err);
      // Handle Multer errors properly
      if (err.name === 'MulterError') {
        return res.status(400).json({ 
          message: `File upload error: ${err.message}`, 
          success: false 
        });
      } else {
        return res.status(500).json({ 
          message: `Unexpected error: ${err.message}`, 
          success: false 
        });
      }
    }

    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No file uploaded', 
        success: false 
      });
    }

    try {
      const userId = req.params.id
      const filePath = `/uploads/${req.file.filename}`
      console.log('Updating avatar for user:', userId, 'with file:', filePath)
      
      // Find the user and update their avatar using the User model directly
      const updateResult = await usermodel.findByIdAndUpdate(
          userId,
          { $set: { avatar: filePath } },
          { new: true }
      )
      
      if (!updateResult) {
          console.error('User not found:', userId)
          return res.status(404).json({ message: 'User not found', success: false })
      }
      
      console.log('Avatar updated successfully for user:', userId)
      return res.status(200).json({
          message: 'Avatar updated successfully',
          success: true,
          avatar: filePath
      })
    } catch (error) {
      console.error('Avatar update error:', error)
      return res.status(500).json({ message: 'Avatar update failed', success: false })
    }
  });
})

// Use server.listen instead of app.listen for Socket.io
server.listen(process.env.PORT, (error) => {
  console.log("Server Running on Port " + process.env.PORT);
  console.log("WebSocket server initialized for real-time notifications");
});

// Handle server shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

export { io };