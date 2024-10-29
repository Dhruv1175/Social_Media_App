import express from "express";
import dotenv from "dotenv";
import {db} from "./config/db.js"
import CookieParser from "cookie-parser";
import route from "./routes/UserRoutes.js";
import cors from 'cors';

dotenv.config()
const app = express()
app.use(cors())
app.use(CookieParser())
app.use(express.json())




app.use(route)



app.listen(process.env.PORT,(error)=>{
    console.log("Server Running on Port "+process.env.PORT)
})