import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

type MongoServerErrror = {
  name: string;
  code?: number;
  keyValue?: Record<string, unknown>;
}

function isMongoServerError(e: unknown): e is MongoServerErrror{
  return typeof e === "object" && e !== null && "name" in e && (e as any).name == "MongoServerError";
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction){
  if(err instanceof ZodError){

    return res.status(400).json({ok: false, code: "VALIDATON_ERROR", errors: err.flatten()});

    if(isMongoServerError(err) && err.code === 11000)
      return res.status(409).json({ok: false, code: "DUPLICATE_KEY", details: err.keyValue})


  }

  if(err?.name === "MongoServerError" && err.code === 11000){
    return res.status(409).json({ok: true, code: "DUPLICATE_KEY", details: err.keyValue })

  }

   const status = (err as { statusCode?: number }).statusCode ?? 500;
   const message =
     (err as { message?: string }).message ?? "Something went wrong";
   return res
     .status(status)
     .json({ ok: false, code: "INTERNAL_ERROR", message });
  }
