import { Request, Response, NextFunction } from "express";

export interface AdminSession {
  userId?: number;
  role?: string;
  name?: string;
}

export function requireAdminPage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const session = req.session as AdminSession;
  if (!session.userId || session.role !== "ADMIN") {
    return res.redirect("/admin/login");
  }
  next();
}

export function redirectIfLoggedIn(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const session = req.session as AdminSession;
  if (session.userId && session.role === "ADMIN") {
    return res.redirect("/admin/products");
  }
  next();
}
