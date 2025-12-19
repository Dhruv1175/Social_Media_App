import postmodel from "../models/PostModel.js"
import usermodel from "../models/UserModel.js"
import followermodel from "../models/FollowModel.js"
import savedpostmodel from "../models/SavedPostModel.js"
import likemodel from "../models/LikeModel.js"

export const createPost = async(req,res)=>{
    try{
        const {userid} = req.params
        const{text,image,video,postType} = req.body
        const post = new postmodel({
            user:userid,
            text:text,
            image:image,
            video:video,
            postType:postType || (video ? 'reel' : 'post') // Default based on content if not specified
        })
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

export const getAllPost = async(req,res)=>{
    try{
        const posts = await postmodel.find().sort({date: -1}).populate("user","name avatar")
        if(posts){
            res.status(200).send({posts:posts, success:true})
        }
        else{
            res.status(200).send({message:"Could not Fetch Posts", success:false})
        }
    }
    catch(error){
        res.status(200).send({message:"Something Went Wrong",success:false})
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
        const {text,video,image} = req.body
        const updateFields = {};

        if (text !== undefined) updateFields.text = text;
        if (video !== undefined) updateFields.video = video;
        if (image !== undefined) updateFields.image = image;
        
        const updatedetails = await postmodel.findByIdAndUpdate(
            postid,
            {$set:updateFields},
            {new:true}
        );
        
        if(updatedetails){
            res.status(200).send({
                message:"Post updated successfully",
                success:true,
                post: updatedetails
            })
        }
        else{
            res.status(404).send({message:"Post not found",success:false})
        }
    }
    catch(error){
        console.error("Error updating post:", error);
        res.status(500).send({message:"Something went wrong",success:false})
    }
}

export const deletePost = async(req,res) => {
    try {
        const {postid} = req.params;
        
        // Check if post exists
        const post = await postmodel.findById(postid);
        if (!post) {
            return res.status(404).send({message:"Post not found",success:false});
        }
        
        // Delete post
        await postmodel.findByIdAndDelete(postid);
        
        // Delete all saved instances of this post
        await savedpostmodel.deleteMany({post: postid});
        
        // Return success
        res.status(200).send({
            message:"Post deleted successfully",
            success:true
        });
    } catch(error) {
        console.error("Error deleting post:", error);
        res.status(500).send({message:"Something went wrong",success:false});
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

export const deleteSavedPost = async(req,res) => {
    try{
        const {userid, postid} = req.params;
        const savedPost = await savedpostmodel.findOne({ user: userid, post: postid });
        
        if (!savedPost) {
            return res.status(404).send({
                message: "Saved post not found",
                success: false
            });
        }
        
        await savedpostmodel.deleteOne({ _id: savedPost._id });
        
        res.status(200).send({
            message: "Saved post deleted successfully",
            success: true
        });
    }
    catch(error){
        console.error("Error deleting saved post:", error);
        res.status(500).send({message:"Something went wrong", success:false});
    }
}

export const getLikeCounts = async (req, res) => {
    try {
        // Get all likes from the database that are for posts
        // We need to handle both cases: with type field and without
        const likes = await likemodel.find({
            post: { $exists: true, $ne: null },
            $or: [
                { type: 'post' },
                { type: { $exists: false } } // Include likes without type field
            ]
        });
        
        // Group likes by post ID and count them
        const likeCounts = {};
        likes.forEach(like => {
            if (!likeCounts[like.post]) {
                likeCounts[like.post] = 0;
            }
            likeCounts[like.post]++;
        });
        
        res.status(200).send({
            success: true,
            likeCounts
        });
    } catch (error) {
        console.error('Error getting like counts:', error);
        res.status(500).send({
            success: false,
            message: 'Something went wrong while retrieving like counts'
        });
    }
};
export const getAllPosts = async(req,res)=>{
    try{
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const category = req.query.category;
        const skip = (page - 1) * limit;
        
        // Build query based on category
        let query = {};
        if (category && category !== 'all') {
            // You might want to add tags or categories to your post model
            // For now, we'll filter by postType or other fields
            if (['reel', 'post'].includes(category)) {
                query.postType = category;
            }
        }
        
        const posts = await postmodel.find(query)
            .sort({date: -1})
            .skip(skip)
            .limit(limit)
            .populate("user","name avatar username bio");
        
        const total = await postmodel.countDocuments(query);
        
        if(posts){
            res.status(200).send({
                posts: posts, 
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalPosts: total,
                success: true
            })
        }
        else{
            res.status(200).send({message:"Could not Fetch Posts", success:false})
        }
    }
    catch(error){
        console.error("Error in getAllPosts:", error);
        res.status(500).send({message:"Something Went Wrong",success:false})
    }
}