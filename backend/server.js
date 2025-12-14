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

dotenv.config()
const app = express()
app.use(cors())
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
    origin: ["http://localhost:3000", "http://localhost:3001"], // Allow connections from React frontend
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);
  
  // Join a room for private messaging
  socket.on("join_room", (userId) => {
    socket.join(userId);
    console.log(`User with ID: ${userId} joined room: ${userId}`);
  });
  
  // Handle sending messages
  socket.on("send_message", async (messageData) => {
    try {
      const { senderId, receiverId, content, _id } = messageData;
      
      console.log(`Socket message: ${senderId} -> ${receiverId}: ${content}`);
      
      // If the message already has an ID, it was already saved to DB via HTTP
      // Just forward it to the recipient
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
  
  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User Disconnected: ${socket.id}`);
  });
});

app.use(route)
app.use('/uploads', express.static(uploadsDir))

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
});