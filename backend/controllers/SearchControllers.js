import postmodel from "../models/PostModel.js";
import usermodel from "../models/UserModel.js";




export const searchUser = async (req, res) => {
    try {
        const { username } = req.params;
    
        const userdetails = await usermodel.find({ name: { $regex: username, $options: 'i' } });
        
        if (userdetails && userdetails.length > 0) {
            res.status(200).send({ userdetails, success: true });
        } else {
            res.status(200).send({ message: "No users found", success: false });
        }
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).send({ message: "Something went wrong", success: false });
    }
};

export const searchPosts = async (req, res) => {
    try {
        const { keyword } = req.params;

        const postDetails = await postmodel.find({
            text: { $regex: keyword, $options: 'i' }
        });

        if (postDetails && postDetails.length > 0) {
            res.status(200).send({ postDetails, success: true });
        } else {
            res.status(200).send({ message: "No posts found", success: false });
        }
    } catch (error) {
        console.error("Error searching posts:", error);
        res.status(500).send({ message: "Something went wrong", success: false });
    }
};
