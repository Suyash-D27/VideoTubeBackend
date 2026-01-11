import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { Like } from "../models/like.model.js"
import { APIerrors } from "../utils/APIerrors.js"
import { APIResponse } from "../utils/APIResponse.js"
import { AsyncHandler } from "../utils/asyncHandler.js"
import { deleteOnCloudinary, fileUploaderOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = AsyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    const pipeline = [];

    if (query) {
        pipeline.push({
            $match: {
                $or: [
                    { title: { $regex: query, $options: "i" } },
                    { discription: { $regex: query, $options: "i" } } // using 'discription' as per model typo
                ]
            }
        });
    }

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new APIerrors(400, "Invalid user id");
        }
        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // Sort
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({ $sort: { createdAt: -1 } });
    }

    // Lookup owner details
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
                {
                    $project: {
                        fullname: 1,
                        username: 1,
                        avatar: 1
                    }
                }
            ]
        }
    });

    pipeline.push({
        $addFields: {
            owner: {
                $first: "$owner"
            }
        }
    });

    const videoAggregate = Video.aggregate(pipeline);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const videos = await Video.aggregatePaginate(videoAggregate, options);

    return res.status(200).json(
        new APIResponse(200, videos, "Videos fetched successfully")
    );
})


const publishAVideo = AsyncHandler(async (req, res) => {
    const { title, description } = req.body // description or discription? Model has 'discription'

    if ([title, description].some((field) => !field || field.trim() === "")) {
        throw new APIerrors(400, "All fields are required (title, description)");
    }

    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new APIerrors(400, "Video file is required");
    }
    if (!thumbnailLocalPath) {
        throw new APIerrors(400, "Thumbnail file is required");
    }

    const videoFileMap = await fileUploaderOnCloudinary(videoFileLocalPath);
    const thumbnailMap = await fileUploaderOnCloudinary(thumbnailLocalPath);

    if (!videoFileMap?.url || !thumbnailMap?.url) {
        throw new APIerrors(500, "Error while uploading files to cloudinary");
    }

    const video = await Video.create({
        videoFile: videoFileMap.url,
        thumnail: thumbnailMap.url, // typo in model 'thumnail'
        title,
        discription: description, // typo in model 'discription'
        duration: videoFileMap.duration || 0,
        owner: req.user?._id
    });

    const createdVideo = await Video.findById(video._id);

    if (!createdVideo) {
        throw new APIerrors(500, "Video upload failed please try again !!!");
    }

    return res.status(201).json(
        new APIResponse(200, createdVideo, "Video published successfully")
    );
})


const getVideoById = AsyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!isValidObjectId(videoId)) {
        throw new APIerrors(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new APIerrors(404, "Video not found");
    }

    // Increment view count
    video.view += 1; // typo in model 'view' instead of views? Keeping it as per model.
    await video.save({ validateBeforeSave: false });

    // Aggregation to get likes count and owner details
    const videoData = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                likesCount: {
                    $size: "$likes"
                },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            fullname: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        }
    ]);

    if (!videoData?.length) {
        throw new APIerrors(404, "Video not found after aggregation");
    }

    return res.status(200).json(
        new APIResponse(200, videoData[0], "Video details fetched successfully")
    );
})


const updateVideo = AsyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

    const { title, description } = req.body;

    if (!isValidObjectId(videoId)) {
        throw new APIerrors(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new APIerrors(404, "Video not found");
    }

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new APIerrors(403, "You are not allowed to update this video");
    }

    const thumbnailLocalPath = req.file?.path;

    if (thumbnailLocalPath) {
        // Upload new thumbnail
        const thumbnailMap = await fileUploaderOnCloudinary(thumbnailLocalPath);
        if (!thumbnailMap?.url) {
            throw new APIerrors(500, "Error updating thumbnail");
        }

        // Delete old thumbnail
        await deleteOnCloudinary(video.thumnail); // typo in model

        video.thumnail = thumbnailMap.url;
    }

    if (title) video.title = title;
    if (description) video.discription = description; // typo in model

    await video.save({ validateBeforeSave: false });

    return res.status(200).json(
        new APIResponse(200, video, "Video updated successfully")
    );
})


const deleteVideo = AsyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new APIerrors(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new APIerrors(404, "Video not found");
    }

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new APIerrors(403, "You are not allowed to delete this video");
    }

    // Delete files from cloudinary
    if (video.videoFile) {
        await deleteOnCloudinary(video.videoFile, "video"); // Assuming a way to distinguish resource type if needed, or helper handles it
    }
    if (video.thumnail) {
        await deleteOnCloudinary(video.thumnail);
    }

    await Video.findByIdAndDelete(videoId);

    // Also delete likes and comments associated with it? 
    // For now just deleting video.
    await Like.deleteMany({ video: videoId });

    return res.status(200).json(
        new APIResponse(200, {}, "Video deleted successfully")
    );
})


const togglePublishStatus = AsyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new APIerrors(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new APIerrors(404, "Video not found");
    }

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new APIerrors(403, "You are not allowed to modify this video");
    }

    video.ispublished = !video.ispublished;
    await video.save({ validateBeforeSave: false });

    return res.status(200).json(
        new APIResponse(200, video, "Video publish status toggled")
    );
})

const getViewsOnVideo = AsyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) {
        throw new APIerrors(400, "Invalid video id");
    }
    const video = await Video.findById(videoId);
    if (!video) {
        throw new APIerrors(404, "Video not found");
    }
    // Just returning the count
    return res.status(200).json(
        new APIResponse(200, { views: video.view }, "Video views fetched successfully")
    );
});

const getLikesOnVideo = AsyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) {
        throw new APIerrors(400, "Invalid video id");
    }

    const likesCount = await Like.countDocuments({ video: videoId });

    return res.status(200).json(
        new APIResponse(200, { likes: likesCount }, "Video likes fetched successfully")
    );
});


export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    getViewsOnVideo,
    getLikesOnVideo
}
