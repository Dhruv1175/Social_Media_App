import postmodel from "../models/PostModel.js"
import usermodel from "../models/UserModel.js"
import followermodel from "../models/FollowModel.js"

export const createPost = async(req,res)=>{
    try{
        const {userid} = req.params
        const{text,image,video} = req.body
        const post = new postmodel({user:userid,text:text,image:image,video:video})
        await post.save()
        if(post){
            res.status(200).send({message:"Post uploaded Successfully",success:true})
        }
        else{
            res.status(200).send({message:"Post Unsuccessful",success:false})
        }
    }
    catch(error){
        res.status(200).send({message:"Something Went Wrong", success:false})
    }
}

export const getPost = async(req,res)=>{
    try{
    const data = await postmodel.find()
    if(data){
        res.status(200).send({data,success:true})
    }
    else{
        res.status(200).send({message:"Could Not Fetch Data",success:false})
    }
}
catch(error){
    res.status(500).send({message:"Something Went Wrong",success:false})
}
}

export const getUserPost = async(req,res)=>{
    try{
    const {userid} = req.params;
    const data = await postmodel.find({user:userid})
    if(data){
        res.status(200).send({data,success:true})
    }
    else{
        res.status(200).send({message:"Could Not Fetch Data",success:false})
    }
}
catch(error){
    res.status(500).send({message:"Something Went Wrong",success:false})
}
}

export const getOnePost = async (req,res) =>{
    try{
    const {postid}=req.params;
        const data = await postmodel.find({_id:postid})
        if(data){
            res.status(200).send({data,success:true})
        }
        else res.status(401).send({message:"Could Not Perform The Following Action",success:false})
}
catch(error){
    res.status(500).send({message:"Something Went Wrong"})
}
}

export const updatePost = async(req,res) => {
    try{
        const {postid} = req.params;
        const {text,video,images} = req.body
        const updateFields = {};

        if (text) updateFields.text = text;
        if (video) updateFields.video = video;
        if (images) updateFields.images = images;
        const updatedetails  = await postmodel.findByIdAndUpdate(postid,{$set:updateFields},{new:true})
        if(updatedetails){
            res.status(200).send({message:"Update Successful",success:true})
        }
        else{
            res.status(200).send({message:"Could Not Perform The Actions",success:false})
        }
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}

export const deletePost = async(req,res) => {
    try{
        const {postid} = req.params;
        const deldata = await postmodel.findByIdAndDelete({_id:postid})
        if(deldata){
            res.status(200).send({message:"Data Deleted!!",success:true})
        }
        else res.status(200).send({message:"Could Not Perform The Action",success:false})
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}

export const feed = async(req,res) => {
  
        try {
            const { userid } = req.params;
            console.log(userid);
            // Step 2: Fetch following data
            const following = await followermodel
                .find({ follower:userid })
                .populate('following', '_id name avatar');
    
            console.log("Following Data:", following);
    
            if (!following || following.length === 0) {
                return res.status(200).send({ message: "No posts available", success: true, posts: [] });
            }
    
            // Step 3: Extract following IDs
            const followingIds = following.map(f => f.following?._id);
            console.log("Following IDs:", followingIds);
    
            // Step 4: Fetch posts for followed users
            const posts = await postmodel
                .find({ user: { $in: followingIds } })
                .populate('user', 'name avatar')
                .sort({ date: -1 });
    
            res.status(200).send({ message: "Feed fetched successfully", success: true, posts });
        } catch (error) {
            console.error("Error in getFeed:", error);
            res.status(500).send({ message: "Something Went Wrong", success: false });
        }
   
    
    
    };
    