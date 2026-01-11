import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
    getViewsOnVideo,
    getLikesOnVideo
} from "../controller/video.controller.js"
import { verifyJWT } from "../middelware/auth.middelware.js"
import { upload } from "../middelware/multer.middelware.js"

const router = Router();

router.use(verifyJWT); // Apply verifyJWT to all routes in this file

router
    .route("/")
    .get(getAllVideos)
    .post(
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1,
            },
            {
                name: "thumbnail",
                maxCount: 1,
            },
        ]),
        publishAVideo
    );

router
    .route("/:videoId")
    .get(getVideoById)
    .delete(deleteVideo)
    .patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);
router.route("/views/:videoId").get(getViewsOnVideo);
router.route("/likes/:videoId").get(getLikesOnVideo);


export default router;
