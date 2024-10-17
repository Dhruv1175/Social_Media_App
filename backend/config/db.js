import mongoose from "mongoose";

export const db = mongoose.connect("mongodb://localhost:27017/Appdetails",{useNewUrlParser: true,
    useUnifiedTopology: true}).then(()=>{
    console.log("Database has been connected successfully")
}).catch((error)=>{
    console.log(error)
})