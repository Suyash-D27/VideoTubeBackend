import { AsyncHandler } from "../utils/asyncHandler.js";
import { APIerrors } from "../utils/APIerrors.js";
import { User } from "../models/user.model.js";
import { deleteOnCloudinary, fileUploaderOnCloudinary } from "../utils/cloudinary.js";
import { APIResponse } from "../utils/APIResponse.js";
import jwt from "jsonwebtoken";
import { application } from "express";
import mongoose from "mongoose";


const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId)

    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }

  } catch (error) {
    throw new APIerrors(500, "something went wrong while generating tokens ")
  }
}

const registerUser = AsyncHandler(async (req, res) => {
  // get user details form frontend
  const { fullname, email, username, password } = req.body
  console.log("email:", email)
  console.log("FILES RECEIVED:", req.files); // DEBUG LOG
  // validation - not empty
  if (
    [fullname, email, username, password].some((field) => !field || field.trim() === "")
  ) {
    throw new APIerrors(400, "All fields are required");
  }
  //check if user is already exist - username and email
  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  })

  if (existedUser) {
    throw new APIerrors(409, "username or email is already exist")
  }
  //check for image and check for avatar

  // const  avatarLocalPath= req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let avatarLocalPath;
  if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
    avatarLocalPath = req.files?.avatar[0]?.path;
  }
  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }


  if (!avatarLocalPath) {
    throw new APIerrors(400, "avatar photo is required")
  }
  //upload images to cloudinary , avatar
  const avatar = await fileUploaderOnCloudinary(avatarLocalPath);
  let coverImage;
  if (coverImageLocalPath) {
    coverImage = await fileUploaderOnCloudinary(coverImageLocalPath);
  }

  if (!avatar) {
    throw new APIerrors(400, "avatar photo is required")
  }
  //create user object-create entry in db
  const user = await User.create({
    fullname,
    username: username.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email

  })

  console.log("🧾 User created:", user._id);

  // remove password and refresh token field form respond
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )
  // check for user creation 
  if (!createdUser) {
    throw new APIerrors(500, "something went while registering the user")
  }
  // return res 

  return res.status(200).json(
    new APIResponse(200, createdUser, "user registered successfully")
  )

})

const loginUser = AsyncHandler(async (req, res) => {
  //take the username and email form request body
  const { email, username, password } = req.body;

  if (!password) {
    throw new APIerrors(400, "password is required");
  }

  if (!email && !username) {
    throw new APIerrors(400, "email or username is required");
  }

  //find the user 
  const user = await User.findOne({
    $or: [{ email }, { username }]
  })

  if (!user) {
    throw new APIerrors(400, "User does not exist")
  }

  // check password 
  const ispasswordValid = await user.isPasswordCorrect(password)
  if (!ispasswordValid) {
    throw new APIerrors(401, "password is invalid")
  }

  // genrate Access token and refresh token 
  const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  // send token 

  const options = {
    httpOnly: true,
    secure: true
  }

  // send response 

  return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(
    new APIResponse(200, {
      user: loggedInUser, accessToken, refreshToken
    },
      "user Logged in "
    )
  )

})

const logoutUser = AsyncHandler(async (req, res) => {

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1
      }
    }, {
    new: true
  }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new APIResponse(200, {}, "User is logged out"))


})


const refreshAccessToken = AsyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new APIerrors(401, "unauthorize request");
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

    const user = await User.findById(decodedToken?._id)

    if (!user) {
      throw new APIerrors(401, "invalid refresh Token ")
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new APIerrors(401, "request token is expired and used ")
    }

    const options = {
      httpOnly: true,
      secure: true
    }

    const { accessToken, newRefreshToken } = await generateAccessTokenAndRefreshToken(user);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new APIResponse(200,
          { accessToken, refreshToken: newRefreshToken },
          "access Token refresh"
        )
      )
  } catch (error) {
    throw new APIerrors(400, error?.message || "invalid refreshToken")
  }
})

const changePassword = AsyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id)

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

  if (!isPasswordCorrect) {
    throw new APIerrors(400, "password is incorrect")
  }

  user.password = newPassword;
  user.save({ validateBeforeSave: false })

  return res.status(200)
    .json(new APIResponse(200, {}, "password change successfully"))
})

const getCurrentUser = AsyncHandler(async (req, res) => {
  return res.status(200)
    .json(new APIResponse(200, req.user, "user successfully fetched"))
})

const updateUserDetails = AsyncHandler(async (req, res) => {
  console.log("REQ HEADERS content-type:", req.headers['content-type']);
  console.log("UPDATE DETAILS BODY:", req.body);
  const { email, fullname } = req.body || {};
  if (!email && !fullname) {
    throw new APIerrors(400, "at least one field (email or fullname) is required")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        email,
        fullname
      }
    },
    { new: true }
  ).select("-password")

  return res.status(200)
    .json(new APIResponse(200, user, "successfully Update the fields"))
})

const UpdateAvatar = AsyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  const oldUrl = req.user?.avatar

  if (!avatarLocalPath) {
    throw new APIerrors(400, "Avatar file is missing")
  }

  const avatar = await fileUploaderOnCloudinary(avatarLocalPath)

  if (!avatar) {
    throw new APIerrors(400, "error happen while uploading")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set: {
        avatar: avatar?.url
      }
    },
    { new: true }).select("-password")


  const deletedUrl = await deleteOnCloudinary(oldUrl);

  return res.status(200)
    .json(new APIResponse(200, { user, deletedUrl }, "successfully update Avatar and old url is deleted "))
})

const UpdateCoverImage = AsyncHandler(async (req, res) => {
  console.log("REQ FILE:", req.file);
  const coverImageLocalPath = req.file?.path;

  const oldUrl = req.user?.coverImage

  if (!coverImageLocalPath) {
    throw new APIerrors(400, "CoverImage file is missing")
  }

  const coverImage = await fileUploaderOnCloudinary(coverImageLocalPath)

  if (!coverImage) {
    throw new APIerrors(400, "error happen while uploading")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      $set: {
        coverImage: coverImage?.url
      }
    },
    { new: true }).select("-password")


  const deletedUrl = await deleteOnCloudinary(oldUrl)

  return res.status(200)
    .json(new APIResponse(200, { user, deletedUrl }, "successfully update coverImage and old url is deleted"))
})


const getUserChannelProfile = AsyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new APIerrors(400, "user does not exist")
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
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
        subscriberCount: {
          $size: "$subscribers"
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo"
        },
        isSubscribedToChannel: {
          if: { $in: [req.user?._id, "$subscribers.subscriber"] },
          then: true,
          else: false
        }
      }
    },
    {
      $project: {
        username: 1,
        fullname: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        isSubscribedToChannel: 1,
        channelSubscribedToCount: 1,
        subscriberCount: 1
      }
    }
  ])

  if (!channel?.length) {
    throw new APIerrors(400, "no channel found")
  }

  return res.status(200)
    .json(new APIResponse(200, channel[0], "user channel fetched successfully"))
})

const getWatchHistory = AsyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id)
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
                    username: 1,
                    fullname: 1,
                    avatar: 1,
                  }
                }
              ]
            }
          }, {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      },
    }
  ])

  if (!user.length) {
    throw new APIerrors(400, "user not found")
  }

  return res.status(200)
    .json(new APIResponse(200, user[0].watchHistory, "watch history fetched successfully"))
})


export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateUserDetails,
  UpdateAvatar,
  UpdateCoverImage,
  getUserChannelProfile,
  getWatchHistory
}