import {AnyZodObject} from "zod";

import { NextFunction, Request, Response } from "express";



export const validateQuery = (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
  req.query = schema.parse(req.query);
  next();
}

export const validateBody = (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
  req.body = schema.parse(req.body);
  next();
}