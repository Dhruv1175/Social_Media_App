import postmodel from "../models/PostModel.js"
import usermodel from "../models/UserModel.js"
import followermodel from "../models/FollowModel.js"
import savedpostmodel from "../models/SavedPostModel.js"

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
      
            const following = await followermodel
                .find({ follower:userid })
                .populate('following', '_id name avatar');
    
            if (!following || following.length === 0) {
                return res.status(200).send({ message: "No posts available", success: true, posts: [] });
            }
            const followingIds = following.map(f => f.following?._id);
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

    export const savedPost = async (req, res) => {
        try {
            const { userid, postid } = req.params;
            const post = await postmodel.findById({ _id: postid });
            
    
            if (!post) {
                return res.status(200).send({ message: "Post Not Found", success: false });
            } else {
                // Check if the post is already saved by the user
                const existingSave = await savedpostmodel.findOne({ user: userid, post: postid });
    
                if (existingSave) {
                    // Post is already saved, so unsave it
                    const data = await savedpostmodel.deleteOne({ user: userid, post: postid });
                    if (data.deletedCount > 0) {
                        return res.status(200).send({ message: "Post Unsaved", success: true ,isSaved:false});
                    } else {
                        
                        return res.status(200).send({ message: "Could Not Perform The Action", success: false });
                    }
                } else {
                    // Post is not saved, so save it
                    const savedPost = new savedpostmodel({ user: userid, post: postid });
                    await savedPost.save();
    
                    if (savedPost) {
                        return res.status(200).send({ message: "Post Saved Successfully", success: true,isSaved:true });
                    } else {
                        return res.status(200).send({ message: "Post Not Saved", success: false });
                    }
                }
            }
        } catch (error) {
            console.error("Error in savedPost function:", error); // Logs the full error message
            res.status(500).send({ message: "Something Went Wrong", success: false, error: error.message });
        }
    };
    
    

export const getSavedPost = async (req,res) =>{
    try{
        const {userid} = req.params;
        const data = await savedpostmodel.find({user:userid}).populate('post');
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

export const deleteSavedPost = async(req,res) =>{
    try{
        const {userid,postid} = req.params;
        
    }
    catch(error){
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}