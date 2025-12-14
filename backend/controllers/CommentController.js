import commentmodel from "../models/CommentModel.js";
import notificationmodel from "../models/NotificationModel.js";
import postmodel from "../models/PostModel.js";


export const addComment = async(req,res) => {
    try{
        const {userid,postid} = req.params;
        const {text} = req.body;
        const exist= await postmodel.findOne({_id:postid})
        if(exist){
            const comdata =  new commentmodel({user:userid,post:postid,text:text})
            await comdata.save()
            if(comdata){
                const notification = new notificationmodel({user:exist.user,type:'comment',comment:comdata._id || null ,fromUser:userid})
                await notification.save()
                res.status(200).send({message:"Comment Added",success:true})
            }
            else {
                res.status(200).send({message:"Could Not Add Comment",success:false})
            }
        }
        else{
            res.status(200).send({message:"Could Not Find The Post ",success:false})
        }
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong ",success:false})
    }
}

export const getComment = async(req,res) => {
    try{
        const {postid} = req.params;
        const exist = await postmodel.findOne({_id:postid})
        if(exist){
            const comdata = await commentmodel.find({post:postid})
            if(comdata){
                res.status(200).send({comdata,success:true})
            }
            else res.status(200).send({message:"No Comments Found !",success:false})
        }
        else res.status(200).send({message:"Post Not Found !",success:false})
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}

export const updateComment = async(req,res) => {
    try{
        const {commentid} = req.params;
        const {text} = req.body;
        const exist = await commentmodel.findOne({_id:commentid})
        if(exist){
            const comdata = await commentmodel.findByIdAndUpdate(commentid,{text:text})
            if(comdata){
                res.status(200).send({message:"Comment Edited !",success:true})
            }
            else res.status(200).send({message:"Could Not Edit Comment",success:false})
        }
        else res.status(200).send({message:"Comment Not Found",success:false})
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}

export const deleteComment = async(req,res) => {
    try{
        const {commentid} = req.params;
        const exist = await commentmodel.findOne({_id:commentid})
        if(exist){
            const comdata = await commentmodel.findByIdAndDelete(commentid)
            if(comdata){
                res.status(200).send({message:"Comment Deleted !",success:true})
            }
            else res.status(200).send({message:"Could Not Delete Comment",success:false})
        }
        else res.status(200).send({message:"Comment Not Found",success:false})
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}