import type {Request, Response, NextFunction} from "express";
import type {ValidationResult} from "../types";

export function validate(
  fn: (body: unknown) => ValidationResult
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const result = fn(req.body);
    if (!result.valid) {
      res.status(400).json({error: result.error, field: result.field});
      return;
    }
    next();
  };
}

const SAFE_PARAM = /^[\w\-.]{1,128}$/;

export function sanitizeParam(...params: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const p of params) {
      const v = req.params[p];
      if (!v || !SAFE_PARAM.test(v)) {
        res.status(400).json({error: `Invalid route parameter: ${p}.`});
        return;
      }
    }
    next();
  };
}
