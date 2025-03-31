import mongoose from "mongoose";

const poststruct = mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    text:{
        type:String,
        required:true
    },
    image:{
        type:String
    },
    video:{
        type:String
    },
    postType:{
        type:String,
        enum: ['post', 'reel'],
        default: 'post'
    },
    like:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
    comments:{type:mongoose.Schema.Types.ObjectId,ref:'Comment'},
    date:{
        type:Date,
        default:Date.now
    }
})

const postmodel = mongoose.model('Post',poststruct)
export default postmodel