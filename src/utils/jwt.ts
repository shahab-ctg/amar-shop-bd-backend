import {env} from "../env.js"
import jwt from "jsonwebtoken"

export type JwtPayload = {sub: string; email: string; role: "ADMIN"};


export  function signAccessToken(payload: JwtPayload): string {
  const secret = env.JWT_SECRET || "dev_secret_change_me";
  return jwt.sign(payload, secret, {expiresIn: env.JWT_EXPIRES_IN || "1d"})

 
}


export function verifyAccessToken(token: string): JwtPayload{
  const secret = env.JWT_SECRET || "";

   return jwt.verify(token, secret) as JwtPayload;
}