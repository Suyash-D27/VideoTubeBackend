import express from "express";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes.js";

const app = express();

// 🔹 BODY PARSERS
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

// 🔹 ROUTES
app.use("/api/v1/user", userRouter);

// 🔹 STATIC
app.use(express.static("public"));



export { app };
