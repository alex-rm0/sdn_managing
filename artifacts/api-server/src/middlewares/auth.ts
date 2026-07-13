import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  if (req.session.userRole !== "admin") {
    res.status(403).json({ error: "Acesso negado. Apenas administradores." });
    return;
  }
  next();
}

export async function attachUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.session.userId) {
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
      if (user) {
        (req as any).currentUser = user;
      }
    } catch {
      // ignore
    }
  }
  next();
}
