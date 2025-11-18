import { Router } from "express";
import { registerUser } from "../controller/user.controller.js";
import { upload } from "../middelware/multer.middelware.js"; 

const userRouter = Router();

userRouter.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser
)





export default Router