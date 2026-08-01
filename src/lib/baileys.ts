import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  fetchLatestWaWebVersion,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";

const AUTH_DIR = "/tmp/baileys-auth";
const SESSIONS = ["session1", "session2", "session3"];

export interface SessionState {
  id: string;
  connected: boolean;
  qr: string | null;
  pairingCode: string | null;
  status: "disconnected" | "connecting" | "connected" | "qr" | "pairing";
  error?: string;
}

const sockets = new Map<string, WASocket>();
const states = new Map<string, SessionState>();
const qrCodes = new Map<string, string | null>();
const pairingCodes = new Map<string, string | null>();
const reconnectAttempts = new Map<string, number>();

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function initSessions() {
  ensureDir(AUTH_DIR);
  for (const id of SESSIONS) {
    const sessionDir = path.join(AUTH_DIR, id);
    if (fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0) {
      startSession(id).catch((err) => console.error(`[${id}] Auto-reconnect failed:`, err));
    }
  }
}

export async function startSession(sessionId: string): Promise<SessionState> {
  if (!SESSIONS.includes(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }

  await stopSession(sessionId);

  ensureDir(AUTH_DIR);
  const sessionDir = path.join(AUTH_DIR, sessionId);
  ensureDir(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  let waVersion: any;
  try {
    const fetched = await fetchLatestWaWebVersion();
    waVersion = fetched.version;
    console.log(`[${sessionId}] Fetched WA version:`, waVersion);
  } catch {
    waVersion = [2, 3000, 1015901307];
    console.log(`[${sessionId}] Using fallback WA version`);
  }

  const sock = makeWASocket({
    version: waVersion,
    auth: state,
    browser: Browsers.macOS("Desktop"),
    printQRInTerminal: true,
    defaultQueryTimeoutMs: undefined,
    connectTimeoutMs: 60000,
    qrTimeout: 60000,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: false,
    keepAliveIntervalMs: 30000,
    emitOwnEvents: false,
    shouldIgnoreJid: () => false,
    linkPreviewImageThumbnailWidth: 0,
  });

  sockets.set(sessionId, sock);
  qrCodes.set(sessionId, null);
  pairingCodes.set(sessionId, null);
  reconnectAttempts.set(sessionId, 0);
  states.set(sessionId, {
    id: sessionId,
    connected: false,
    qr: null,
    pairingCode: null,
    status: "connecting",
  });

  sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
        qrCodes.set(sessionId, qrDataUrl);
        states.set(sessionId, {
          id: sessionId,
          connected: false,
          qr: qrDataUrl,
          pairingCode: null,
          status: "qr",
        });
        console.log(`[${sessionId}] QR code generated`);
      } catch (e) {
        console.error(`[${sessionId}] QR generation failed:`, e);
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const attempts = reconnectAttempts.get(sessionId) ?? 0;
      reconnectAttempts.set(sessionId, attempts + 1);

      const currentPairing = pairingCodes.get(sessionId);
      // Preserve pairing status if we have a pairing code and close is just a restart
      const nextStatus: SessionState["status"] = (shouldReconnect && currentPairing)
        ? "pairing"
        : shouldReconnect
          ? "connecting"
          : "disconnected";

      states.set(sessionId, {
        id: sessionId,
        connected: false,
        qr: null,
        pairingCode: currentPairing ?? null,
        status: nextStatus,
        error: shouldReconnect ? `Reconnecting (attempt ${attempts + 1})` : "Logged out",
      });
      if (!currentPairing) qrCodes.set(sessionId, null);
      console.log(`[${sessionId}] Connection closed, code=${statusCode}, reconnect=${shouldReconnect}`);

      if (shouldReconnect && attempts < 5) {
        const delay = Math.min(5000 + attempts * 5000, 60000);
        setTimeout(() => startSession(sessionId), delay);
      }
    } else if (connection === "open") {
      reconnectAttempts.set(sessionId, 0);
      states.set(sessionId, {
        id: sessionId,
        connected: true,
        qr: null,
        pairingCode: null,
        status: "connected",
      });
      qrCodes.set(sessionId, null);
      pairingCodes.set(sessionId, null);
      console.log(`[${sessionId}] Connected!`);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return states.get(sessionId)!;
}

export async function requestPairingCodeForSession(sessionId: string, phoneNumber: string): Promise<string> {
  const sock = sockets.get(sessionId);
  if (!sock) {
    throw new Error(`Session ${sessionId} not started. Call /start first.`);
  }

  try {
    const code = await sock.requestPairingCode(phoneNumber);
    pairingCodes.set(sessionId, code);
    states.set(sessionId, {
      ...states.get(sessionId)!,
      pairingCode: code,
      status: "pairing",
    });
    console.log(`[${sessionId}] Pairing code generated: ${code}`);
    return code;
  } catch (err: any) {
    console.error(`[${sessionId}] Pairing code failed:`, err.message);
    throw new Error(`Failed to generate pairing code: ${err.message}`);
  }
}

export async function stopSession(sessionId: string): Promise<void> {
  const sock = sockets.get(sessionId);
  if (sock) {
    try { await sock.logout(); } catch { /* ignore */ }
    try { sock.end(undefined); } catch { /* ignore */ }
    sockets.delete(sessionId);
  }
  states.set(sessionId, {
    id: sessionId,
    connected: false,
    qr: null,
    pairingCode: null,
    status: "disconnected",
  });
  qrCodes.set(sessionId, null);
  pairingCodes.set(sessionId, null);
  reconnectAttempts.set(sessionId, 0);

  const sessionDir = path.join(AUTH_DIR, sessionId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

export async function restartSession(sessionId: string): Promise<SessionState> {
  await stopSession(sessionId);
  return startSession(sessionId);
}

export function getSessionState(sessionId: string): SessionState | undefined {
  return states.get(sessionId);
}

export function getAllSessionStates(): SessionState[] {
  return SESSIONS.map((id) =>
    states.get(id) ?? { id, connected: false, qr: null, pairingCode: null, status: "disconnected" }
  );
}

function formatPhoneToJid(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "2" + digits;
  return `${digits}@s.whatsapp.net`;
}

let sendIndex = 0;

export async function sendBaileysMessage(phone: string, message: string): Promise<{ id: string; instanceId: string }> {
  const connectedSessions = SESSIONS.filter((id) => states.get(id)?.connected);
  if (connectedSessions.length === 0) {
    throw new Error("No WhatsApp sessions are connected. Please connect at least one session in Settings.");
  }

  const sessionId = connectedSessions[sendIndex % connectedSessions.length];
  sendIndex++;

  const sock = sockets.get(sessionId);
  if (!sock) throw new Error(`Session ${sessionId} socket not found`);

  const jid = formatPhoneToJid(phone);
  const result = await sock.sendMessage(jid, { text: message });

  return {
    id: result?.key?.id ?? "sent",
    instanceId: sessionId,
  };
}

export async function sendBaileysMessageFromSession(
  sessionId: string,
  phone: string,
  message: string,
): Promise<{ id: string; instanceId: string }> {
  if (!SESSIONS.includes(sessionId)) {
    throw new Error(`Invalid session ID: ${sessionId}`);
  }
  if (!states.get(sessionId)?.connected) {
    throw new Error(`Session ${sessionId} is not connected. Connect it in Settings first.`);
  }

  const sock = sockets.get(sessionId);
  if (!sock) throw new Error(`Session ${sessionId} socket not found`);

  const result = await sock.sendMessage(formatPhoneToJid(phone), { text: message });
  return {
    id: result?.key?.id ?? "sent",
    instanceId: sessionId,
  };
}

export async function checkBaileysConnection(sessionId?: string): Promise<{ connected: boolean; stateInstance: string; instanceId?: string }> {
  const id = sessionId ?? SESSIONS[0];
  const state = states.get(id);
  return {
    connected: state?.connected ?? false,
    stateInstance: state?.status ?? "disconnected",
    instanceId: id,
  };
}

export async function checkAllBaileysConnections(): Promise<Array<{ connected: boolean; stateInstance: string; instanceId: string; label?: string }>> {
  return SESSIONS.map((id) => {
    const state = states.get(id);
    return {
      instanceId: id,
      label: `Session ${id}`,
      connected: state?.connected ?? false,
      stateInstance: state?.status ?? "disconnected",
    };
  });
}

export function startKeepAlive() {
  setInterval(() => {
    for (const [id, sock] of sockets.entries()) {
      if (states.get(id)?.connected) {
        try {
          sock.sendPresenceUpdate("available");
        } catch {
          // session might be dead
        }
      }
    }
  }, 30000);
}
