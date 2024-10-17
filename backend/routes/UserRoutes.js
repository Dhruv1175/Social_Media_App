import express from "express";
import { verifyToken } from "../middleware/VerifyToken.js";
import { getUserProfile, loginUser, registerUser, updateProfile } from "../controllers/UserController.js";
import { createPost, deletePost, getOnePost, getPost, getUserPost, updatePost } from "../controllers/PostController.js";

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



export default route