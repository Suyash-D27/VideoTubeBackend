import mongoose, { isValidObjectId } from "mongoose"
import { User } from "../models/user.model.js"
import { subscription } from "../models/subscription.model.js"
import { APIerrors } from "../utils/APIerrors.js"
import { APIResponse } from "../utils/APIResponse.js"
import { AsyncHandler } from "../utils/asyncHandler.js"


const toggleSubscription = AsyncHandler(async (req, res) => {
    const { channelId } = req.params
    // TODO: toggle subscription
    if (!isValidObjectId(channelId)) {
        throw new APIerrors(400, "Invalid channel id")
    }

    const isSubscribed = await subscription.findOne({
        subscriber: req.user?._id,
        channel: channelId
    })

    if (isSubscribed) {
        await subscription.findByIdAndDelete(isSubscribed._id)
        return res
            .status(200)
            .json(new APIResponse(200, {}, "unsubscribed successfully"))
    }

    await subscription.create({
        subscriber: req.user?._id,
        channel: channelId
    })

    return res
        .status(200)
        .json(new APIResponse(200, {}, "subscribed successfully"))

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = AsyncHandler(async (req, res) => {
    const { channelId } = req.params

    if (!isValidObjectId(channelId)) {
        throw new APIerrors(400, "Invalid channel id")
    }

    const subscribers = await subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                subscriber: {
                    $first: "$subscriber"
                }
            }
        }
    ])

    return res
        .status(200)
        .json(new APIResponse(200, subscribers, "subscribers fetched successfully"))
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = AsyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    if (!isValidObjectId(subscriberId)) {
        throw new APIerrors(400, "Invalid subscriber id")
    }

    const subscribedChannels = await subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullname: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                channel: {
                    $first: "$channel"
                }
            }
        }
    ])

    return res
        .status(200)
        .json(new APIResponse(200, subscribedChannels, "subscribed channels fetched successfully"))
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
