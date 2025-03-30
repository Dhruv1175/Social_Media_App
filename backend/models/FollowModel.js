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

// Add a compound index to ensure uniqueness of follower and following combination
followstruct.index({ follower: 1, following: 1 }, { unique: true });

const followermodel = mongoose.model('Follow', followstruct)
export default followermodel