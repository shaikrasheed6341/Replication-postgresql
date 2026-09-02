import "dotenv/config";
import { createClient } from "redis";


   const client  =  createClient({url:process.env.RADIS_URL || "redis://shaik:shaik@localhost:6379" });

   client.on("error",(e)=> console.log(e));

async function redisserver(){
 
     if(!client.isOpen){
       await client.connect();
        console.log("connected");
     }
     return client

    

}

export {client,redisserver};