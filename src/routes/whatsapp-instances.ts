import { Router } from "express";
import { db } from "@workspace/db";
import { whatsappInstancesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/whatsapp-instances", async (_req, res) => {
  const instances = await db.select().from(whatsappInstancesTable).orderBy(whatsappInstancesTable.createdAt);
  res.json(instances);
});

router.post("/whatsapp-instances", async (req, res) => {
  const { instanceId, label } = req.body as { instanceId: string; label?: string };
  if (!instanceId) return res.status(400).json({ error: "instanceId مطلوب" });

  const [instance] = await db.insert(whatsappInstancesTable)
    .values({ instanceId, label: label ?? `رقم ${instanceId}` })
    .returning();

  res.status(201).json(instance);
});

router.delete("/whatsapp-instances/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(whatsappInstancesTable).where(eq(whatsappInstancesTable.id, id));
  res.status(204).send();
});

router.patch("/whatsapp-instances/:id/toggle", async (req, res) => {
  const id = parseInt(req.params.id);
  const [instance] = await db.select().from(whatsappInstancesTable).where(eq(whatsappInstancesTable.id, id));
  if (!instance) return res.status(404).json({ error: "Not found" });

  await db.update(whatsappInstancesTable)
    .set({ active: !instance.active })
    .where(eq(whatsappInstancesTable.id, id));

  res.json({ ...instance, active: !instance.active });
});

export default router;
