import { Router } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, noticesTable, type NoticeRecord } from "@workspace/db";
import { ListMyNoticesResponse, MarkNoticeReadParams, MarkNoticeReadResponse } from "@workspace/api-zod";
import { requireUser } from "../lib/auth";

const router = Router();
router.use("/notices", requireUser);

function publicNotice({ recipientId: _recipientId, ...notice }: NoticeRecord) {
  return { ...notice, createdAt: notice.createdAt.toISOString(), readAt: notice.readAt?.toISOString() ?? null };
}

router.get("/notices", async (_req, res): Promise<void> => {
  const notices = await db.select().from(noticesTable)
    .where(eq(noticesTable.recipientId, res.locals.user.id))
    .orderBy(desc(noticesTable.createdAt), desc(noticesTable.id));
  res.json(ListMyNoticesResponse.parse(notices.map(publicNotice)));
});

router.patch("/notices/:noticeId/read", async (req, res): Promise<void> => {
  const params = MarkNoticeReadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid notice ID." }); return; }
  const [notice] = await db.update(noticesTable)
    .set({ readAt: sql`coalesce(${noticesTable.readAt}, now())` })
    .where(and(eq(noticesTable.id, params.data.noticeId), eq(noticesTable.recipientId, res.locals.user.id)))
    .returning();
  if (!notice) { res.status(404).json({ error: "Notice not found." }); return; }
  res.json(MarkNoticeReadResponse.parse(publicNotice(notice)));
});

export default router;
