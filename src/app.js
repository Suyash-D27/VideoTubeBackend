import express from "express";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes.js";

const app = express();

// 🔹 ROUTES THAT USE MULTER FIRST
app.use("/api/v1/user", userRouter);

// 🔹 BODY PARSERS AFTER
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// 🔹 STATIC
app.use(express.static("public"));

// 🔹 COOKIE PARSER
app.use(cookieParser());



export { app };
