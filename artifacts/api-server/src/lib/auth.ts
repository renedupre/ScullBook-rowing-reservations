import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db, sessionsTable, usersTable, type UserRecord } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

const scrypt = promisify(scryptCallback);
const COOKIE = "scullbook_session";
export const IDLE_MS = 15 * 60 * 1000;
export const passwordValid = (password: string) =>
  password.length >= 10 && password.length <= 256 && /[A-Z]/.test(password) &&
  /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash || password.length > 256) return false;
  const key = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export function publicUser(user: UserRecord) {
  return { id: user.id, login: user.login, firstName: user.firstName, lastName: user.lastName, role: user.role };
}
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
function cookieOptions(req: Request) {
  return { httpOnly: true, secure: req.secure, sameSite: "lax" as const, path: "/", maxAge: IDLE_MS };
}
export async function createSession(req: Request, res: Response, userId: number) {
  if (req.cookies?.[COOKIE]) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash(req.cookies[COOKIE])));
  const token = randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({ tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + IDLE_MS) });
  res.cookie(COOKIE, token, cookieOptions(req));
}
export async function endSession(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE];
  if (token) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash(token)));
  res.clearCookie(COOKIE, { path: "/", sameSite: "lax", secure: req.secure, httpOnly: true });
}
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE];
  if (!token) { res.status(401).json({ error: "Please log in to continue." }); return; }
  const [record] = await db.select({ user: usersTable }).from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.tokenHash, tokenHash(token)), gt(sessionsTable.expiresAt, new Date())));
  if (!record) {
    res.clearCookie(COOKIE, { path: "/" });
    res.status(401).json({ error: "Your session expired. Please log in again." }); return;
  }
  res.locals.user = record.user;
  await db.update(sessionsTable).set({ expiresAt: new Date(Date.now() + IDLE_MS) }).where(eq(sessionsTable.tokenHash, tokenHash(token)));
  res.cookie(COOKIE, token, cookieOptions(req));
  next();
}
export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if (res.locals.user?.role !== "admin") { res.status(403).json({ error: "Administrator access required." }); return; }
  next();
}
