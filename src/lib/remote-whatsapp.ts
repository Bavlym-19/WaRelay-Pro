const REMOTE_WHATSAPP_URL = "https://server-watsapp2.onrender.com";
const REMOTE_REQUEST_TIMEOUT_MS = 15000;

export interface RemoteSendResult {
  id: string;
  instanceId: string;
}

export type RemoteBanStatus = "confirmed" | "not_reported" | "unknown";

export interface RemoteSessionHealth {
  sessionId: string;
  status: string;
  connected: boolean;
  sendAttempts: number;
  confirmedBanEvents: number;
  banRatePercent: number | null;
  banSignals: string[];
  banStatus: RemoteBanStatus;
  banEvidence: string | null;
}

export interface RemoteSessionHealthResult {
  sessions: RemoteSessionHealth[];
  totalSendAttempts: number;
  totalConfirmedBanEvents: number;
  banRatePercent: number | null;
  measurementStatus: "available" | "unavailable";
  measurementReason: string;
}

interface RemoteSessionHealthPayload {
  sessionId: string;
  sendAttempts: number;
  confirmedBanEvents: number;
  currentStatus: string;
  banSignals: string[];
}

function parseRemoteSessionHealthPayload(payload: unknown): RemoteSessionHealthPayload[] {
  if (!Array.isArray(payload)) {
    throw new Error("صيغة /sessions/health غير صالحة: المتوقع مصفوفة جلسات");
  }

  return payload.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`بيانات جلسة رقم ${index + 1} غير صالحة في /sessions/health`);
    }
    const item = entry as Record<string, unknown>;
    const sessionId = typeof item.sessionId === "string" && item.sessionId.trim() ? item.sessionId : "";
    const currentStatus = typeof item.currentStatus === "string" ? item.currentStatus : "";
    const banSignals = Array.isArray(item.banSignals) && item.banSignals.every((signal) => typeof signal === "string")
      ? item.banSignals as string[]
      : null;
    const sendAttempts = item.sendAttempts;
    const confirmedBanEvents = item.confirmedBanEvents;

    if (!sessionId || !currentStatus || !banSignals ||
      !Number.isInteger(sendAttempts) || (sendAttempts as number) < 0 ||
      !Number.isInteger(confirmedBanEvents) || (confirmedBanEvents as number) < 0) {
      throw new Error(`بيانات الجلسة ${sessionId || index + 1} ناقصة أو غير صالحة في /sessions/health`);
    }
    if ((confirmedBanEvents as number) > (sendAttempts as number)) {
      throw new Error(`عدد أحداث الحظر أكبر من عدد المحاولات للجلسة ${sessionId}`);
    }

    return {
      sessionId,
      sendAttempts: sendAttempts as number,
      confirmedBanEvents: confirmedBanEvents as number,
      currentStatus,
      banSignals,
    };
  });
}

export async function getRemoteSessionHealth(): Promise<RemoteSessionHealthResult> {
  const response = await fetch(`${REMOTE_WHATSAPP_URL}/sessions/health`, {
    signal: AbortSignal.timeout(REMOTE_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error("تعذر قراءة قياس الحظر الحقيقي من سيرفر WhatsApp الخارجي");
  }

  const payload = parseRemoteSessionHealthPayload(await response.json());
  const sessions = payload.map(({ sessionId, currentStatus: status, sendAttempts, confirmedBanEvents, banSignals }) => {
    const normalizedStatus = status.toLowerCase();
    const hasExplicitBanStatus = /banned|blocked|suspended/.test(normalizedStatus) || confirmedBanEvents > 0;
    return {
      sessionId,
      status,
      connected: status === "connected",
      sendAttempts,
      confirmedBanEvents,
      banRatePercent: sendAttempts > 0
        ? Number(((confirmedBanEvents / sendAttempts) * 100).toFixed(2))
        : null,
      banSignals,
      banStatus: hasExplicitBanStatus ? "confirmed" : status === "unknown" ? "unknown" : "not_reported",
      banEvidence: hasExplicitBanStatus
        ? (confirmedBanEvents > 0 ? `${confirmedBanEvents} confirmed ban event(s)` : status)
        : null,
    };
  });

  const totalSendAttempts = sessions.reduce((total, session) => total + session.sendAttempts, 0);
  const totalConfirmedBanEvents = sessions.reduce((total, session) => total + session.confirmedBanEvents, 0);
  const banRatePercent = totalSendAttempts > 0
    ? Number(((totalConfirmedBanEvents / totalSendAttempts) * 100).toFixed(2))
    : null;

  return {
    sessions,
    totalSendAttempts,
    totalConfirmedBanEvents,
    banRatePercent,
    measurementStatus: banRatePercent === null ? "unavailable" : "available",
    measurementReason: banRatePercent === null
      ? "لا توجد محاولات إرسال مسجلة بعد؛ لا يمكن إعطاء نسبة حقيقية."
      : "النسبة محسوبة من أحداث الحظر المؤكدة مقسومة على إجمالي محاولات الإرسال المسجلة من السيرفر الخارجي.",
  };
}

export async function getRemoteSessionStatus(sessionId: string): Promise<string> {
  const response = await fetch(`${REMOTE_WHATSAPP_URL}/sessions`, {
    signal: AbortSignal.timeout(REMOTE_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error("تعذر قراءة حالة جلسة WhatsApp من السيرفر الخارجي");
  }

  const sessions = await response.json() as Record<string, { status?: string }>;
  return sessions[sessionId]?.status ?? "unknown";
}

async function waitForRemoteSession(sessionId: string): Promise<void> {
  let lastStatus = "unknown";
  for (let attempt = 0; attempt < 4; attempt++) {
    lastStatus = await getRemoteSessionStatus(sessionId);
    if (lastStatus === "connected") return;
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  const statusLabel: Record<string, string> = {
    reconnecting: "السيرفر يعيد الاتصال بواتساب، انتظر حتى تثبت الجلسة ثم أعد المحاولة.",
    connecting: "السيرفر ما زال يتصل بواتساب، انتظر قليلًا ثم أعد المحاولة.",
    qr_received: "الجلسة تنتظر مسح QR من لوحة السيرفر.",
    disconnected: "الجلسة غير متصلة في السيرفر الخارجي.",
    unknown: "حالة الجلسة غير معروفة في السيرفر الخارجي.",
  };
  throw new Error(statusLabel[lastStatus] ?? `حالة الجلسة الحالية: ${lastStatus}`);
}

export async function sendRemoteWhatsAppMessage(
  phone: string,
  message: string,
  sessionId?: string,
): Promise<RemoteSendResult> {
  await waitForRemoteSession(sessionId ?? "default");

  const response = await fetch(`${REMOTE_WHATSAPP_URL}/send-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(REMOTE_REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      number: phone,
      message,
      ...(sessionId ? { sessionId } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({})) as {
    messageId?: string;
    id?: string;
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    const remoteError = payload.error ?? payload.message ?? `Remote WhatsApp server returned ${response.status}`;
    throw new Error(remoteError === "Connection Closed"
      ? `اتصال ${sessionId ?? "الجلسة الافتراضية"} بالسيرفر الخارجي اتقفل. أعد توصيل الجلسة ثم جرّب مرة أخرى.`
      : remoteError);
  }

  return {
    id: payload.messageId ?? payload.id ?? "sent",
    instanceId: sessionId ?? "remote",
  };
}

export async function setRemoteWhatsAppPresence(
  phone: string,
  presence: "composing" | "paused",
  sessionId: string,
): Promise<void> {
  await waitForRemoteSession(sessionId);

  const response = await fetch(`${REMOTE_WHATSAPP_URL}/presence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(REMOTE_REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      sessionId,
      number: phone,
      presence,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(payload.error ?? payload.message ?? `Remote presence server returned ${response.status}`);
  }
}

/**
 * Keeps WhatsApp's composing indicator active for a human-like duration.
 * WhatsApp does not expose per-character typing through this API, so this
 * simulates natural pauses and a brief "erase/rethink" moment with presence
 * changes rather than pretending that individual characters were transmitted.
 */
export async function simulateHumanTyping(
  phone: string,
  message: string,
  sessionId: string,
): Promise<void> {
  await setRemoteWhatsAppPresence(phone, "composing", sessionId);

  const visibleCharacters = [...message.replace(/\s+/g, " ").trim()].length;
  const totalTypingMs = Math.min(18000, Math.max(4500, visibleCharacters * 110));
  const firstPartMs = Math.floor(totalTypingMs * 0.52);
  const secondPartMs = totalTypingMs - firstPartMs;

  await new Promise((resolve) => setTimeout(resolve, firstPartMs));

  // A short pause represents a natural hesitation/edit before continuing.
  await setRemoteWhatsAppPresence(phone, "paused", sessionId);
  await new Promise((resolve) => setTimeout(resolve, 900 + Math.floor(Math.random() * 700)));
  await setRemoteWhatsAppPresence(phone, "composing", sessionId);
  await new Promise((resolve) => setTimeout(resolve, secondPartMs));
}