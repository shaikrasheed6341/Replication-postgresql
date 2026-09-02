import express from "express";
import cookieParser from "cookie-parser";
import blogroute from "./src/route/blogroute.js";
import { redisserver } from "./src/redis/redisconnecation.js";

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

redisserver();
app.use("/api", blogroute);

app.listen(port, () => {
  console.log("Server is running on port", port);
});