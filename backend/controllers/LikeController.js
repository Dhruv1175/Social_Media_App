import commentmodel from "../models/CommentModel.js";
import likemodel from "../models/LikeModel.js";
import postmodel from "../models/PostModel.js";


export const toggleLikePost = async (req, res) => {
    try {
        const { userid, postid } = req.params;
        const postExists = await postmodel.findOne({ _id: postid });
        if (!postExists) {
            return res.status(404).send({ message: "Post Not Found", success: false });
        }

        const likeExists = await likemodel.findOne({ user: userid, post: postid });

        if (!likeExists) {
            const likedata = new likemodel({ user: userid, post: postid });
            await likedata.save();
            return res.status(200).send({ isLiked: true, success: true, message: "Post liked" });
        } else {
            await likemodel.findOneAndDelete({ user: userid, post: postid });
            return res.status(200).send({ isLiked: false, success: true, message: "Like removed" });
        }
    } catch (error) {
        res.status(500).send({ message: "Something Went Wrong", success: false });
    }
};

export const toggleLikeComment = async (req,res) => {
    try {
        const { userid, postid , commentid } = req.params;
        const commentExists = await commentmodel.findOne({ _id: commentid });
        if (!commentExists) {
            return res.status(404).send({ message: "Comment Not Found", success: false });
        }

        const likeExists = await likemodel.findOne({ user: userid, post: postid , comment:commentid });

        if (!likeExists) {
            const likedata = new likemodel({ user: userid, post: postid ,comment:commentid});
            await likedata.save();
            return res.status(200).send({ isLiked: true, success: true, message: "Comment liked" });
        } else {
            await likemodel.findOneAndDelete({ user: userid, post: postid ,comment:commentid });
            return res.status(200).send({ isLiked: false, success: true, message: "Like removed" });
        }
    } catch (error) {
        res.status(500).send({ message: "Something Went Wrong", success: false });
    }
};
