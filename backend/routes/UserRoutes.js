import express from "express";
import { verifyToken } from "../middleware/VerifyToken.js";
import { getUserProfile, loginUser, registerUser, updateProfile } from "../controllers/UserController.js";
import { createPost, deletePost, getOnePost, getPost, getUserPost, updatePost } from "../controllers/PostController.js";
import { addComment, deleteComment, getComment, updateComment } from "../controllers/CommentController.js";
import { toggleLikeComment, toggleLikePost } from "../controllers/LikeController.js";

const route = express.Router()

//user action routes 
route.post("/user/register",registerUser)
route.post("/user/login",loginUser)
route.get("/user/profile/:id",verifyToken,getUserProfile)
route.patch("/user/update/:id",verifyToken,updateProfile)

//post action routes
route.post("/user/:userid/post/userpost/create",verifyToken,createPost)
route.get("/user/post/get",verifyToken,getPost)
route.get("/user/:userid/post/userpost/get",verifyToken,getUserPost)
route.get("/user/post/userpost/:postid/get",verifyToken,getOnePost)
route.patch("/user/post/userpost/:postid/update",verifyToken,updatePost)
route.delete("/user/post/userpost/:postid/delete",verifyToken,deletePost)

//comment action routes
route.post("/user/:userid/post/userpost/:postid/comment/add",verifyToken,addComment);
route.get("/user/post/userpost/:postid/comment/get",verifyToken,getComment);
route.patch("/user/post/userpost/comment/:commentid/update",verifyToken,updateComment);
route.delete("/user/post/userpost/comment/:commentid/delete",verifyToken,deleteComment);

//like action routes
route.post("/user/:userid/post/userpost/:postid/like",verifyToken,toggleLikePost)
route.post("/user/:userid/post/userpost/:postid/comment/:commentid/like",verifyToken,toggleLikeComment)



export default route