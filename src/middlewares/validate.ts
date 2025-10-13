import { NextFunction, Request, Response } from "express";
import { z } from "zod";



export const validateQuery =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.parse(req.query);
    res.locals.query = parsed as z.infer<T>;
    next();
  };

export const validateBody =
  <T extends z.ZodTypeAny>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.parse(req.body);
    res.locals.body = parsed as z.infer<T>;
    next();
  };
