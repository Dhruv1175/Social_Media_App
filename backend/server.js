import express from "express";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import {db} from "./config/db.js"
import CookieParser from "cookie-parser";
import route from "./routes/UserRoutes.js";
import cors from 'cors';
import { Socket } from "socket.io";
dotenv.config()
const app = express()
app.use(cors())
app.use(CookieParser())
app.use(express.json())
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3080', // Your frontend URL
        methods: ['GET', 'POST']
    }
});
global.io = io;

// Handle WebSocket connections
io.on('connection', (socket) => {
    const token = socket.handshake.headers['authorization'];
    if (token) {
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_KEY); // Decode token to get userId
        const userId = decodedToken.id;
        socket.join(userId);
    }
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.use(route)



app.listen(process.env.PORT,(error)=>{
    console.log("Server Running on Port "+process.env.PORT)
})