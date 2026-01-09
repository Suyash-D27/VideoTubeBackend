import { v2 as cloudinary } from 'cloudinary'
import fs from "fs"
import { APIResponse } from './APIResponse';


cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_CLOUD_APIKEY,
    api_secret: process.env.CLOUDINARY_CLOUD_API_SECRET || process.env.CLOUDINARY_CLOUD_API_SCERET // Fallback for typo
});

const fileUploaderOnCloudinary = async (localFilepath) => {
    try {
        if (!localFilepath) return null;
        // upload file in cloudinary
        const respond = await cloudinary.uploader.upload(localFilepath, {
            resource_type: "auto"
        });
        // console.log("file is uploaded in the public url is", respond.url)
        return respond;

    } catch (error) {
        fs.unlinkSync(localFilepath)// delete the save  temporary file in sever if error have while uploading
        return null;
    }
}


const deleteOnCloudinary = async (oldUrl) => {

    const publicId = extractPublicId(oldUrl)

    const result =  await cloudinary.uploader.destroy(publicId,{invalidate:true})

    return result;
    
}


const extractPublicId = (url) => {
  // Regex captures everything after /upload/v[digits]/ and before the file extension
  const regex = /\/v\d+\/([^.]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export { fileUploaderOnCloudinary , deleteOnCloudinary}