import asyncHandler from "../utils/asyncHandler.js";
import { apiErrorHandler } from "../utils/apiErrorHandler.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinaryService.js";
import { ApiResponse } from "../utils/apiResponse.js";

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

const logOutUser = asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
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

export { registerUser, loginUser ,logOutUser};
