
import dotenv from 'dotenv';

dotenv.config();

import connectDB from "./DB/index.js";
import { app } from './app.js';

connectDB()
.then(()=>{
    app.on("error",(error)=>{
        console.log("ERR:",error)
        throw error
    })
    const port = process.env.PORT||5000
     app.listen(port,()=>{
        console.log(`connected to port ${port}`)
     })
})
.catch((err)=>{
    console.log("MONGODB connecction failed",err)
})















// import mongoose from "mongoose";
// import {DB_NAME} from "./constant"

// import express from "express"
// const app = express();

// ;(async()=>{
//     try {
//        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
//        app.on("error",(error)=>{
//         console.log("ERR:",error)
//         throw error
//        })

//      app.listen(process.env.PORT, ()=>{
//         console.log(`app is listening on port ${process.env.PORT}`);

//      })
    
//     } catch (error) {
//         console.error("Error",error)
//         throw err
//     }
// })()