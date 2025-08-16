import asyncHandler from "../utils/asyncHandler.js";
import { apiErrorHandler } from "../utils/apiErrorHandler.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinaryService.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const genreateAccessAndRefreshToken = async (userId) => {
    try {
        //fing user by userId
        const user = await User.findById(userId);
        const accessToken = user.generateAccesToken();
        const refreshToken = user.generateRefreshToken();

        //save refresh token to dB
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };

    } catch (error) {
        console.error("Error generating access and refresh token:", error);
        throw new apiErrorHandler(500, "Internal server error while generating tokens.");
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({  // dummy message
    //     message:"router done !"
    // })

    // get user details from frontend
    const { email, fullName, userName, password } = req.body;
    // console.log("email:", email);

    //validation check -not empty , etc

    // if(fullname===""){
    //     throw new apiErrorHandler(400,"Full name is required")
    // }  // can replicate to all checks

    if ([fullName, email, userName, password].some((field) => field?.trim() === "")) {
        throw new apiErrorHandler(400, "All fields are required")
    }

    // user already exists ? : by username or email
    const existedUser = await User.findOne({
        $or: [{ userName }, { email }]
    });
    if (existedUser) {
        throw new apiErrorHandler(409, "Username or email already exists");
    }

    // check for image, check avtar
    const avtarLocalPath = req.files?.avtar[0].path;
    if (!avtarLocalPath) {
        throw new apiErrorHandler(400, "Avtar file local path is required");
    }
    // const coverImageLocalPath = req.files?.coverImage[0].path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }


    //upload them to cloudinary,avtar
    const avtarImage = await uploadOnCloudinary(avtarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    // console.log(avtarImage, coverImage);

    if (!avtarImage) {
        throw new apiErrorHandler(400, "Avtar file is required");
    }


    // create user object - create entry in db
    const user = await User.create({
        fullName,
        avtar: avtarImage.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        userName: userName.toLowerCase()
    })

    //remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // check for user creation
    if (!createdUser) {
        throw new apiErrorHandler(500, "Error while registering the user account.")
    }

    // return response
    return res.status(200).json(
        new ApiResponse(200, createdUser, "User registered successfully.")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    // extract data from req.body
    const { userName, email, password } = req.body;

    // login using username or email
    if (!(userName || email)) {
        throw new apiErrorHandler(400, "Username or email is required.")
    }

    // find the user exists or not
    const user = await User.findOne({
        $or: [{ userName }, { email }]
    })

    if (!user) {
        throw new apiErrorHandler(404, "User does not exists.")
    }

    // validate entered password
    const isPasswordvalid = await user.isPasswordCorrect(password);
    if (!isPasswordvalid) {
        throw new apiErrorHandler(401, "Password is invalid, Please retry.")
    }

    // generate access and refersh token
    const { accessToken, refreshToken } = await genreateAccessAndRefreshToken(user._id);

    // send secure cookies 
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in successfully."
            )
        )
})

const logOutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", "", options)
        .cookie("refreshToken", "", options)
        .json(
            new ApiResponse(200, null, "User logged out successfully.")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.header("Authorization")?.replace("Bearer ", "");

    if (!incomingRefreshToken) {
        throw new apiErrorHandler(401, "Unauthorized request to login.")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        if (!decodedToken) {
            throw new apiErrorHandler(401, "Invalid token.");
        }

        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        if (!user) {
            throw new apiErrorHandler(404, "Invalid refresh token.");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiErrorHandler(401, "Refresh token exipred or used.")
        }

        // generate new access token
        const { accessToken, newRefreshToken } = await generateAccesToken(user._id);

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        throw new apiErrorHandler(401, "Invalid or expired refresh token.");
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.body?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new apiErrorHandler(400, "Invalid old password. Please retry")
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, {}, "Password updated successfully"))
});

const getCurrentuser = asyncHandler(async (req, res) => {
    return res.status(200).json(200, req.user, "Current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, userName, email } = req.body;

    if ([fullName, userName, email].some((field) => field?.trim() === "")) {
        throw new apiErrorHandler(400, "All fields are required")
    }

    // check if user exists
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                userName: userName.toLowerCase(),
                email
            }
        },
        { new: true }
    ).select("-password -refreshToken");


    return res.status(200).json(new ApiResponse(200, user, "User details updated successfully."));
})

const avtarUpdate = asyncHandler(async (req, res) => {
    const avtarLocalPath = req.file?.path;
    if (!avtarLocalPath) {
        throw new apiErrorHandler(400, "Avtar file is required");
    }

    //upload them to cloudinary,avtar
    const avtarImage = await uploadOnCloudinary(avtarLocalPath);
    if (!avtarImage.url) {
        throw new apiErrorHandler(400, "Error while uploading avtar on cloudinary");
    }

    // update user avtar
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avtar: avtarImage.url
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, user, "Avtar updated successfully.")
    );
})

const coverImageUpdate = asyncHandler(async (req, res) => {
    const coverImgLocalPath = req.file?.path;
    if (!coverImgLocalPath) {
        throw new apiErrorHandler(400, "Cover Image file is required");
    }

    //upload them to cloudinary,avtar
    const coverImg = await uploadOnCloudinary(coverImgLocalPath);
    if (!coverImg.url) {
        throw new apiErrorHandler(400, "Error while uploading cover image on cloudinary");
    }

    // update user avtar
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImg.url
            }
        },
        { new: true }
    ).select("-password -refreshToken");

    return res.status(200).json(
        new ApiResponse(200, user, "Cover Image updated successfully.")
    );
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { userName } = req.params;

    if (!userName || userName.trim() === "") {
        throw new apiErrorHandler(400, "Username is required to fetch channel profile.");
    }

    const channel = await User.aggregate([
        {
            $match: { userName: userName.toLowerCase() }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: { $size: "$subscribers" },
                subscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                userName: 1,
                avtar: 1,
                coverImage: 1,
                subscriberCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1
            }
        }

    ]).then((channelProfile) => {
        if (channelProfile.length === 0) {
            throw new apiErrorHandler(404, "User channel profile not found.");
        }
        return res.status(200).json(new ApiResponse(200, channelProfile[0], "User channel profile fetched successfully."));
    }).catch((error) => {
        throw new apiErrorHandler(500, "Error fetching user channel profile.", error);
    });
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        userName: 1,
                                        avtar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"  // to get the first element of the owner array
                            }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                watchHistoryDetails: 1
            }
        }
    ])

    return res
        .status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "Watch history fetched successfully."));
})

export { registerUser, loginUser, logOutUser, refreshAccessToken, changeCurrentPassword, getCurrentuser, updateAccountDetails, avtarUpdate, coverImageUpdate, getUserChannelProfile, getWatchHistory };
