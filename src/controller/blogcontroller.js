import { shard1, shard2 } from "../db/database.js";
import { blog } from "../db/schema.js";
import { client } from "../redis/redisconnecation.js";

export const writeblog = async (req, res) => {
  const { id, tittle, desc, counts } = req.body;
  try {
    const result = await shard1.insert(blog).values({ id, tittle, desc, counts }).returning();
    return res.status(200).json({ message: "inserted successfully", data: result });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

export const blogget = async (req, res) => {
  try {
    let key = "message";
     let datapraset = await client.get(key)
     if(datapraset){
      console.log("redis hiteed")
      return res.json({message: JSON.parse(datapraset)});
     }
     const result = await readdb.select().from(blog);
     console.log("db hitting")
      if(!result){
        return res.json({message:"actual database preoble not getting"})
      }
     await client.set(key,JSON.stringify(result),{EX:100});
    return res.status(200).json({ message: result ,sourece:"database" });
      
   
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};