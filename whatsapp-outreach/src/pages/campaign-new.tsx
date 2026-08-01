import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { useCreateCampaign, useGenerateMessageVariants, getListCampaignsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Upload, FileSpreadsheet, ArrowRight, FileText, Sparkles, Save, WandSparkles, Check, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api";
const SAVED_TEMPLATES_KEY = "whatsapp-outreach-saved-templates";

interface ContactRow {
  name: string;
  phone: string;
  plotNumber: string;
  area: string;
  district: string;
  neighborhood: string;
}

const emptyRow = (): ContactRow => ({ name: "", phone: "", plotNumber: "", area: "", district: "", neighborhood: "" });

function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

function normalizePhone(value: unknown): string {
  let digits = normalizeDigits(String(value ?? "")).replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = digits.slice(2);
  if (digits.startsWith("20") && digits.length === 12) digits = `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;
  return /^01\d{9}$/.test(digits) ? digits : String(value ?? "").trim();
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "").replace(/[\s_\u00a0]+/g, "").toLowerCase();
}

function findColumn(row: Record<string, unknown>, names: string[]): string {
  const entry = Object.entries(row).find(([key]) => names.includes(normalizeHeader(key)));
  return entry ? String(entry[1] ?? "").trim() : "";
}

function splitRegion(value: string): { district: string; neighborhood: string } {
  const region = value.trim();
  const neighborhood = region.match(/المجاورة\s*[\d٠-٩]+/u)?.[0] ?? "";
  return { district: region, neighborhood };
}

interface MessageTemplateRow {
  id: number;
  text: string;
  enabled: boolean;
}

function renderTemplate(template: string, contact: ContactRow): string {
  return template
    .replace(/\{name\}/g, contact.name || "أستاذنا الكريم")
    .replace(/\{plotNumber\}/g, contact.plotNumber || "غير محدد")
    .replace(/\{area\}/g, contact.area || "غير محددة")
    .replace(/\{المساحة\}/g, contact.area || "غير محددة")
    .replace(/\{district\}/g, contact.district || "غير محدد")
    .replace(/\{neighborhood\}/g, contact.neighborhood || "غير محددة");
}

export default function CampaignNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createCampaign = useCreateCampaign();
  const generateVariants = useGenerateMessageVariants();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [campaignName, setCampaignName] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([emptyRow()]);
  const [activeTab, setActiveTab] = useState("manual");
  const [useAI, setUseAI] = useState(true);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [maxDelaySeconds, setMaxDelaySeconds] = useState(300);
  const [pauseEveryMessages, setPauseEveryMessages] = useState(0);
  const [pauseDurationSeconds, setPauseDurationSeconds] = useState(120);
  const [templates, setTemplates] = useState<MessageTemplateRow[]>([]);
  const [newTemplate, setNewTemplate] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(SAVED_TEMPLATES_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        setSavedTemplates(stored.filter((item): item is string => typeof item === "string" && item.trim().length > 0));
      }
    } catch {
      setSavedTemplates([]);
    }
  }, []);

  const validContacts = contacts.filter((r) => r.name && r.phone && r.plotNumber);

  const sampleContact = validContacts[0] ?? {
    name: "أحمد",
    phone: "",
    plotNumber: "123",
    area: "500 متر",
    district: "الحي المتميز",
    neighborhood: "المجاورة الأولى",
  };

  const addTemplate = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTemplates((current) => [...current, { id: Date.now() + current.length, text: trimmed, enabled: true }]);
    setNewTemplate("");
  };

  const saveTemplates = () => {
    const selected = templates.filter((template) => template.enabled && template.text.trim()).map((template) => template.text.trim());
    if (selected.length === 0) {
      toast({ title: "اختر صيغة واحدة على الأقل للحفظ", variant: "destructive" });
      return;
    }
    const merged = [...new Set([...savedTemplates, ...selected])];
    setSavedTemplates(merged);
    localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(merged));
    toast({ title: `تم حفظ ${selected.length} صيغة`, description: "يمكنك استخدامها في حملات قادمة." });
  };

  const loadSavedTemplate = (text: string) => {
    if (templates.some((template) => template.text.trim() === text.trim())) return;
    setTemplates((current) => [...current, { id: Date.now() + current.length, text, enabled: true }]);
  };

  const generateMessageVariants = () => {
    if (!sampleContact.name.trim()) {
      toast({ title: "أدخل اسم جهة اتصال أولاً", description: "نستخدم أول جهة اتصال كبيانات معاينة.", variant: "destructive" });
      return;
    }
    generateVariants.mutate({
      data: {
        name: sampleContact.name,
        plotNumber: sampleContact.plotNumber,
        area: sampleContact.area,
        district: sampleContact.district,
        neighborhood: sampleContact.neighborhood,
        count: 10,
      },
    }, {
      onSuccess: (result) => {
        setTemplates(result.messages.map((text, index) => ({ id: Date.now() + index, text, enabled: true })));
        toast({ title: "تم توليد 10 صيغ", description: "راجعها وعدّلها ثم اختر الصيغ التي ستُرسل." });
      },
      onError: () => toast({ title: "تعذر توليد الصيغ", description: "يمكنك كتابة الصيغ يدويًا أو إعادة المحاولة.", variant: "destructive" }),
    });
  };

  const updateRow = (index: number, field: keyof ContactRow, value: string) => {
    setContacts((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const addRow = () => setContacts((prev) => [...prev, emptyRow()]);

  const removeRow = (index: number) => {
    if (contacts.length === 1) return;
    setContacts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
        const parsed: ContactRow[] = rows.map((row) => {
          const region = findColumn(row, ["المنطقة", "الحي", "district", "region", "area"]);
          const split = splitRegion(region);
          return {
            name: findColumn(row, ["الاسم", "اسم", "name"]),
            phone: normalizePhone(findColumn(row, ["الهاتف", "تليفون", "موبايل", "phone", "mobile"])),
            plotNumber: findColumn(row, ["القطعة", "رقمالقطعة", "plot", "plotnumber"]),
            area: findColumn(row, ["المساحة", "مساحة", "area", "size"]),
            district: region,
            neighborhood: findColumn(row, ["المجاورة", "neighborhood"]) || split.neighborhood,
          };
        }).filter((r) => r.name && r.phone);
        if (parsed.length === 0) {
          toast({ title: "لم يتم العثور على بيانات", description: "تأكد من أن الملف يحتوي على الأعمدة الصحيحة", variant: "destructive" });
          return;
        }
        setContacts(parsed);
        setActiveTab("manual");
        toast({ title: `تم تحميل ${parsed.length} جهة اتصال`, description: "يمكنك مراجعة البيانات قبل الإنشاء" });
      } catch {
        toast({ title: "خطأ في قراءة الملف", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploadingPdf(true);
    toast({ title: "جاري قراءة الـ PDF..." });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/parse-pdf`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json() as {
        contacts?: ContactRow[];
        total?: number;
        error?: string;
      };

      if (!res.ok || !data.contacts) {
        toast({ title: "خطأ في قراءة الـ PDF", description: data.error, variant: "destructive" });
        return;
      }

      setContacts(data.contacts);
      setActiveTab("manual");
      toast({ title: `تم قراءة ${data.total} جهة اتصال من الـ PDF ✅`, description: "يمكنك مراجعة البيانات قبل الإنشاء" });
    } catch {
      toast({ title: "خطأ في الاتصال بالخادم", variant: "destructive" });
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSubmit = async () => {
    if (!campaignName.trim()) {
      toast({ title: "أدخل اسم الحملة", variant: "destructive" });
      return;
    }
    if (validContacts.length === 0) {
      toast({ title: "أضف جهة اتصال واحدة على الأقل", variant: "destructive" });
      return;
    }
    createCampaign.mutate(
      { data: {
        name: campaignName.trim(),
        useAI,
        messageTemplates: templates.filter((template) => template.enabled && template.text.trim()).map((template) => template.text.trim()),
        messageTemplate: templates.find((template) => template.enabled && template.text.trim())?.text.trim() ?? null,
        contacts: validContacts,
        minDelaySeconds: 60,
        maxDelaySeconds,
        pauseEveryMessages,
        pauseDurationSeconds,
      } },
      {
        onSuccess: (campaign) => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({ title: "تم إنشاء الحملة", description: `${campaign.totalContacts} جهة اتصال` });
          setLocation(`/campaigns/${campaign.id}`);
        },
        onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">حملة جديدة</h1>
        <p className="text-muted-foreground mt-1">أضف جهات الاتصال وابدأ حملة WhatsApp العقارية</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اسم الحملة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            data-testid="input-campaign-name"
            placeholder="مثال: حملة حي النرجس يناير 2025"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="max-w-md"
          />

          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 max-w-md">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-sm">استخدام Gemini AI</p>
                <p className="text-xs text-muted-foreground">يولد رسالة مخصصة لكل شخص تلقائياً</p>
              </div>
            </div>
            <Switch checked={useAI} onCheckedChange={setUseAI} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <WandSparkles className="h-5 w-5 text-primary" />
                صيغ الرسائل قبل الإرسال
              </CardTitle>
              <CardDescription className="mt-1">
                ولّد 10 صيغ مختلفة بنفس المعنى، عدّلها كما تريد، ثم فعّل الصيغ التي ستُرسل بالتبادل.
              </CardDescription>
            </div>
            <Button type="button" onClick={generateMessageVariants} disabled={generateVariants.isPending} className="gap-2 shrink-0" data-testid="button-generate-message-variants">
              <Sparkles className="h-4 w-4" />
              {generateVariants.isPending ? "جاري التوليد..." : "توليد 10 صيغ"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-medium mb-1">المتغيرات المتاحة</p>
            <p className="text-muted-foreground">
              استخدم: <code>{"{name}"}</code> للاسم، <code>{"{plotNumber}"}</code> للقطعة، <code>{"{area}"}</code> للمساحة، <code>{"{district}"}</code> للحي، <code>{"{neighborhood}"}</code> للمجاورة.
            </p>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              لم تُضف صيغ بعد. اضغط «توليد 10 صيغ» أو اكتب صيغة من عندك بالأسفل.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary">{templates.filter((template) => template.enabled).length} صيغة معتمدة للإرسال</Badge>
                <Button type="button" variant="outline" size="sm" onClick={saveTemplates} className="gap-2" data-testid="button-save-message-templates">
                  <Save className="h-4 w-4" />
                  حفظ الصيغ المختارة
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {templates.map((template, index) => (
                  <div key={template.id} className={`rounded-lg border p-3 space-y-3 transition-colors ${template.enabled ? "border-primary/40 bg-primary/[0.03]" : "opacity-60"}`} data-testid={`card-message-template-${index}`}>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={template.enabled}
                          onChange={(event) => setTemplates((current) => current.map((item) => item.id === template.id ? { ...item, enabled: event.target.checked } : item))}
                          data-testid={`checkbox-message-template-${index}`}
                        />
                        استخدام الصيغة {index + 1}
                      </label>
                      <span className="text-xs text-muted-foreground">المعاينة: {sampleContact.name || "الاسم"}</span>
                    </div>
                    <Textarea
                      value={template.text}
                      onChange={(event) => setTemplates((current) => current.map((item) => item.id === template.id ? { ...item, text: event.target.value } : item))}
                      className="min-h-[115px] text-sm leading-6"
                      dir="rtl"
                      data-testid={`textarea-message-template-${index}`}
                    />
                    <div className="rounded-md bg-muted/50 p-2 text-xs leading-5 whitespace-pre-wrap" dir="rtl" data-testid={`text-message-preview-${index}`}>
                      {renderTemplate(template.text, sampleContact)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="new-message-template">اكتب صيغة من عندك</Label>
            <Textarea
              id="new-message-template"
              value={newTemplate}
              onChange={(event) => setNewTemplate(event.target.value)}
              placeholder={"مثال:\nأهلاً {name}\nهل قطعة {plotNumber} في {neighborhood} متاحة للبيع؟"}
              className="min-h-[100px]"
              dir="rtl"
              data-testid="textarea-new-message-template"
            />
            <Button type="button" variant="outline" onClick={() => addTemplate(newTemplate)} disabled={!newTemplate.trim()} className="gap-2" data-testid="button-add-message-template">
              <Plus className="h-4 w-4" />
              إضافة الصيغة للقائمة
            </Button>
          </div>

          {savedTemplates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium"><RotateCcw className="h-4 w-4" /> صيغ محفوظة</div>
              <div className="flex flex-wrap gap-2">
                {savedTemplates.map((text, index) => (
                  <Button key={`${text}-${index}`} type="button" variant="outline" size="sm" onClick={() => loadSavedTemplate(text)} className="gap-1 max-w-full" data-testid={`button-load-saved-template-${index}`}>
                    <Check className="h-3 w-3" />
                    <span className="truncate max-w-[240px]">{text.split("\n")[0]}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تقليل الإرسال المتتالي</CardTitle>
          <CardDescription>التأخير عشوائي من 60 ثانية حتى الحد الذي تختاره. لا يوجد ضمان لمنع الحظر بالكامل.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <Label>الحد الأقصى بين الرسائل: {Math.floor(maxDelaySeconds / 60)} دقيقة</Label>
            <input type="range" min="60" max="900" step="60" value={maxDelaySeconds}
              onChange={(e) => setMaxDelaySeconds(Number(e.target.value))} className="w-full" />
            <p className="text-xs text-muted-foreground">كل رسالة تختار وقتًا عشوائيًا من دقيقة إلى هذا الحد.</p>
          </div>
          <div className="space-y-2">
            <Label>وقفة بعد عدد رسائل</Label>
            <input type="range" min="0" max="20" step="1" value={pauseEveryMessages}
              onChange={(e) => setPauseEveryMessages(Number(e.target.value))} className="w-full" />
            <p className="text-xs text-muted-foreground">{pauseEveryMessages === 0 ? "بدون وقفة إضافية" : `بعد كل ${pauseEveryMessages} رسالة`}</p>
          </div>
          <div className="space-y-2">
            <Label>مدة الوقفة: {Math.floor(pauseDurationSeconds / 60)} دقيقة</Label>
            <input type="range" min="60" max="900" step="60" value={pauseDurationSeconds}
              onChange={(e) => setPauseDurationSeconds(Number(e.target.value))} className="w-full" disabled={pauseEveryMessages === 0} />
            <p className="text-xs text-muted-foreground">لا تُطبّق إلا عند تفعيل الوقفة.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>جهات الاتصال</CardTitle>
          <CardDescription>أضف البيانات يدوياً أو ارفع ملف PDF / Excel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="manual" data-testid="tab-manual">إدخال يدوي</TabsTrigger>
              <TabsTrigger value="pdf" data-testid="tab-pdf">رفع PDF</TabsTrigger>
              <TabsTrigger value="upload" data-testid="tab-upload">رفع Excel</TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-4">
              <div
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => pdfInputRef.current?.click()}
                data-testid="dropzone-pdf"
              >
                <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">
                  {uploadingPdf ? "جاري القراءة..." : "انقر لرفع ملف PDF"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  يستخرج تلقائياً: الاسم + رقم الهاتف (01xxxxxxxxx) من كل صف
                </p>
                <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded px-3 py-1 inline-block">
                  الصيغة: الاسم ... أرقام ... 01xxxxxxxxx
                </p>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                  data-testid="input-pdf"
                />
              </div>
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <div
                className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-upload"
              >
                <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">انقر لرفع ملف Excel أو CSV</p>
                <p className="text-sm text-muted-foreground mt-1">الأعمدة المطلوبة: الاسم، الهاتف، رقم القطعة، الحي، المجاورة</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleExcelUpload}
                  data-testid="input-file"
                />
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">الاسم</TableHead>
                      <TableHead className="min-w-[130px]">الهاتف</TableHead>
                      <TableHead className="min-w-[120px]">رقم القطعة</TableHead>
                      <TableHead className="min-w-[120px]">المساحة</TableHead>
                      <TableHead className="min-w-[120px]">الحي</TableHead>
                      <TableHead className="min-w-[120px]">المجاورة</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((row, i) => (
                      <TableRow key={i} data-testid={`row-contact-${i}`}>
              {(["name", "phone", "plotNumber", "area", "district", "neighborhood"] as const).map((field) => (
                          <TableCell key={field}>
                            <Input
                              value={row[field]}
                              onChange={(e) => updateRow(i, field, e.target.value)}
                              data-testid={`input-${field}-${i}`}
                              className="h-8"
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeRow(i)} data-testid={`button-remove-${i}`} className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={addRow} className="mt-3 gap-2" data-testid="button-add-row">
                <Plus className="h-4 w-4" />
                إضافة صف
              </Button>
            </TabsContent>
          </Tabs>

          {validContacts.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="secondary">{validContacts.length} جهة اتصال صالحة</Badge>
              <span className="text-muted-foreground">جاهزة للإضافة</span>
              {useAI && (
                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                  <Sparkles className="h-3 w-3" />
                  Gemini AI
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
        <Upload className="h-4 w-4 shrink-0" />
        التأخير بين الرسائل: عشوائي من 60 ثانية حتى الحد الذي اخترته، مع وقفة اختيارية
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-cancel">إلغاء</Button>
        <Button
          onClick={handleSubmit}
          disabled={createCampaign.isPending || !campaignName.trim() || validContacts.length === 0}
          data-testid="button-create-campaign"
          className="gap-2"
        >
          {createCampaign.isPending ? "جاري الإنشاء..." : "إنشاء الحملة"}
          {!createCampaign.isPending && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
