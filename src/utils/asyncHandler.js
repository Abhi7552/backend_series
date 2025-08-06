

const asyncHandler=(requestHandler)=>{
    return (req,res,next)=>{
        Promise.resolve(requestHandler(req,res,next))
                .catch((err)=>next(err));
    }
}


export default asyncHandler;


// const ayncHandler=()=>{}
// const ayncHandler=(func)=>()=>{}
// const ayncHandler=(func)=>async ()=>{}

// const asyncHandler= (fn)=>async(req,res,next)=>{
//     try {
//         await fn(req,res,next)
//     } catch (err) {
//         res.status(err.code||500).json({
//             staus:false,
//             message:err.message
//         })
//     }
// }