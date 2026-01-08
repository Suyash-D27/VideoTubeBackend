import mongoose,{model, Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile:{
            type:String, //cloudnery URL
            required:true
        },
        thumnail:{
            type:String, //cloudnery URL
            required:true
        },
        title:{
            type:String, //cloudnery URL
            required:true
        },
        discription:{
            type:String, //cloudnery URL
            required:true
        },
        duration:{
            type:Number,// cloudnery URL
            required:true
        },
        view:{
            type:Number,// cloudnery URL
            default:0
        },
        ispublished:{
            type:Boolean,
            default:true
        },
        owner:{
            type:Schema.Types.ObjectId,
            ref:"User"
        }

    },
    {
    timestamps:true
    }
)

mongoose.plugin(mongooseAggregatePaginate)


export const Video = mongoose.model("Video",videoSchema)