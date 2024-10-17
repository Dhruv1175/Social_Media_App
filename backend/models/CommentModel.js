import mongoose from "mongoose";

const commentstruct = mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    post:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Post'
    },
    text:{
        type:String,
        required:true
    },
    date:{
        type:Date,
        default:Date.now
    }
})

const commentmodel = mongoose.model('Comment',commentstruct)
export default commentmodel