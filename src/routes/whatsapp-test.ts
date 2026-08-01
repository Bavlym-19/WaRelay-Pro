import { Router } from "express";
import { sendRemoteWhatsAppMessage, simulateHumanTyping, setRemoteWhatsAppPresence } from "../lib/remote-whatsapp.js";
import { generateWhatsAppMessage, generateWhatsAppMessageVariants } from "../lib/gemini.js";

const router = Router();

router.post("/whatsapp/test-send", async (req, res) => {
  const { phone, sessionId, name, plotNumber, area, district, neighborhood, useAI, maxDelaySeconds } = req.body as {
    phone: string;
    sessionId?: string;
    name?: string;
    plotNumber?: string;
    area?: string;
    district?: string;
    neighborhood?: string;
    useAI?: boolean;
    maxDelaySeconds?: number;
  };

  if (!phone) return res.status(400).json({ error: "رقم الهاتف مطلوب" });
  if (!sessionId) return res.status(400).json({ error: "اختر جلسة WhatsApp أولاً" });

  const contact = {
    name: name ?? "صاحب الأرض",
    plotNumber: plotNumber ?? "1",
    area: area ?? "",
    district: district ?? "العاشر",
    neighborhood: neighborhood ?? "المجاورة الأولى",
  };

  let message: string;
  if (useAI) {
    try {
      message = await generateWhatsAppMessage({ ...contact, variant: 1 });
    } catch (err) {
      console.error("Gemini error, using fallback:", err);
      message = `يا أهلا أستاذ ${contact.name}\nمكتب عقارات بالعاشر مع حضرتك\nبكلمك بخصوص قطعة الأرض رقم (${contact.plotNumber}) ومساحتها (${contact.area || "غير محددة"}) في ${contact.neighborhood} ${contact.district}\nهل يوجد نيه للبيع؟`;
    }
  } else {
    message = `يا أهلا أستاذ ${contact.name}\nمكتب عقارات بالعاشر مع حضرتك\nبكلمك بخصوص قطعة الأرض رقم (${contact.plotNumber}) في المجاورة (${contact.neighborhood}) بالحي (${contact.district})\nهل يوجد نيه للبيع؟`;
  }

  try {
    const maxDelay = Math.max(60, Math.floor(Number(maxDelaySeconds) || 60));
    const delay = Math.floor(Math.random() * (maxDelay - 60 + 1)) + 60;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay * 1000));
    try {
      await simulateHumanTyping(phone, message, sessionId);
    } catch (presenceError) {
      console.warn("Could not set WhatsApp composing presence:", presenceError);
    }
    let result;
    try {
      result = await sendRemoteWhatsAppMessage(phone, message, sessionId);
    } finally {
      try {
        await setRemoteWhatsAppPresence(phone, "paused", sessionId);
      } catch (presenceError) {
        console.warn("Could not clear WhatsApp composing presence:", presenceError);
      }
    }
    res.json({ success: true, messageId: result.id, message });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: errMsg });
  }
});

router.post("/gemini/generate-message", async (req, res) => {
  const { name, plotNumber, area, district, neighborhood } = req.body as {
    name: string;
    plotNumber: string;
    area?: string;
    district: string;
    neighborhood: string;
  };

  if (!name) return res.status(400).json({ error: "الاسم مطلوب" });

  try {
    const message = await generateWhatsAppMessage({ name, plotNumber: plotNumber ?? "1", area: area ?? "", district: district ?? "العاشر", neighborhood: neighborhood ?? "المجاورة" });
    res.json({ message });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errMsg });
  }
});

router.post("/gemini/generate-message-variants", async (req, res) => {
  const { name, plotNumber, area, district, neighborhood, count } = req.body as {
    name: string;
    plotNumber?: string;
    area?: string;
    district?: string;
    neighborhood?: string;
    count?: number;
  };

  if (!name) return res.status(400).json({ error: "الاسم مطلوب" });

  try {
    const messages = await generateWhatsAppMessageVariants({
      name,
      plotNumber: plotNumber ?? "1",
      area: area ?? "",
      district: district ?? "العاشر",
      neighborhood: neighborhood ?? "المجاورة",
    }, count ?? 10);
    res.json({ messages });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errMsg });
  }
});

export default router;
