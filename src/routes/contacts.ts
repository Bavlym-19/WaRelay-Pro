import { Router } from "express";
import { db } from "@workspace/db";
import { contactsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.patch("/contacts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, notes } = req.body as { status?: string; notes?: string };

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db.update(contactsTable).set(updates).where(eq(contactsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });

  res.json({
    id: updated.id,
    campaignId: updated.campaignId,
    name: updated.name,
    phone: updated.phone,
    plotNumber: updated.plotNumber,
    area: updated.area,
    district: updated.district,
    neighborhood: updated.neighborhood,
    status: updated.status,
    sentAt: updated.sentAt?.toISOString() ?? null,
    notes: updated.notes ?? null,
  });
});

export default router;
