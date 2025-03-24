import postmodel from "../models/PostModel.js";
import usermodel from "../models/UserModel.js";

export const searchUser = async (req, res) => {
    try {
        const query = req.query.q; // Get search query from query parameter
        
        console.log('Search query received:', query);
        console.log('Request headers:', req.headers);
        
        if (!query || query.trim() === '') {
            console.log('Empty search query, returning empty results');
            return res.status(200).json({ users: [], success: true });
        }
    
        console.log('Searching for users with query:', query);
        const users = await usermodel.find({ 
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { username: { $regex: query, $options: 'i' } }
            ]
        }).select('_id name username avatar').limit(10);
        
        console.log('Search results count:', users.length);
        
        if (users && users.length > 0) {
            res.status(200).json({ users, success: true });
        } else {
            res.status(200).json({ users: [], success: true });
        }
    } catch (error) {
        console.error("Error searching users:", error);
        res.status(500).json({ message: "Something went wrong", success: false });
    }
};

export const searchPosts = async (req, res) => {
    try {
        const { keyword } = req.params;
        console.log('Searching posts with keyword:', keyword);

        const postDetails = await postmodel.find({
            text: { $regex: keyword, $options: 'i' }
        });

        console.log('Post search results count:', postDetails.length);

        if (postDetails && postDetails.length > 0) {
            res.status(200).json({ postDetails, success: true });
        } else {
            res.status(200).json({ postDetails: [], success: true });
        }
    } catch (error) {
        console.error("Error searching posts:", error);
        res.status(500).json({ message: "Something went wrong", success: false });
    }
};
