import { AsyncHandler } from "../utils/asyncHandler.js";
import { APIerrors } from "../utils/APIerrors.js";
import { User } from "../models/user.model.js";
import { fileUploaderOnCloudinary } from "../utils/cloudinary.js";
import { APIResponse } from "../utils/APIResponse.js";


const generateAccessTokenAndRefreshToken = async(userId)=>{
    try {
      const user = await User.findById(userId)
      accessToken=user.generateAccessToken()
      refreshToken=user.generateRefreshToken()

      user.refreshToken=refreshToken
      await user.save({validateBeforeSave : false})

      return{accessToken,refreshToken}

    } catch (error) {
      throw new APIerrors(500, "something went wrong while generating tokens ")
    }
}

const registerUser = AsyncHandler(async (req,res)=>{
  // get user details form frontend
    const {fullname,email,username,password} = req.body
    console.log("email:",email)
  // validation - not empty
    if(
        [fullname,email,password,username].some((field)=> field?.trim()==="")
    ){
        throw new APIerrors(400,"All fields is required")
    }
  //check if user is already exist - username and email
    const existedUser = User.findOne({
         $or:[{ username },{email}]
    })

    if(existedUser){
        throw new APIerrors(400,"username or email is already exist")
    }
  //check for image and check for avatar
    const  avatarLocalPath= req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage)&&req.files.coverImage.length())

    if(!avatarLocalPath){
        throw new APIerrors(400, "avatar photo is required")
    }
  //upload images to cloudinary , avatar
    const avatar = await fileUploaderOnCloudinary(avatarLocalPath);
    const coverImage = await fileUploaderOnCloudinary(coverImageLocalPath);
    if(!avatar){
        throw new APIerrors(400, "avatar photo is required")
    }
  //create user object-create entry in db
    const user = await User.create({
        fullname,
        username:username.toLowerCase(),
        password,
        avatar:avatar.url,
        coverImage:coverImage?.url||"",
        email

    })

  // remove password and refresh token field form respond
    const createdUser = await User.findById(user._id).select(
        "-password -refershToken"
    )
  // check for user creation 
  if(!createdUser){
    throw new APIerrors(500,"something went while registering the user")
  }
  // return res 

  return res.status(200).json(
    new APIResponse(200,createdUser,"user registered successfully")
  )

})

const loginUser = AsyncHandler(async(req,res)=>{
  //take the username and email form request body

  const {username,email,password,}= req.body;

   //check username or email is valid or not 
  if(!email||!username){
    throw new APIerrors(400,"email or username is requrired")
  }

  

   //find the user 
  const user = await User.findOne({
    $or:[{email},{username}]
  })

  if(!user){
    throw new APIerrors(400,"User does not exist")
  }
 
  // check password 
  const ispasswordValid = await user.isPasswordCorrect(password)
  if(!ispasswordValid){
    throw new APIerrors(401,"password is invalid")
  }

  // genrate Access token and refresh token 
   const {accessToken,refreshToken}=await generateAccessTokenAndRefreshToken(user._id)

   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  // send token 

  const options ={
    httpOnly :true,
    secure : true
  }

  // send response 

  return res.status(200).cookie("accessToken",accessToken,options).cookie("refreshToken",refreshToken,options).json(
   new APIResponse(200,{
    user: loggedInUser,accessToken,refreshToken
   },
   "user Logged in "
  )
  )

})

const logoutUser = AsyncHandler(async(req,res)=>{
      await User.findByIdAndUpdate(
        user._id,
        {
          $set:{
            refreshToken:undefined
          }
        },{
          new: true
        }
      )

      const options ={
        httpOnly :true,
        secure : true
      }

      return res
      .status(200)
      .clearCookie("accessToken",options)
      .clearCookie("refreshToken",options)
      .json(new APIResponse(200,{},"User is logged out"))

    
})


export{
  registerUser,
  loginUser,
  logoutUser
}