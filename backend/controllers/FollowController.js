import followermodel from "../models/FollowModel.js";
import notificationmodel from "../models/NotificationModel.js";



export const toggleFollow = async (req,res) => {
    try{
        const {userid,followid} = req.params;
        const unfollowRequest = req.path.includes('unfollow');
        
        // Prevent self-following
        if (userid === followid) {
            return res.status(400).send({message:"You cannot follow yourself", success:false});
        }
        
        // Check if the user is already following the target user
        const exists = await followermodel.findOne({follower:userid,following:followid});
        
        // Handling unfollow - don't check for auth
        if (exists && (unfollowRequest || req.path.includes('follow'))) {
            await followermodel.findOneAndDelete({follower:userid,following:followid});
            return res.status(200).send({message:"Unfollowed successfully", success:true});
        }
        
        // Handling follow - requires auth (handled by middleware)
        if (!exists && !unfollowRequest) {
            try {
                // Unique IDs are enforced by the database index
                const followdetails = new followermodel({follower:userid,following:followid})
                await followdetails.save()
                
                // Create notification for follow
                const notification = new notificationmodel({user:followid,type:'follow',fromUser:userid})
                await notification.save()
                
                return res.status(200).send({message:"Followed successfully", success:true})
            } catch (saveError) {
                // Check if the error is a duplicate key error
                if (saveError.code === 11000) { // MongoDB duplicate key error code
                    return res.status(400).send({message:"You are already following this user", success:false});
                }
                throw saveError; // Re-throw the error to be caught by the outer catch block
            }
        }
        
        // If unfollow is requested but user isn't following
        if (unfollowRequest && !exists) {
            return res.status(400).send({message:"You are not following this user", success:false});
        }
    }
    catch(error){
        console.error("Follow error:", error);
        res.status(500).send({message:"Something went wrong with the follow operation", success:false})
    }
}

export const getFollow = async (req,res) => {
    try{
        const {userid} = req.params;
        // Fetch followers with unique IDs, properly populated
        const followdetails = await followermodel.find({following:userid}).populate('follower', 'name avatar _id');
        if (followdetails.length > 0) {
            res.status(200).send({ followdetails, success: true });
        } else {
            res.status(200).send({ message: "No followers found", followdetails: [], success: true });
        }
    }
    catch(error){
        console.error("Error fetching followers:", error);
        res.status(500).send({message:"Something went wrong while fetching followers", success:false})
    }
}

export const getFollowing = async (req,res) => {
    try{
        const {userid} = req.params;
        // Fetch following with unique IDs, properly populated
        const followdetails = await followermodel.find({follower:userid}).populate('following', 'name avatar _id')
        if(followdetails.length > 0){
            res.status(200).send({followdetails, success:true})
        }
        else{
            res.status(200).send({message:"No Following", followdetails: [], success:true})
        }
    }
    catch(error){
        console.error("Error fetching following:", error);
        res.status(500).send({message:"Something went wrong while fetching following", success:false})
    }
}

export const getAllFollowRelationships = async (req, res) => {
    try {
        // Get all follow relationships from the database
        const allRelationships = await followermodel.find({})
            .populate('follower', '_id name avatar')
            .populate('following', '_id name avatar')
            .sort({ date: -1 });
        
        // Format the data for easier consumption
        const formattedRelationships = allRelationships.map(relation => ({
            id: relation._id,
            follower: {
                id: relation.follower._id,
                name: relation.follower.name,
                avatar: relation.follower.avatar
            },
            following: {
                id: relation.following._id,
                name: relation.following.name,
                avatar: relation.following.avatar
            },
            date: relation.date
        }));
        
        res.status(200).send({ 
            relationships: formattedRelationships, 
            count: formattedRelationships.length,
            success: true 
        });
    } catch (error) {
        console.error("Error fetching all follow relationships:", error);
        res.status(500).send({
            message: "Something went wrong while fetching follow relationships",
            success: false
        });
    }
}

// Check if a user is following another user
export const checkFollowStatus = async (req, res) => {
    try {
        const { userid, followid } = req.params;
        
        // Validate the parameters
        if (!userid || !followid) {
            return res.status(400).send({ 
                message: "Both userid and followid are required", 
                success: false,
                isFollowing: false 
            });
        }

        // Check for self-follow (not allowed)
        if (userid === followid) {
            return res.status(400).send({ 
                message: "Cannot check if user follows themselves", 
                success: false,
                isFollowing: false 
            });
        }

        // Find the follow relationship
        const followRelationship = await followermodel.findOne({
            follower: userid,
            following: followid
        });

        // Return whether the follow relationship exists
        return res.status(200).send({
            success: true,
            isFollowing: !!followRelationship, // Convert to boolean
            followDetails: followRelationship || null
        });
    } catch (error) {
        console.error("Error checking follow status:", error);
        res.status(500).send({
            message: "Something went wrong while checking follow status",
            success: false,
            isFollowing: false
        });
    }
}