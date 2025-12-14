import mongoose from "mongoose";

const conversationstruct  = mongoose.Schema({
    participants:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    }],
    messages:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Message'
    }],
    lastUpdated : {
        type:Date,
        default : Date.now
    }
});

const conversationmodel = mongoose.model('Conversation',conversationstruct)
export default conversationmodel