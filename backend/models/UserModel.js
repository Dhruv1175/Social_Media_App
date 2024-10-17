import mongoose from "mongoose";

const userstruct = mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    avatar:{
        type:String
    },
    bio:{
        type:String
    },
    followers:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
    following:[{type:mongoose.Schema.Types.ObjectId,ref:'User'}],
    date:{
        type:Date,
        default:Date.now
    }
})

const usermodel = mongoose.model('User',userstruct)
export default usermodel