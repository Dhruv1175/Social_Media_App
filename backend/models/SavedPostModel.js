import mongoose from "mongoose";

const savedpoststruct  = mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
    post:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Post'
    },
    date:{
        type:Date,
        default:Date.now
    }
});

const savedpostmodel = mongoose.model('SavedPost' , savedpoststruct)
export default savedpostmodel