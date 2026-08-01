import { Router } from "express";
import { getAllSessionStates, restartSession, stopSession, startSession, requestPairingCodeForSession } from "../lib/whatsapp.js";
import { getRemoteSessionHealth } from "../lib/remote-whatsapp.js";

const router = Router();

router.get("/whatsapp/check-connection", async (_req, res) => {
  const results = getAllSessionStates().map((s) => ({
    instanceId: s.id,
    label: `Session ${s.id}`,
    connected: s.connected,
    stateInstance: s.status,
    qr: s.qr,
  }));
  res.json({ instances: results });
});

router.get("/whatsapp/sessions", async (_req, res) => {
  const results = getAllSessionStates();
  res.json({ sessions: results });
});

router.get("/whatsapp/remote-sessions", async (_req, res) => {
  try {
    const sessions = await getRemoteSessionHealth();
    res.json(sessions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: msg });
  }
});

router.post("/whatsapp/sessions/:id/restart", async (req, res) => {
  try {
    const state = await restartSession(req.params.id);
    res.json({ success: true, session: state });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/whatsapp/sessions/:id/stop", async (req, res) => {
  try {
    await stopSession(req.params.id);
    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/whatsapp/sessions/:id/start", async (req, res) => {
  try {
    const state = await startSession(req.params.id);
    res.json({ success: true, session: state });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/whatsapp/sessions/:id/pairing-code", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: "phoneNumber is required" });
    }
    const code = await requestPairingCodeForSession(req.params.id, phoneNumber);
    res.json({ success: true, pairingCode: code });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
