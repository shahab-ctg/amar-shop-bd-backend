import mongoose from 'mongoose';
import {env} from "@/env.js"



let conn: typeof mongoose | null = null;
let connecting: Promise <typeof mongoose> | null = null;

export async function dbConnect(): Promise<typeof mongoose> {
  if(conn) return conn;

  if(!env.MONGODB_URI){
  throw new Error("MongoDb Uri is missing. Check your env file")}
  console.log("✅ MongoDB Connected to", env.MONGODB_DB);


if(!connecting){
  connecting = mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB || "amar-shop-backend"
  }).then((m) => {
    conn = m;
    return m;
  })
  .finally(() => {
    connecting = null;
  })
  
}
console.log("✅ MongoDB Connected to", env.MONGODB_DB);

  
  return connecting;
}
