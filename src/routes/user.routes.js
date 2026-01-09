import { Router } from "express";
import {logoutUser, loginUser,registerUser,refreshAccessToken, changePassword, getCurrentUser, updateUserDetails, UpdateAvatar, UpdateCoverImage, getUserChannelProfile, getWatchHistory } from "../controller/user.controller.js";
import { upload } from "../middelware/multer.middelware.js"; 
import { verifyJWT } from "../middelware/auth.middelware.js";


const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);



router.route("/login").post(loginUser)


// secure routes

router.route("/logout").post(verifyJWT,logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT,changePassword)
router.route("/current-user").get(verifyJWT,getCurrentUser)
router.route("/account-details").patch(verifyJWT,updateUserDetails)
router.route("/avatar").patch(verifyJWT,upload.single("avatar"),UpdateAvatar)
router.route("/cover-image").patch(verifyJWT,upload.single("coverImage"),UpdateCoverImage)
router.route("/c/:username").get(verifyJWT,getUserChannelProfile)
router.route("/history").get(verifyJWT,getWatchHistory)





export default router