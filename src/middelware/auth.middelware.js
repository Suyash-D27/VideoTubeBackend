import { APIerrors } from "../utils/APIerrors.js";
import { AsyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";



export const verifyJWT = AsyncHandler(async (req, resizeBy, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")

        if (!token) {
            throw new APIerrors(401, "Unauthorized request")
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if (!user) {
            throw new APIerrors(401, "invalid Access token")
        }

        req.user = user;
        next()
    } catch (error) {
        throw new APIerrors(401, error?.message || "invalid access token")
    }

})