import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { RegisterRowerBody, RegisterRowerResponse, LoginBody, LoginResponse, GetCurrentUserResponse, ChangePasswordBody } from "@workspace/api-zod";
import { createSession, endSession, hashPassword, passwordValid, publicUser, requireAdmin, requireUser, verifyPassword } from "../lib/auth";

const router = Router();
const attempts = new Map<string, { count: number; until: number }>();
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterRowerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Please enter a valid email, names, and a password of at least 10 characters." }); return; }
  const data = parsed.data;
  if (!passwordValid(data.password) || data.password !== data.passwordConfirm) {
    res.status(400).json({ error: "Passwords must match and contain at least 10 characters, uppercase and lowercase letters, a number, and a special character." }); return;
  }
  if (!data.firstName.trim() || !data.lastName.trim()) { res.status(400).json({ error: "First and last names are required." }); return; }
  const login = data.email.trim().toLowerCase();
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.login, login));
  if (existing) { res.status(409).json({ error: "An account with this email already exists." }); return; }
  const [user] = await db.insert(usersTable).values({
    login, firstName: data.firstName.trim(), lastName: data.lastName.trim(), role: "rower", passwordHash: await hashPassword(data.password),
  }).returning();
  await createSession(req, res, user.id);
  res.status(201).json(RegisterRowerResponse.parse({ user: publicUser(user) }));
});
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Enter your email or admin ID and password." }); return; }
  const key = req.ip ?? "unknown";
  const limit = attempts.get(key);
  if (limit && limit.until > Date.now() && limit.count >= 10) { res.status(429).json({ error: "Too many login attempts. Please try again in 15 minutes." }); return; }
  if (!limit || limit.until <= Date.now()) attempts.set(key, { count: 0, until: Date.now() + 15 * 60 * 1000 });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.login, parsed.data.login.trim().toLowerCase()));
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    attempts.get(key)!.count++;
    res.status(401).json({ error: "Incorrect email/admin ID or password." }); return;
  }
  attempts.delete(key);
  await createSession(req, res, user.id);
  res.json(LoginResponse.parse({ user: publicUser(user) }));
});
router.get("/auth/me", requireUser, (_req, res) => { res.json(GetCurrentUserResponse.parse(publicUser(res.locals.user))); });
router.post("/auth/logout", async (req, res) => { await endSession(req, res); res.sendStatus(204); });
router.post("/auth/activity", requireUser, (_req, res) => { res.sendStatus(204); });
router.post("/auth/change-password", requireUser, requireAdmin, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success || !passwordValid(parsed.data.newPassword) || parsed.data.newPassword !== parsed.data.newPasswordConfirm) {
    res.status(400).json({ error: "New passwords must match and contain at least 10 characters, uppercase and lowercase letters, a number, and a special character." }); return;
  }
  const user = res.locals.user;
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) { res.status(400).json({ error: "Current password is incorrect." }); return; }
  await db.update(usersTable).set({ passwordHash: await hashPassword(parsed.data.newPassword) }).where(eq(usersTable.id, user.id));
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, user.id));
  await createSession(req, res, user.id);
  res.sendStatus(204);
});
export default router;
