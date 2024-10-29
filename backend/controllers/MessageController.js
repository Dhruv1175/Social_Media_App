import messagemodel from "../models/MessageModel.js";



export const sendMessage = async (req,res) => {
    try{
        const {userid,receiverid} = req.params;
        const content = req.body;
        const messagedetails = new messagemodel({sender:userid,receiver:receiverid,content:content})
        await messagedetails.save();
        if(messagedetails){
            res.status(200).send({success:true})
        }
        else res.status(200).send({success:false})
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}

export const getMessage = async (req,res) => {
    try{
        const {userid} = req.params;
        const messagedetails = await messagemodel.find({receiver:userid})/populate('message','name avatar')
        if (messagedetails){
            res.status(200).send({messagedetails,success:true})
        }
        else{
            res.status(200).send({message:"Could No Find Messages",success:false})
        }
    }
    catch(error){
        res.status(500).send({message:"Something Went  Wrong",success:false})
    }
}