import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const db = mongoose.connect(process.env.MONGO_URI+"@social-media-app.s9dpeeb.mongodb.net/SocialApp?appName=Social-Media-App",{useNewUrlParser: true,
    useUnifiedTopology: true}).then(()=>{
    console.log("Database has been connected successfully")
}).catch((error)=>{
    console.log(error)
})