import mongoose from "mongoose";

const likestruct = mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    post:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Post'
    },
    comment:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Comment'
    },
    type:{
        type:String,
        enum: ['post', 'comment'],
        default: 'post'
    },
    date:{
        type:Date,
        default:Date.now
    }
});

const likemodel = mongoose.model('Like',likestruct)
export default likemodel