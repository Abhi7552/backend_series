import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app=express();

// app.use() // for use of any middleware
app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))

app.use(express.json({limit:"16kb"})) // for handling json data

app.use(express.urlencoded({extended:true,limit:"16kb"})) // to decode url data

app.use(express.static("public"))  // to access public folder

app.use(cookieParser());  // to store and set cookies in server


export {app};