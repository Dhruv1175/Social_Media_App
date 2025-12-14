import mongoose from "mongoose";

const activitylogstruct = mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    action:{
        type:String,
        enum:['login','logout','post','comment','like'],
        required:true
    },
    details:{
        type:String
    },
    date:{
        type:Date,
        default:Date.now
    }
})

const activitylogmodel = mongoose.model('ActivityLog',activitylogstruct)
export default activitylogmodel