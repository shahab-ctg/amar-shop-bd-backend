import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";


export function errorMiddleware(err: any, _req: Request, res: Response, _next: NextFunction){
  if(err instanceof ZodError){

    return res.status(400).json({ok: false, code: "VALIDATON_ERROR", errors: err.flatten()})

  }

  if(err?.name === "MongoServerError" && err.code === 11000){
    return res.status(409).json({ok: false, code: err.code || "INTERNAL_ERROR", message: err.message || "Something went wrong"})
  }
}