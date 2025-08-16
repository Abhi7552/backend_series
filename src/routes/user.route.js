import { Router } from "express";
import { registerUser, loginUser, logOutUser, refreshAccessToken, changeCurrentPassword, getCurrentuser, updateAccountDetails, avtarUpdate, coverImageUpdate, getUserChannelProfile, getWatchHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";


const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "avtar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
);

router.route("/login").post(loginUser);

// secured routes

router.route("/logout").post(verifyJwt, logOutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJwt, changeCurrentPassword);
router.route("/current-user").get(verifyJwt, getCurrentuser);
router.route("/update-account").patch(verifyJwt, updateAccountDetails);

router.route("/update-avtar").patch(verifyJwt, upload.single("avtar"), avtarUpdate);
router.route("/update-coverImage").patch(verifyJwt, upload.single("coverImage"), coverImageUpdate);

router.route("/c/:username").get(verifyJwt, getUserChannelProfile);
router.route("/history").get(verifyJwt, getWatchHistory);

export default router;