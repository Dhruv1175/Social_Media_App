import mongoose from "mongoose";

const followstruct = mongoose.Schema({
    follower:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    following:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    date:{
        type:Date,
        default:Date.now
    }
})

const followermodel = mongoose.model('Follow', followstruct)
export default followermodel