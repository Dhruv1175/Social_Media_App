import followermodel from "../models/FollowModel.js";
import notificationmodel from "../models/NotificationModel.js";



export const toggleFollow = async (req,res) => {
    try{
        const {userid,followid} = req.params;
        const exists =  await followermodel.findOne({follower:userid,following:followid})
        if(exists){
            await followermodel.findOneAndDelete({follower:userid,following:followid})
            res.status(200).send({message:"Gooned",success:true})
        }
        else{
            const followdetails = new followermodel({follower:userid,following:followid})
            await followdetails.save()
            const notification = new notificationmodel({user:followid,type:'follow',fromUser:userid})
            await notification.save()
            res.status(200).send({message:"Rizzed",success:true})
        }
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}

export const getFollow = async (req,res) => {
    try{
        const {userid} = req.params;
        const followdetails = await followermodel.find({following:userid}).populate('follower', 'name avatar');
        if (followdetails.length > 0) {
            res.status(200).send({ followdetails, success: true });
        } else {
            res.status(200).send({ message: "No followers found", success: false });
        }
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}

export const getFollowing = async (req,res) => {
    try{
        const {userid} = req.params;
        const followdetails = await followermodel.find({follower:userid}).populate('following','name avatar')
        if(followdetails.length > 0){
            res.status(200).send({followdetails,success:true})
        }
        else{
            res.status(200).send({message:"No Following",success:false})
        }
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong" , success:false})
    }
}