import jwt from "jsonwebtoken";

export const AccessToken=async(exist)=>{
    const accesstoken =  jwt.sign({id:exist.email},process.env.ACCESS_TOKEN_KEY,{expiresIn:"1d"})
    return accesstoken
}

export const RefreshToken=async(exist)=>{
    const refreshtoken =  jwt.sign({id:exist._id},process.env.REFRESH_TOKEN_KEY,{expiresIn:"10d"})
    return refreshtoken
}