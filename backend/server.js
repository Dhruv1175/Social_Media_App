import express from "express";
import dotenv from "dotenv";
import {db} from "./config/db.js"
import CookieParser from "cookie-parser";
import route from "./routes/UserRoutes.js";
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import messagemodel from "./models/MessageModel.js";

dotenv.config()
const app = express()
app.use(cors())
app.use(CookieParser())
app.use(express.json())

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Allow connections from React frontend
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
      const { senderId, receiverId, content } = messageData;
      
      // Save message to database
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
        content: content,
        timestamp: newMessage.timestamp
      });
      
      console.log(`Message sent from ${senderId} to ${receiverId}`);
    } catch (error) {
      console.error("Error sending message:", error);
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

// Use server.listen instead of app.listen for Socket.io
server.listen(process.env.PORT, (error) => {
  console.log("Server Running on Port " + process.env.PORT);
});