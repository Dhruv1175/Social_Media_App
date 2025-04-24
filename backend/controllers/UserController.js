import express from "express";
import bcrypt from "bcrypt";
import usermodel from "../models/UserModel.js";
import { AccessToken, RefreshToken } from "../utils/CreateToken.js";
import followermodel from "../models/FollowModel.js";

export const registerUser=async(req,res)=>{
    try{
    const{name,email,password,avatar,bio} = req.body;
    const exist = await usermodel.findOne({email:email})
    if(exist){
        res.status(200).send({message:"User Already Exists.",success:false})
    }
    else{
    const hashpass = bcrypt.hashSync(password,10)
    const userdetails =  new usermodel({name:name,email:email,password:hashpass,avatar:avatar,bio:bio})
    await userdetails.save()
    if(userdetails){
        res.status(200).send({message:"User Registered Successfully",success:true})
    }
    else{
        res.status(200).send({message:"Something Went Wrong ",success:false})
    }
}
}
catch(error){
    res.status(500).send({message:"Something Went Wrong"})
}
}

export const loginUser = async(req,res)=>{
    try{
    const {email,password} = req.body
    const exist = await usermodel.findOne({email:email})
    if(exist){
        const verify = await bcrypt.compare(password,exist.password)
        if (verify){
            const accesstoken = await  AccessToken(exist)
            const refreshtoken = await  RefreshToken(exist)
            res.status(200).send({message:"User Login SuccessFul",success:true,accesstoken,refreshtoken,userId:exist._id})
        }
        else{
            res.status(200).send({message:"Incorrect Password , Please Try Again ",success:false})
        }
    }
    else{
        res.status(200).send({message:"User Not Found",success:false})
    }
}
catch(error){
    res.status(200).send({message:"Something Went Wrong",succcess:false})
}
}

export const getUserProfile = async (req,res) =>{
    try{
        const { id } = req.params;
const exist = await usermodel.findOne({ _id: id });
if (exist) {
    // Fetch followers and following using the correct conditions
    const followers = await followermodel.find({ following: id }).populate('follower', 'name avatar');  // Users who follow this profile
    const following = await followermodel.find({ follower: id }).populate('following', 'name avatar');  // Users whom this profile follows

    // Add the followers and following arrays to the 'exist' object
    exist.followers = followers;
    exist.following = following;

    // Optionally, update the user document if needed
    await usermodel.findByIdAndUpdate(id, {
        followers: followers,  // Store the full array
        following: following    // Store the full array
    });

    // Send the response with the updated 'exist' object
    res.status(200).send({ exist, success: true });
        }
        else{
            res.status(200).send({message:"User Profile Not Found",success:false})
        }
    }
    catch(error){
        res.status(200).send({message:"Something Went Wrong ",success:false})
    }
}

export const updateProfile = async (req, res) => {
    try {
        const { id } = req.params; 
        const { name, email, password, avatar, bio } = req.body;

       
        const exist = await usermodel.findOne({ _id: id });
        if (!exist) {
            return res.status(404).send({ message: "User Does Not Exist.", success: false }); 
        }
        const updateFields = {};

        if (name) updateFields.name = name;
        if (email) updateFields.email = email;
        if (password) {
            const hashpass = bcrypt.hashSync(password, 10);
            updateFields.password = hashpass; 
        }
        if (avatar) updateFields.avatar = avatar;
        if (bio) updateFields.bio = bio;

        const updatedetails = await usermodel.findByIdAndUpdate(
            id, 
            { $set: updateFields }, 
            { new: true } 
        );

        if (updatedetails) {
            return res.status(200).send({ message: "User Details Updated Successfully", success: true });
        } else {
            return res.status(200).send({ message: "Update Failed", success: false }); 
        }
    } catch (error) {
        res.status(200).send({ message: "Internal Server Error", success: false }); 
    }
};

export const getAllUsers = async (req, res) => {
    try {
        console.log("Getting all users");
        // Exclude sensitive information like passwords
        const users = await usermodel.find({}, { password: 0 });
        
        if (users && users.length > 0) {
            console.log(`Found ${users.length} users`);
            return res.status(200).send({ 
                users: users,
                success: true 
            });
        } else {
            console.log("No users found");
            return res.status(200).send({ 
                message: "No users found", 
                users: [],
                success: false 
            });
        }
    } catch (error) {
        console.error("Error getting all users:", error);
        res.status(500).send({ 
            message: "Error retrieving users", 
            success: false 
        });
    }
};

