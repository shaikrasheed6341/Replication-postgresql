import jwt from "jsonwebtoken";
import "dotenv/config";
import "dotenv/config"
import { json } from "express";

const secretKey = process.env.SECRET_KEY || process.env.SECRECT_KEY || "dev_secret_key";

export const tokenverify = (req,res,next)=>{
      const  authheader = req.headers.authorization;
       if(!authheader){
        console.log("ti is not persent");
       }
      console.log(authheader);
      const result = authheader.split(' ')[1];
      console.log(result + "here i am spliting thetoken ");
      const verfied =   jwt.verify(result,process.env.SECRECT_KEY);
      req.user = verfied;         
     

     next();


}


export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }



    if (roles.length > 0 && !roles.includes(req.user.role)) {
      
      return res.status(403).json({ message: "Forbidden. You do not have permission." });
    }

    next();
  };
};

