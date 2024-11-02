import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config()

export const verifyToken=async(req,res,next)=>{

    try{
    const AccessToken = req.cookies.AccessToken
    const token = req.headers['authorization']?.split(' ')[1];
    if(token ){

        const decodeToken =  jwt.verify(token,process.env.ACCESS_TOKEN_KEY,(error,decode)=>{
            if(decode){
                
                next()
            }
            else{
                res.status(200).send({message:"access denied",success:false})
            }
        })

    }
    else{
        res.status(200).send({message:"Unauthorized user",success:false})
    }
    }
    catch(error){
        res.status(500).send({message:"something went wrong",success:false})
    }
}