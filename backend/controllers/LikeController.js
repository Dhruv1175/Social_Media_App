import commentmodel from "../models/CommentModel.js";
import likemodel from "../models/LikeModel.js";
import notificationmodel from "../models/NotificationModel.js";
import postmodel from "../models/PostModel.js";


export const toggleLikePost = async (req, res) => {
    try {
        const { userid, postid } = req.params;
        const existingLike = await likemodel.findOne({ user: userid, post: postid });

        let isLiked = false;
        let likes = 0;

        if (existingLike) {
            // If the like exists, remove it (unlike)
            await likemodel.deleteOne({ _id: existingLike._id });
        } else {
            // If no like exists, create one (like)
            const newLike = new likemodel({ user: userid, post: postid, type: 'post' });
            await newLike.save();
            isLiked = true;
        }

        // Count total likes for this post
        likes = await likemodel.countDocuments({ post: postid });

        res.status(200).send({
            message: isLiked ? "Post liked" : "Post unliked",
            success: true,
            isLiked,
            likes
        });
    } catch (error) {
        console.error("Error toggling like:", error);
        res.status(500).send({ message: "Something went wrong", success: false });
    }
};

export const toggleLikeComment = async (req, res) => {
    try {
        const { userid, commentid } = req.params;
        const like = await likemodel.findOne({ user: userid, comment: commentid });

        if (like) {
            // Unlike
            await likemodel.deleteOne({ _id: like._id });
            res.status(200).send({ message: "Comment unliked", success: true });
        } else {
            // Like
            const newLike = new likemodel({ user: userid, comment: commentid, type: 'comment' });
            await newLike.save();
            res.status(200).send({ message: "Comment liked", success: true });
        }
    } catch (error) {
        console.error("Error toggling comment like:", error);
        res.status(500).send({ message: "Something went wrong", success: false });
    }
};

export const getUserLikes = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Find all post likes for this user
        const likes = await likemodel.find({
            user: userId,
            post: { $exists: true, $ne: null },
            $or: [
                { type: 'post' },
                { type: { $exists: false } }
            ]
        }).populate('post');
        
        // Extract just the posts from the likes
        const likedPosts = likes.map(like => like.post);
        
        res.status(200).send({
            success: true,
            likedPosts
        });
    } catch (error) {
        console.error('Error getting user likes:', error);
        res.status(500).send({
            success: false,
            message: 'Something went wrong while retrieving user likes'
        });
    }
};
