import asyncHandler from "../utils/asyncHandler.js";
import { apiErrorHandler } from "../utils/apiErrorHandler.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinaryService.js";
import { ApiResponse } from "../utils/apiResponse.js";

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

    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
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


export default registerUser;
