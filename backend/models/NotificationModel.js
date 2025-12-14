import mongoose from "mongoose";

const notificationstruct  = mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    type:{
        type:String,
        enum: ['like','comment','follow','message'],
        required:true
    },
    post:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Post'
    },
    fromUser:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    date:{
        type:Date,
        default : Date.now
    },
    isRead:{
        type:Boolean,
        default:false
    }
})

const notificationmodel  = mongoose.model('Notification',notificationstruct)
export default notificationmodel