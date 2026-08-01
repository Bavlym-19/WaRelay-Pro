import { Router } from "express";
import { db } from "@workspace/db";
import { campaignsTable, contactsTable, whatsappMessageHistoryTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { buildMessage } from "../lib/whatsapp.js";
import { sendRemoteWhatsAppMessage, simulateHumanTyping, setRemoteWhatsAppPresence } from "../lib/remote-whatsapp.js";
import { generateWhatsAppMessage } from "../lib/gemini.js";

const router = Router();

function computeCounts(contacts: { status: string }[]) {
  const counts = { sent: 0, pending: 0, failed: 0, willSell: 0, willBuy: 0, notInterested: 0 };
  for (const c of contacts) {
    if (c.status === "sent") counts.sent++;
    else if (c.status === "pending") counts.pending++;
    else if (c.status === "failed") counts.failed++;
    else if (c.status === "will_sell") counts.willSell++;
    else if (c.status === "will_buy") counts.willBuy++;
    else if (c.status === "not_interested") counts.notInterested++;
  }
  return counts;
}

router.get("/campaigns", async (_req, res) => {
  const campaigns = await db.select().from(campaignsTable).orderBy(sql`${campaignsTable.createdAt} DESC`);
  const result = await Promise.all(campaigns.map(async (c) => {
    const contacts = await db.select({ status: contactsTable.status }).from(contactsTable).where(eq(contactsTable.campaignId, c.id));
    const counts = computeCounts(contacts);
    return {
      id: c.id,
      name: c.name,
      createdAt: c.createdAt.toISOString(),
      status: c.status,
      totalContacts: contacts.length,
      sentCount: counts.sent,
      pendingCount: counts.pending,
      failedCount: counts.failed,
      willSellCount: counts.willSell,
      willBuyCount: counts.willBuy,
      notInterestedCount: counts.notInterested,
    };
  }));
  res.json(result);
});

router.post("/campaigns", async (req, res) => {
  const { name, messageTemplate, messageTemplates, useAI, contacts } = req.body as {
    name: string;
    messageTemplate?: string;
    messageTemplates?: string[];
    useAI?: boolean;
    contacts: Array<{ name: string; phone: string; plotNumber: string; area?: string; district: string; neighborhood: string }>;
    minDelaySeconds?: number;
    maxDelaySeconds?: number;
    pauseEveryMessages?: number;
    pauseDurationSeconds?: number;
  };

  const minDelaySeconds = Math.max(60, Math.floor(Number(req.body.minDelaySeconds) || 60));
  const maxDelaySeconds = Math.max(minDelaySeconds, Math.floor(Number(req.body.maxDelaySeconds) || 300));
  const pauseEveryMessages = Math.max(0, Math.floor(Number(req.body.pauseEveryMessages) || 0));
  const pauseDurationSeconds = Math.max(60, Math.floor(Number(req.body.pauseDurationSeconds) || 120));
  const [campaign] = await db.insert(campaignsTable).values({
    name,
    messageTemplate,
    messageTemplates: Array.isArray(messageTemplates) ? JSON.stringify(messageTemplates.filter((item) => typeof item === "string" && item.trim())) : null,
    useAI: Boolean(useAI),
    status: "draft",
    minDelaySeconds,
    maxDelaySeconds,
    pauseEveryMessages,
    pauseDurationSeconds,
  }).returning();

  if (contacts && contacts.length > 0) {
    await db.insert(contactsTable).values(contacts.map((c) => ({
      campaignId: campaign.id,
      name: c.name,
      phone: c.phone,
      plotNumber: c.plotNumber,
      area: c.area ?? "",
      district: c.district,
      neighborhood: c.neighborhood,
      status: "pending" as const,
    })));
  }

  res.status(201).json({
    id: campaign.id,
    name: campaign.name,
    createdAt: campaign.createdAt.toISOString(),
    status: campaign.status,
    totalContacts: contacts?.length ?? 0,
    sentCount: 0,
    pendingCount: contacts?.length ?? 0,
    failedCount: 0,
    willSellCount: 0,
    willBuyCount: 0,
    notInterestedCount: 0,
  });
});

router.get("/campaigns/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Not found" });

  const contacts = await db.select().from(contactsTable).where(eq(contactsTable.campaignId, id));
  const counts = computeCounts(contacts);

  res.json({
    id: campaign.id,
    name: campaign.name,
    createdAt: campaign.createdAt.toISOString(),
    status: campaign.status,
    totalContacts: contacts.length,
    sentCount: counts.sent,
    pendingCount: counts.pending,
    failedCount: counts.failed,
    willSellCount: counts.willSell,
    willBuyCount: counts.willBuy,
    notInterestedCount: counts.notInterested,
    contacts: contacts.map((c) => ({
      id: c.id,
      campaignId: c.campaignId,
      name: c.name,
      phone: c.phone,
      plotNumber: c.plotNumber,
      area: c.area,
      district: c.district,
      neighborhood: c.neighborhood,
      sendSessionId: c.sendSessionId,
      status: c.status,
      sentAt: c.sentAt?.toISOString() ?? null,
      notes: c.notes ?? null,
    })),
  });
});

router.delete("/campaigns/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
  res.status(204).send();
});

router.post("/campaigns/:id/send", async (req, res) => {
  const body = req.body as { sessionIds?: unknown; sessionId?: unknown; maxContacts?: unknown };
  const requestedSessionIds: string[] = Array.isArray(body.sessionIds)
    ? (body.sessionIds as unknown[]).filter((value: unknown): value is string =>
      value === "session1" || value === "session2" || value === "session3")
    : (typeof body.sessionId === "string" ? [body.sessionId] : []);
  const sessionIds = [...new Set(requestedSessionIds)];
  if (sessionIds.length === 0) return res.status(400).json({ error: "اختر جلسة WhatsApp واحدة على الأقل" });
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Not found" });

  const pendingContacts = await db.select().from(contactsTable)
    .where(eq(contactsTable.campaignId, id));

  const toSend = pendingContacts.filter((c) => c.status === "pending");
  const requestedMaxContacts = Math.floor(Number(body.maxContacts));
  const maxContacts = Number.isFinite(requestedMaxContacts) && requestedMaxContacts > 0
    ? Math.min(requestedMaxContacts, toSend.length)
    : toSend.length;
  const selectedContacts = toSend.slice(0, maxContacts);
  if (selectedContacts.length === 0) {
    return res.status(400).json({ error: "لا توجد أرقام معلقة للإرسال" });
  }

  await db.update(campaignsTable).set({ status: "sending" }).where(eq(campaignsTable.id, id));

  res.json({ queued: selectedContacts.length, message: `تم إضافة ${selectedContacts.length} رسالة للإرسال` });

  // Send in background with delay between messages
  (async () => {
    let approvedTemplates: string[] = [];
    try {
      const parsed = campaign.messageTemplates ? JSON.parse(campaign.messageTemplates) : [];
      if (Array.isArray(parsed)) {
        approvedTemplates = parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
      }
    } catch {
      approvedTemplates = campaign.messageTemplate ? [campaign.messageTemplate] : [];
    }
    let sentCount = 0;
    let failedCount = 0;
    const sessionPausedUntil = new Map<string, number>();
    const sessionReadyAt = new Map<string, number>();
    const sessionRisk = new Map<string, { sent: number; failed: number; reconnects: number }>();

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitRandomDelay = async () => {
      const delaySeconds = Math.floor(
        Math.random() * (campaign.maxDelaySeconds - campaign.minDelaySeconds + 1),
      ) + campaign.minDelaySeconds;
      console.log(`Waiting ${delaySeconds}s before the next campaign message`);
      await sleep(delaySeconds * 1000);
    };
    const waitForSafeHours = async () => {
      while (true) {
        const now = new Date();
        const hour = now.getHours();
        if (hour >= 7 && hour < 24) return;
        const nextMorning = new Date(now);
        nextMorning.setHours(7, 0, 0, 0);
        if (hour >= 0 && hour < 7) {
          await sleep(Math.max(1000, nextMorning.getTime() - now.getTime()));
        } else {
          return;
        }
      }
    };

    // Wait before the first message too, using the same randomized range.
    await waitForSafeHours();
    await waitRandomDelay();

    const chooseSession = async () => {
      await waitForSafeHours();
      const currentHour = new Date().getHours();
      for (const id of sessionIds) {
        if (!sessionReadyAt.has(id)) {
          if (currentHour < 10) {
            const start = new Date();
            start.setHours(7, 0, 0, 0);
            const end = new Date();
            end.setHours(10, 0, 0, 0);
            sessionReadyAt.set(id, start.getTime() + Math.floor(Math.random() * (end.getTime() - start.getTime())));
          } else {
            sessionReadyAt.set(id, Date.now());
          }
        }
      }
      let now = Date.now();
      let available = sessionIds.filter((id) =>
        (sessionPausedUntil.get(id) ?? 0) <= now && (sessionReadyAt.get(id) ?? 0) <= now);
      if (!available.length) {
        const nextReadyAt = Math.min(...sessionIds.map((id) =>
          Math.max(sessionPausedUntil.get(id) ?? 0, sessionReadyAt.get(id) ?? 0)));
        await sleep(Math.max(1000, nextReadyAt - now));
        now = Date.now();
        available = sessionIds.filter((id) =>
          (sessionPausedUntil.get(id) ?? 0) <= now && (sessionReadyAt.get(id) ?? 0) <= now);
      }
      const candidates = available.length ? available : sessionIds;
      // Rotate randomly, while preferring sessions with fewer failures.
      const weighted = candidates.flatMap((id) => {
        const stats = sessionRisk.get(id) ?? { sent: 0, failed: 0, reconnects: 0 };
        return Array(Math.max(1, 4 - stats.failed - stats.reconnects)).fill(id);
      });
      return weighted[Math.floor(Math.random() * weighted.length)] ?? sessionIds[0];
    };

    for (const contact of selectedContacts) {
      await waitForSafeHours();
      const selectedSessionId = await chooseSession();
      const risk = sessionRisk.get(selectedSessionId) ?? { sent: 0, failed: 0, reconnects: 0 };
      sessionRisk.set(selectedSessionId, risk);
      try {
        const previousMessages = await db.select({ message: whatsappMessageHistoryTable.message })
          .from(whatsappMessageHistoryTable)
          .where(eq(whatsappMessageHistoryTable.phone, contact.phone))
          .orderBy(sql`${whatsappMessageHistoryTable.sentAt} DESC`);
        const previousMessageTexts = previousMessages.map((item) => item.message);
        let message: string;
        if (approvedTemplates.length > 0) {
          message = buildMessage(approvedTemplates[sentCount % approvedTemplates.length], contact, sentCount, previousMessageTexts);
        } else if (campaign.useAI) {
          try {
            message = await generateWhatsAppMessage({
              ...contact,
              variant: sentCount + previousMessageTexts.length,
              previousMessages: previousMessageTexts,
            });
          } catch {
            message = buildMessage(campaign.messageTemplate, contact, sentCount, previousMessageTexts);
          }
        } else {
          message = buildMessage(campaign.messageTemplate, contact, sentCount, previousMessageTexts);
        }
        let lastError: unknown;
        let sent = false;
        // A remote WhatsApp session can briefly reconnect between the status
        // check and the actual send. Retry those transient failures.
        for (let attempt = 1; attempt <= 3 && !sent; attempt++) {
          try {
            try {
              await simulateHumanTyping(contact.phone, message, selectedSessionId);
            } catch (presenceError) {
              console.warn(`Could not set composing presence for ${contact.phone}:`, presenceError);
            }
            await sendRemoteWhatsAppMessage(contact.phone, message, selectedSessionId);
            sent = true;
            risk.sent++;
          } catch (err) {
            lastError = err;
            const errorText = err instanceof Error ? err.message : String(err);
            const transient = /Connection Closed|يعيد الاتصال|ما زال يتصل|غير مستقرة|timeout|timed out/i.test(errorText);
            if (transient) risk.reconnects++;
            if (!transient || attempt === 3) break;
            await new Promise((resolve) => setTimeout(resolve, 3000));
          } finally {
            try {
              await setRemoteWhatsAppPresence(contact.phone, "paused", selectedSessionId);
            } catch (presenceError) {
              console.warn(`Could not clear composing presence for ${contact.phone}:`, presenceError);
            }
          }
        }

        if (!sent) throw lastError;
        sentCount++;
        await db.update(contactsTable)
        .set({ status: "sent", sentAt: new Date(), sendSessionId: selectedSessionId, notes: null })
          .where(eq(contactsTable.id, contact.id));
        await db.insert(whatsappMessageHistoryTable).values({
          phone: contact.phone,
          message,
          campaignId: id,
        });
      } catch (err) {
        failedCount++;
        risk.failed++;
        const errorText = err instanceof Error ? err.message : String(err);
        console.error(`Failed to send to ${contact.phone}:`, errorText);
        await db.update(contactsTable)
          .set({ status: "failed", sendSessionId: selectedSessionId, notes: errorText })
          .where(eq(contactsTable.id, contact.id));
      }
      if (campaign.pauseEveryMessages > 0 && sentCount > 0 && sentCount % campaign.pauseEveryMessages === 0 && contact !== selectedContacts[selectedContacts.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, campaign.pauseDurationSeconds * 1000));
      }
      // Random delay between the selected bounds; never less than 60 seconds.
      if (contact !== selectedContacts[selectedContacts.length - 1]) {
        await waitRandomDelay();
      }
    }

    // Keep partial batches resumable and preserve a partial status when any contact failed.
    const finalContacts = await db.select({ status: contactsTable.status })
      .from(contactsTable)
      .where(eq(contactsTable.campaignId, id));
    const finalCounts = computeCounts(finalContacts);
    const finalStatus = finalCounts.pending > 0
      ? (sentCount > 0 ? "partial" : "failed")
      : (finalCounts.failed > 0 ? "partial" : "done");
    await db.update(campaignsTable).set({ status: finalStatus }).where(eq(campaignsTable.id, id));
  })();
});

router.get("/campaigns/:id/export", async (req, res) => {
  const id = parseInt(req.params.id);
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) return res.status(404).json({ error: "Not found" });

  const contacts = await db.select().from(contactsTable).where(eq(contactsTable.campaignId, id));

  const statusLabel: Record<string, string> = {
    pending: "لم يُرسل",
    sent: "أُرسلت",
    will_sell: "يريد البيع",
    will_buy: "يريد الشراء",
    not_interested: "غير مهتم",
  };

  res.json({
    campaignName: campaign.name,
    rows: contacts.map((c) => ({
      name: c.name,
      phone: c.phone,
      plotNumber: c.plotNumber,
      area: c.area,
      district: c.district,
      neighborhood: c.neighborhood,
      sendSessionId: c.sendSessionId,
      status: statusLabel[c.status] ?? c.status,
      sentAt: c.sentAt?.toISOString() ?? null,
      notes: c.notes ?? null,
    })),
  });
});

router.get("/campaigns/:id/stats", async (req, res) => {
  const id = parseInt(req.params.id);
  const contacts = await db.select({ status: contactsTable.status }).from(contactsTable).where(eq(contactsTable.campaignId, id));
  const counts = computeCounts(contacts);
  res.json({
    total: contacts.length,
    sent: counts.sent,
    pending: counts.pending,
    willSell: counts.willSell,
    willBuy: counts.willBuy,
    notInterested: counts.notInterested,
  });
});

export default router;
