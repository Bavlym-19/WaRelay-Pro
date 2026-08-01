import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Wifi, WifiOff, QrCode, Power, MessageSquare, Phone, ExternalLink } from "lucide-react";

const API_BASE = "/api";

interface Session {
  id: string;
  connected: boolean;
  qr: string | null;
  pairingCode: string | null;
  status: string;
}

function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/whatsapp/sessions`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  const startSession = async (id: string) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/whatsapp/sessions/${id}/start`, { method: "POST" });
      await fetchSessions();
    } finally {
      setLoading(false);
    }
  };

  const stopSession = async (id: string) => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/whatsapp/sessions/${id}/stop`, { method: "POST" });
      await fetchSessions();
    } finally {
      setLoading(false);
    }
  };

  const requestPairingCode = async (id: string, phoneNumber: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/sessions/${id}/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      await fetchSessions();
      return data.pairingCode as string | undefined;
    } finally {
      setLoading(false);
    }
  };

  return { sessions, loading, fetchSessions, startSession, stopSession, requestPairingCode };
}

export default function Settings() {
  const remoteServerUrl = "https://server-watsapp2.onrender.com/";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">إعدادات الواتساب</h1>
        <p className="text-muted-foreground mt-1">إدارة الجلسات من سيرفرك الخاص</p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>سيرفر WhatsApp الخاص بك</CardTitle>
            <CardDescription className="mt-1">
              الـ QR المعروض هنا يتم إنشاؤه من سيرفرك مباشرة، وليس من جلسات الموقع المحلية.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">لوحة السيرفر لا تظهر؟</p>
              <p className="text-xs text-muted-foreground">
                افتحها مباشرة في تبويب جديد إذا منع المتصفح عرض الصفحات الخارجية داخل الموقع.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
              <a href={remoteServerUrl} target="_blank" rel="noopener noreferrer">
                فتح لوحة السيرفر
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border bg-background">
            <iframe
              src={remoteServerUrl}
              title="لوحة سيرفر WhatsApp"
              className="block h-[760px] w-full min-w-0 border-0"
              allow="camera https://server-watsapp2.onrender.com; clipboard-read; clipboard-write"
              referrerPolicy="no-referrer"
              loading="eager"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
            https://server-watsapp2.onrender.com
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>طريقة الاستخدام</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>1. اختر الجلسة من لوحة سيرفرك واضغط بدء عبر QR.</p>
          <p>2. امسح الـ QR الظاهر من WhatsApp → الإعدادات → الأجهزة المرتبطة.</p>
          <p>3. اترك لوحة السيرفر مفتوحة حتى تظهر حالة الجلسة متصلة.</p>
          <Separator />
          <p className="text-xs text-muted-foreground">
            هذه الصفحة تعرض لوحة سيرفرك فقط. الإرسال من الموقع يحتاج أيضًا نقطة API للإرسال في سيرفرك.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SessionCard({
  session,
  onStart,
  onStop,
  onPairingCode,
  loading,
}: {
  session: Session;
  onStart: () => void;
  onStop: () => void;
  onPairingCode: (phone: string) => Promise<string | undefined>;
  loading: boolean;
}) {
  const [phoneInput, setPhoneInput] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  const statusColors: Record<string, string> = {
    connected: "bg-emerald-500/10 text-emerald-500",
    connecting: "bg-yellow-500/10 text-yellow-500",
    qr: "bg-blue-500/10 text-blue-500",
    pairing: "bg-purple-500/10 text-purple-500",
    disconnected: "bg-destructive/10 text-destructive",
  };

  const statusLabels: Record<string, string> = {
    connected: "متصل",
    connecting: "يتصل...",
    qr: "امسح QR",
    pairing: "كود الربط",
    disconnected: "غير متصل",
  };

  const handlePairing = async () => {
    if (!phoneInput) return;
    const code = await onPairingCode(phoneInput);
    if (code) setPairingCode(code);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${session.connected ? "bg-emerald-500/10" : "bg-muted"}`}>
            {session.connected ? <Wifi className="h-5 w-5 text-emerald-500" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{session.id}</span>
              <Badge variant="outline" className={statusColors[session.status] ?? "bg-muted"}>
                {statusLabels[session.status] ?? session.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {session.connected ? "جاهز للإرسال" : "اضغط Connect للتشغيل"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {session.connected ? (
            <Button variant="destructive" size="sm" onClick={onStop} disabled={loading} className="gap-1">
              <Power className="h-4 w-4" />
              Disconnect
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={onStart} disabled={loading || session.status === "connecting"} className="gap-1">
              {session.status === "connecting" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {session.status === "connecting" ? "يتصل..." : "Connect"}
            </Button>
          )}
        </div>
      </div>

      {/* QR Code Display */}
      {session.qr && !session.connected && (
        <div className="flex flex-col items-center gap-2 pt-2 border-t">
          <p className="text-sm font-medium">امسح هذا بـ WhatsApp على تلفونك</p>
          <img
            src={session.qr}
            alt="WhatsApp QR Code"
            className="w-48 h-48 border rounded-lg"
          />
        </div>
      )}

      {/* Pairing Code Input */}
      {!session.connected && session.status !== "connecting" && (
        <div className="flex flex-col gap-2 pt-2 border-t">
          <p className="text-sm text-muted-foreground">أو ادخل رقم تليفونك للحصول على كود الربط</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="مثال: 01012345678"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            <Button variant="outline" size="sm" onClick={handlePairing} disabled={loading || !phoneInput}>
              كود الربط
            </Button>
          </div>
          {pairingCode && (
            <div className="bg-purple-500/10 border border-purple-200 rounded p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">كود الربط (ادخله في WhatsApp)</p>
              <p className="text-2xl font-mono font-bold text-purple-600 tracking-widest">{pairingCode}</p>
            </div>
          )}
          {session.pairingCode && !pairingCode && (
            <div className="bg-purple-500/10 border border-purple-200 rounded p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">كود الربط النشط</p>
              <p className="text-2xl font-mono font-bold text-purple-600 tracking-widest">{session.pairingCode}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
