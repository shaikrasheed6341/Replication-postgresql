import { shard1, shard2 } from "../db/database.js";
import { user } from "../db/schema.js";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { json } from "drizzle-orm/gel-core";
import {separateids} from "../utils/shardingids.js"
const secretKey = process.env.SECRET_KEY || process.env.SECRECT_KEY || "dev_secret_key";

export const registerusers = async (req, res) => {
  const { id, name, email, password } = req.body;

  if (!id || !name || !email || !password) {
    return res.status(400).json({ message: "Please provide id, name, email, and password." });
  }
       
  try {

     const db = separateids(id);

    
   const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, email));
    if (existingUser.length > 0) {
      return res.status(409).json({ message: "User already exists with this email." });
    }

    const hashpassword = await bcrypt.hash(password, 10);
     const result = await db
      .insert(user)
      .values({ id: Number(id), name, email, password: hashpassword })
      .returning();  
    return res.status(201).json({
      message: "User registered successfully.",
      data: result,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
};

export const login = async (req, res) => {
  const { id, email, password } = req.body;

  if ((!id && !email) || !password) {
    return res.status(400).json({ message: "Please provide id or email and password." });
  }

  try {
    let userdetails = [];

    if (id) {
      userdetails = await shard1
        .select()
        .from(user)
        .where(eq(user.id, Number(id)));
    }
   
    if (!userdetails.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userdetails[0];
    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    const token = jwt.sign(
      {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: "user",
      },
      secretKey,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      maxAge: 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful.",
      token,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
};

export const userget = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Authentication required. No user in token." });
    }
     const db =     sparateids(req.user.id);
    const result = await db
      .select()
      .from(user)
      .where(eq(user.id, Number(req.user.id)));

    if (!result.length) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      message: "User fetched successfully.",
      data: result[0],
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
