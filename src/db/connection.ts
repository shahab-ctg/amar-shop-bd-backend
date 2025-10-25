

import mongoose from "mongoose";
import { env } from "../env";


let conn: typeof mongoose | null = null;
let connecting: Promise<typeof mongoose> | null = null;

export  async function dbConnect(): Promise<typeof mongoose> {
  if (conn) return conn;

  if (!env.MONGODB_URI) {
    throw new Error("MongoDb Uri is missing. Check your env file");
  }

  if (!connecting) {
    connecting = mongoose
      .connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB || "shodaigram",
      })
      .then((m) => {
        conn = m;
        return m;
      })
      .finally(() => {
        connecting = null;
      });
  }

  return connecting;
}
