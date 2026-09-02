import { blogget, writeblog } from "../controller/blogcontroller.js";
import { registerusers, userget, login } from "../controller/usercontroller.js";
import express from "express";
import { tokenverify, authorize } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerusers);
router.post("/login", login);
router.post("/writeblog", tokenverify, writeblog);
router.get("/blogget", tokenverify, blogget);
router.get("/userget", tokenverify, userget)

export default router;