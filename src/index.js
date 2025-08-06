// require('dotenv').config({path:'./env'})

// import dotenv from "dotenv";
// dotenv.config({
//     path:'./env'
// })

import 'dotenv/config'
import connectDB from "./db/index.js";
import app from './app.js';

connectDB()
.then(()=>{
    app.listen(process.env.PORT ||  8000,()=>{
        console.log(`Server is listening on port : ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log(`DB Connection Failure :`,err);
})




// ;(async ()=>{})()  better approach to handle IIFE 
/*const app=express();
(async ()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
        app.on('error',(err)=>{
            console.log("Error in DB :",err);
            throw err;
        })

        app.listen(process.env.PORT,()=>{
            console.log(`App is listening on port : ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("DB Connection Error :",error)
    }
})()*/