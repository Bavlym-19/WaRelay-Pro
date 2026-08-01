import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Send, Sparkles, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";

export default function TestSend() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("01274283037");
  const [name, setName] = useState("صاحب الأرض");
  const [plotNumber, setPlotNumber] = useState("1");
  const [district, setDistrict] = useState("35");
  const [neighborhood, setNeighborhood] = useState("4");
  const [area, setArea] = useState("");
  const [maxDelaySeconds, setMaxDelaySeconds] = useState(60);
  const [useAI, setUseAI] = useState(true);
  const [sessionId, setSessionId] = useState("");
  const sessions = [
    { id: "session1", connected: true },
    { id: "session2", connected: true },
    { id: "session3", connected: true },
  ];
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [previewMessage, setPreviewMessage] = useState("");

  const generatePreview = async () => {
    if (!name.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/gemini/generate-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, plotNumber, area, district, neighborhood }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (data.message) {
        setPreviewMessage(data.message);
        toast({ title: "تم توليد الرسالة بـ Gemini ✨" });
      } else {
        toast({ title: "خطأ في توليد الرسالة", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال بالخادم", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!phone.trim()) {
      toast({ title: "أدخل رقم الهاتف", variant: "destructive" });
      return;
    }
    if (!sessionId) {
      toast({ title: "اختر جلسة WhatsApp أولاً", variant: "destructive" });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/whatsapp/test-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, sessionId, name, plotNumber, area, district, neighborhood, useAI, maxDelaySeconds }),
      });
      const data = await res.json() as { success: boolean; message?: string; error?: string };
      setResult(data);
      if (data.success) {
        setPreviewMessage(data.message ?? "");
        toast({ title: "تم الإرسال بنجاح! ✅", description: `إلى ${phone}` });
      } else {
        toast({ title: "فشل الإرسال", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال بالخادم", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">إرسال تجريبي</h1>
        <p className="text-muted-foreground mt-1">اختبر إرسال رسالة واتساب قبل بدء الحملة</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            بيانات الإرسال
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>رقم الهاتف</Label>
            <Input
              placeholder="01xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>جلسة الإرسال</Label>
            <Select value={sessionId} onValueChange={setSessionId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الجلسة التي سترسل الرسالة" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.id} — {session.connected ? "متصلة" : "غير متصلة"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">سيتم الإرسال من هذه الجلسة فقط.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم صاحب الأرض</Label>
              <Input placeholder="أحمد محمد" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>رقم القطعة</Label>
              <Input placeholder="1" value={plotNumber} onChange={(e) => setPlotNumber(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>الحي</Label>
              <Input placeholder="35" value={district} onChange={(e) => setDistrict(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label>المجاورة</Label>
              <Input placeholder="4" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>التأخير العشوائي قبل الإرسال: حتى {Math.floor(maxDelaySeconds / 60)} دقيقة</Label>
              <input
                type="range"
                min="60"
                max="900"
                step="60"
                value={maxDelaySeconds}
                onChange={(e) => setMaxDelaySeconds(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                الإرسال يتم عشوائيًا من 60 ثانية حتى الحد المحدد.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-sm">توليد الرسالة بـ Gemini AI</p>
                <p className="text-xs text-muted-foreground">يولد رسالة مخصصة وطبيعية لكل شخص</p>
              </div>
            </div>
            <Switch checked={useAI} onCheckedChange={setUseAI} />
          </div>

          {useAI && (
            <Button variant="outline" size="sm" onClick={generatePreview} disabled={generating} className="gap-2 w-full">
              <Sparkles className={`h-4 w-4 ${generating ? "animate-pulse" : ""} text-amber-500`} />
              {generating ? "جاري التوليد..." : "معاينة الرسالة بـ Gemini"}
            </Button>
          )}

          {previewMessage && (
            <div className="space-y-2">
              <Label>الرسالة</Label>
              <Textarea
                value={previewMessage}
                onChange={(e) => setPreviewMessage(e.target.value)}
                rows={5}
                className="resize-none font-arabic"
                dir="rtl"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card className={result.success ? "border-emerald-500/50 bg-emerald-500/5" : "border-destructive/50 bg-destructive/5"}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {result.success
                ? <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                : <XCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
              }
              <div>
                <p className="font-semibold">{result.success ? "تم الإرسال بنجاح!" : "فشل الإرسال"}</p>
                {result.error && <p className="text-sm text-muted-foreground mt-1">{result.error}</p>}
                {result.success && result.message && (
                  <div className="mt-3 p-3 rounded bg-background border text-sm whitespace-pre-line">
                    {result.message}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">معلومة</Badge>
        الرسالة التجريبية تنتظر عشوائيًا من 60 ثانية حتى الحد المحدد. لا يوجد ضمان لمنع الحظر بالكامل.
      </div>

      <Button onClick={handleSend} disabled={sending || !phone.trim() || !sessionId} className="w-full gap-2" size="lg">
        <Send className={`h-5 w-5 ${sending ? "animate-pulse" : ""}`} />
        {sending ? "جاري الإرسال..." : "إرسال رسالة تجريبية"}
      </Button>
    </div>
  );
}
