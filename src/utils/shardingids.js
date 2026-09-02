import crypto from "crypto";
import { shard1, shard2 } from "../db/database.js";

export const separateids = (id) => {
    const hash = crypto
        .createHash("sha256")
        .update(String(id))
        .digest("hex");
    
        console.log(hash + "this hash what is generate");

    const number = parseInt(hash.substring(0, 8), 16);
         
    console.log(number + "this hash number ")
    if (number % 2 === 0) {
        console.log("storing in shard 1");
        return shard1;
    } else {
        console.log("storing in shard 2");
        return shard2;
    }
};