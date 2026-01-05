import express from "express";
import { verifyToken } from "../middleware/VerifyToken.js";
import { getUserProfile, loginUser, registerUser, updateProfile, getAllUsers } from "../controllers/UserController.js";
import { createPost, deletePost, deleteSavedPost, feed, getOnePost, getAllPost, getSavedPost, getUserPost, savedPost, updatePost, getLikeCounts  , getAllPosts} from "../controllers/PostController.js";
import { addComment, deleteComment, getComment, updateComment } from "../controllers/CommentController.js";
import { toggleLikeComment, toggleLikePost, getUserLikes ,  } from "../controllers/LikeController.js";
import { getFollow, getFollowing, toggleFollow, getAllFollowRelationships, checkFollowStatus } from "../controllers/FollowController.js";
import { getNotifications,getNewNotifications, markNotificationAsRead,markAllNotificationsAsRead, getUnreadCount, deleteNotification, clearAllNotifications,getNotificationStats,createNotification} from "../controllers/NotificationController.js";
import { DirectMessage, getMessage, sendMessage, getMessagedUsers } from "../controllers/MessageController.js";
import { searchPosts, searchUser } from "../controllers/SearchControllers.js";
// NEW IMPORTS for Story functionality
import { createStory, getStoryFeed, markStoryAsViewed, getStoryViews } from "../controllers/StoryController.js"; 


const route = express.Router()

//user action routes 
route.post("/user/register",registerUser);
route.post("/user/login",loginUser);
route.get("/user/profile/:id",verifyToken,getUserProfile);
route.patch("/user/update/:id",verifyToken,updateProfile);
route.get("/user/get/all",verifyToken,getAllUsers);

//post action routes
route.post("/user/:userid/post/userpost/create",verifyToken,createPost);
route.get("/user/post/get",verifyToken,getAllPost);
route.get("/user/posts/get",verifyToken,getAllPosts);
route.get("/user/:userid/post/userpost/get",verifyToken,getUserPost);
route.get("/user/post/userpost/:postid/get",verifyToken,getOnePost);
route.patch("/user/post/userpost/:postid/update",verifyToken,updatePost);
route.delete("/user/post/userpost/:postid/delete",verifyToken,deletePost);
route.get("/user/post/:userid/feed",verifyToken,feed);
route.post("/user/post/:userid/:postid/save",verifyToken,savedPost);
route.get("/user/post/:userid/saved",verifyToken,getSavedPost);
route.delete("/user/post/:userid/:postid/unsave",verifyToken,deleteSavedPost);

//comment action routes
route.post("/user/:userid/post/userpost/:postid/comment/add",verifyToken,addComment);
route.get("/user/post/userpost/:postid/comment/get",verifyToken,getComment);
route.patch("/user/post/userpost/comment/:commentid/update",verifyToken,updateComment);
route.delete("/user/post/userpost/comment/:commentid/delete",verifyToken,deleteComment);

//like action routes
route.post("/user/:userid/post/userpost/:postid/like",verifyToken,toggleLikePost);
route.post("/user/:userid/post/userpost/:postid/comment/:commentid/like",verifyToken,toggleLikeComment);
route.get("/user/:userId/likes", verifyToken, getUserLikes);

// --- Story Action Routes ---
route.post("/user/story/create", verifyToken, createStory); // Create a new story
route.get("/user/story/feed", verifyToken, getStoryFeed); // Get stories from following users + self
route.post("/user/story/:storyId/view", verifyToken, markStoryAsViewed); // Mark a story as viewed
route.get("/user/story/:storyId/views", verifyToken, getStoryViews); // Get viewer insights (creator only)

//follow action routes 
route.post("/user/:userid/:followid/follow", verifyToken, toggleFollow);
route.post("/user/:userid/:followid/unfollow", toggleFollow);
route.get("/user/:userid/followers", getFollow);
route.get("/user/:userid/following", getFollowing);
route.get("/follows/all", getAllFollowRelationships);
route.get("/follows/check/:userid/:followid", checkFollowStatus);

//notification action routes
route.get("/user/:userId/notifications", verifyToken, getNotifications);
route.get("/user/:userId/notifications/new", verifyToken, getNewNotifications);
route.get("/user/:userId/notifications/unread", verifyToken, getUnreadCount);
route.get("/user/:userId/notifications/stats", verifyToken, getNotificationStats);
route.patch("/user/:userId/notification/:notificationId/read", verifyToken, markNotificationAsRead);
route.post("/user/:userId/notification/mark-all-read", verifyToken, markAllNotificationsAsRead);
route.delete("/user/notification/:notificationId", verifyToken, deleteNotification);
route.delete("/user/:userId/notifications/clear", verifyToken, clearAllNotifications);
route.post("/user/notification/create", verifyToken, (req, res) => {
    // This endpoint is for testing notification creation
    createNotification(req.body, req.io).then(notification => {
        if (notification) {
            res.status(201).json({ success: true, notification });
        } else {
            res.status(500).json({ success: false, message: "Failed to create notification" });
        }
    });
});

//message action routes
route.post("/user/:userid/receiver/:receiverid/message/send",verifyToken,sendMessage)
route.get("/user/:userid/message/get",verifyToken,getMessage)
route.get("/user/:userid/:senderid/message/get",verifyToken,DirectMessage)
route.get("/user/:userid/messages/contacts",verifyToken,getMessagedUsers)


//search action routes
route.get("/user/search", verifyToken, searchUser);
route.get("/post/search/:keyword", verifyToken, searchPosts);

// API endpoints for frontend
route.get("/api/getPosts", verifyToken, getAllPost);
route.get("/api/posts/likeCounts", verifyToken, getLikeCounts);
route.patch("/api/post/:postid", verifyToken, updatePost);
route.delete("/api/post/:postid", verifyToken, deletePost);

export default route