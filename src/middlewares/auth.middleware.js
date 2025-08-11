import asyncHandler from "../utils/asyncHandler.js";
import { apiErrorHandler } from "../utils/apiErrorHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJwt = asyncHandler(async(req,_,next)=>{
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if(!token){
        throw new apiErrorHandler(401, "Unauthorized request.");
    }

    // try {
    //     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    //     req.user = decoded;
    //     next();
    // } catch (error) {
    //     throw new apiErrorHandler(401, "Invalid or expired token.");
    // }

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        if(!decodedToken) {
            throw new apiErrorHandler(401, "Invalid token.");
        }
 
        const userId = await User.findById(decodedToken._id).select("-password -refreshToken");
        if (!userId) {
            throw new apiErrorHandler(404, "User not found.");
        }

        req.user = userId;
        next();
    } catch (error) {
        throw new apiErrorHandler(401, "Invalid or expired token.");
    }
})