import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import * as XLSX from "xlsx";
import {
  useGetCampaign,
  getGetCampaignQueryKey,
  getListCampaignsQueryKey,
  useSendCampaign,
  useDeleteCampaign,
  useUpdateContact,
  getGetCampaignStatsQueryKey,
  useGetRemoteWhatsappSessions,
} from "@workspace/api-client-react";
import type { SendCampaignBodySessionIdsItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Send, Download, Trash2, ArrowRight, Clock, CheckCircle2, XCircle, RefreshCw, ShieldCheck, CircleHelp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type StatusFilter = "all" | "pending" | "sent" | "failed" | "will_sell" | "will_buy" | "not_interested";

const STATUS_LABELS: Record<string, string> = {
  pending: "لم يُرسل",
  sent: "أُرسلت",
  failed: "فشل الإرسال",
  will_sell: "يريد البيع",
  will_buy: "يريد الشراء",
  not_interested: "غير مهتم",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "outline",
  sent: "secondary",
  failed: "destructive",
  will_sell: "default",
  will_buy: "default",
  not_interested: "destructive",
};

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  sending: "جاري الإرسال",
  done: "مكتملة",
  partial: "مكتملة جزئياً",
  failed: "فشل الإرسال",
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const campaignId = parseInt(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [maxContacts, setMaxContacts] = useState(500);
  const sessions = [
    { id: "session1", label: "الجلسة الأولى" },
    { id: "session2", label: "الجلسة الثانية" },
    { id: "session3", label: "الجلسة الثالثة" },
  ];

  const { data: campaign, isLoading } = useGetCampaign(campaignId, {
    query: { queryKey: getGetCampaignQueryKey(campaignId), refetchInterval: (q) => q.state.data?.status === "sending" ? 5000 : false },
  });
  const { data: remoteHealth, isLoading: remoteHealthLoading, isError: remoteHealthError } = useGetRemoteWhatsappSessions({
    query: {
      queryKey: ["/api/whatsapp/remote-sessions"],
      refetchInterval: 15000,
    },
  });

  const sendCampaign = useSendCampaign();
  const deleteCampaign = useDeleteCampaign();
  const updateContact = useUpdateContact();
  const handleSend = () => {
    if (sessionIds.length === 0) {
      toast({ title: "اختر جلسة WhatsApp واحدة على الأقل", variant: "destructive" });
      return;
    }
    sendCampaign.mutate(
      { id: campaignId, data: { sessionIds: sessionIds as SendCampaignBodySessionIdsItem[], maxContacts } },
      {
        onSuccess: (result) => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({ title: "بدأ الإرسال", description: result.message });
        },
        onError: () => toast({ title: "حدث خطأ في الإرسال", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    deleteCampaign.mutate(
      { id: campaignId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({ title: "تم حذف الحملة" });
          setLocation("/");
        },
        onError: () => toast({ title: "حدث خطأ في الحذف", variant: "destructive" }),
      }
    );
  };

  const handleStatusUpdate = (contactId: number, status: string) => {
    updateContact.mutate(
      { id: contactId, data: { status: status as "pending" | "sent" | "will_sell" | "will_buy" | "not_interested" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          queryClient.invalidateQueries({ queryKey: getGetCampaignStatsQueryKey(campaignId) });
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
        },
        onError: () => toast({ title: "حدث خطأ في التحديث", variant: "destructive" }),
      }
    );
  };

  const exportContacts = (status?: "pending" | "failed") => {
    const contacts = (campaign?.contacts ?? []).filter((contact) => !status || contact.status === status);
    if (contacts.length === 0) {
      toast({
        title: status === "failed" ? "لا توجد أرقام فشل إرسالها" : status === "pending" ? "لا توجد أرقام متبقية" : "لا توجد جهات اتصال",
        variant: "destructive",
      });
      return;
    }

    // Keep these headers aligned with CampaignNew's importer so the file can
    // be uploaded again without losing any contact fields.
    const wsData = [
      ["الاسم", "الهاتف", "رقم القطعة", "المساحة", "الحي", "المجاورة"],
      ...contacts.map((contact) => [
        contact.name,
        contact.phone,
        contact.plotNumber,
        contact.area,
        contact.district,
        contact.neighborhood,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, status === "pending" ? "المتبقي" : status === "failed" ? "الفاشل" : "كل الأرقام");
    const safeCampaignName = (campaign?.name ?? "campaign").replace(/[\\/:*?"<>|]/g, "-").trim() || "campaign";
    const suffix = status === "pending" ? "المتبقي" : status === "failed" ? "الفاشل" : "كل_الأرقام";
    XLSX.writeFile(wb, `${safeCampaignName}_${suffix}.xlsx`);
    toast({ title: `تم تصدير ${contacts.length} رقم`, description: "الملف جاهز لإعادة الرفع" });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!campaign) return <div className="text-center py-20 text-muted-foreground">الحملة غير موجودة</div>;

  const filteredContacts = campaign.contacts?.filter((c) => filter === "all" || c.status === filter) ?? [];
  const pendingCount = campaign.pendingCount;
  const batchSize = Math.min(maxContacts, pendingCount);
  const setBatchSize = (value: number) => {
    const next = Number.isFinite(value) ? Math.floor(value) : 1;
    setMaxContacts(Math.min(Math.max(1, next), Math.max(1, pendingCount)));
  };
  const sessionSummary = ["session1", "session2", "session3"].map((sessionId) => {
    const assigned = (campaign.contacts ?? []).filter((contact) => contact.sendSessionId === sessionId);
    const sent = assigned.filter((contact) => contact.status === "sent").length;
    const failed = assigned.filter((contact) => contact.status === "failed").length;
    const pending = assigned.filter((contact) => contact.status === "pending").length;
    const health = remoteHealth?.sessions.find((session) => session.sessionId === sessionId);
    return { sessionId, total: assigned.length, sent, failed, pending, health };
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <Badge variant={campaign.status === "done" ? "default" : campaign.status === "sending" ? "secondary" : "outline"}>
              {campaign.status === "sending" && <RefreshCw className="h-3 w-3 mr-1 animate-spin" />}
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {format(new Date(campaign.createdAt), "EEEE، dd MMMM yyyy", { locale: ar })}
          </p>
        </div>
          <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-md border p-1">
            <Button variant="outline" size="sm" onClick={() => exportContacts()} className="gap-2" data-testid="button-export-all">
              <Download className="h-4 w-4" />
              Excel الكل
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportContacts("pending")} disabled={campaign.pendingCount === 0} className="gap-2" data-testid="button-export-pending">
              <Download className="h-4 w-4" />
              المتبقي ({campaign.pendingCount})
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportContacts("failed")} disabled={campaign.failedCount === 0} className="gap-2" data-testid="button-export-failed">
              <Download className="h-4 w-4" />
              الفاشل ({campaign.failedCount})
            </Button>
          </div>
          {campaign.status !== "sending" && campaign.pendingCount > 0 && (
            <>
            <div className="rounded-md border p-3 space-y-2 min-w-[245px]">
              <p className="text-sm font-medium">جلسات الإرسال</p>
              {sessions.map((session) => (
                <label key={session.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sessionIds.includes(session.id)}
                    onChange={(e) => setSessionIds((current) =>
                      e.target.checked ? [...current, session.id] : current.filter((id) => id !== session.id)
                    )}
                  />
                  <span>{session.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {remoteHealthLoading ? "جاري الفحص..." :
                      remoteHealth?.sessions.find((item) => item.sessionId === session.id)?.connected ? "متصلة" :
                      "غير متصلة — لا يمكن التحقق"}
                  </span>
                </label>
              ))}
              <p className="text-[11px] text-muted-foreground">عند اختيار أكثر من جلسة يتم توزيع الأرقام عشوائيًا بينها.</p>
            </div>
            <div className="rounded-md border p-3 space-y-2 min-w-[245px]">
              <p className="text-sm font-medium">عدد الرسائل في هذه الدفعة: {batchSize}</p>
              <input
                type="range"
                min="1"
                max={Math.max(1, pendingCount)}
                step="1"
                value={Math.min(maxContacts, Math.max(1, pendingCount))}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full"
                disabled={pendingCount === 0}
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, pendingCount)}
                  value={Math.min(maxContacts, Math.max(1, pendingCount))}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="h-8 w-24 rounded-md border bg-background px-2 text-sm"
                  aria-label="عدد الرسائل في الدفعة"
                />
                <span className="text-xs text-muted-foreground">من أصل {pendingCount} متبقٍ</span>
              </div>
              <div className="flex gap-2">
                {[500, 1000].filter((value) => value <= pendingCount).map((value) => (
                  <Button key={value} type="button" variant="outline" size="sm" onClick={() => setBatchSize(value)}>
                    {value}
                  </Button>
                ))}
                {pendingCount > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setBatchSize(pendingCount)}>
                    الكل
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">يمكنك اختيار 500 أو 1000 أو كتابة أي عدد. لن يتم تجاوز المتبقي.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="gap-2" data-testid="button-send-campaign" disabled={sendCampaign.isPending || campaign.pendingCount === 0 || !sessionIds.length}>
                  <Send className="h-4 w-4" />
                  بدء الإرسال ({batchSize})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>تأكيد بدء الإرسال</AlertDialogTitle>
                  <AlertDialogDescription>
                    تمت قراءة {campaign.totalContacts} رقمًا؛ أُرسل {campaign.sentCount}، والمتبقي {campaign.pendingCount}. سيتم إرسال {batchSize} رقم في هذه الدفعة وتوزيعها عشوائيًا على {sessionIds.length} جلسة.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSend}>ابدأ الإرسال</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-2" data-testid="button-delete-campaign">
                <Trash2 className="h-4 w-4" />
                حذف
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الحملة</AlertDialogTitle>
                <AlertDialogDescription>هل أنت متأكد من حذف هذه الحملة؟ لا يمكن التراجع.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "الكل", value: campaign.totalContacts, icon: null },
          { label: "أُرسلت", value: campaign.sentCount, icon: <Send className="h-4 w-4" /> },
          { label: "في الانتظار", value: campaign.pendingCount, icon: <Clock className="h-4 w-4" /> },
           { label: "فشل", value: campaign.failedCount, icon: <XCircle className="h-4 w-4 text-red-500" /> },
          { label: "يريد البيع", value: campaign.willSellCount, icon: <CheckCircle2 className="h-4 w-4 text-blue-500" /> },
          { label: "يريد الشراء", value: campaign.willBuyCount, icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                {stat.icon}
                <span>{stat.label}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            حالة الحظر الفعلية للجلسات
          </CardTitle>
            <p className="text-sm text-muted-foreground">
            النسبة المرصودة محسوبة من محاولات الإرسال وأحداث الحظر المؤكدة التي يرسلها سيرفر WhatsApp.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {remoteHealthError && (
            <div className="md:col-span-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" data-testid="status-ban-health-error">
              تعذر قراءة حالة الحظر من سيرفر WhatsApp الخارجي حاليًا.
            </div>
          )}
          {!remoteHealthError && remoteHealth && (
            <div className="md:col-span-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground" data-testid="status-ban-rate">
              <div className="flex items-center gap-2 font-medium text-foreground">
                {remoteHealth.banRatePercent === null ? <CircleHelp className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {remoteHealth.banRatePercent === null
                  ? "نسبة الحظر الحقيقية: غير متاحة لعدم وجود محاولات"
                  : `احتمال الحظر المرصود للمحاولة التالية: ${remoteHealth.banRatePercent}%`}
              </div>
              <p className="mt-1">{remoteHealth.measurementReason}</p>
              <p className="mt-1 text-xs">
                إجمالي المحاولات: {remoteHealth.totalSendAttempts} — أحداث الحظر المؤكدة: {remoteHealth.totalConfirmedBanEvents}
              </p>
            </div>
          )}
          {sessionSummary.map((summary) => (
            <div key={summary.sessionId} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{summary.sessionId}</span>
                <Badge variant={summary.health?.banStatus === "confirmed" ? "destructive" : summary.health?.connected ? "secondary" : "outline"}>
                  {remoteHealthLoading ? "جاري الفحص..." :
                    summary.health?.banStatus === "confirmed" ? "حظر مؤكد" :
                    summary.health?.connected ? "متصل — لا توجد إشارة حظر" :
                    summary.health?.status === "unknown" ? "الحالة غير معروفة" :
                    "غير متصل — لا يمكن التحقق"}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div><p className="text-muted-foreground">ناجح</p><p className="font-bold text-emerald-600">{summary.sent}</p></div>
                <div><p className="text-muted-foreground">فشل</p><p className="font-bold text-red-600">{summary.failed}</p></div>
                <div><p className="text-muted-foreground">متبقي</p><p className="font-bold">{summary.pending}</p></div>
              </div>
              {summary.health && (
                <div className="grid grid-cols-2 gap-2 text-center text-xs border-t pt-2">
                  <div><p className="text-muted-foreground">محاولات السيرفر</p><p className="font-bold">{summary.health.sendAttempts}</p></div>
                  <div><p className="text-muted-foreground">احتمال المحاولة التالية</p><p className="font-bold">{summary.health.banRatePercent === null ? "غير متاح" : `${summary.health.banRatePercent}%`}</p></div>
                </div>
              )}
              {summary.health?.banStatus === "confirmed" && (
                <p className="text-xs text-red-600">السيرفر الخارجي أرسل حالة: {summary.health.banEvidence}. أوقف هذه الجلسة قبل الاستكمال.</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>جهات الاتصال</CardTitle>
          <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل ({campaign.totalContacts})</SelectItem>
              <SelectItem value="pending">لم يُرسل</SelectItem>
              <SelectItem value="sent">أُرسلت</SelectItem>
              <SelectItem value="failed">فشل الإرسال</SelectItem>
              <SelectItem value="will_sell">يريد البيع</SelectItem>
              <SelectItem value="will_buy">يريد الشراء</SelectItem>
              <SelectItem value="not_interested">غير مهتم</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>رقم القطعة</TableHead>
                  <TableHead>المساحة</TableHead>
                  <TableHead>الحي/المنطقة</TableHead>
                  <TableHead>المجاورة</TableHead>
                  <TableHead>جلسة الإرسال</TableHead>
                  <TableHead>تاريخ الإرسال</TableHead>
                  <TableHead>الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.length === 0 ? (
                  <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد جهات اتصال</TableCell>
                  </TableRow>
                ) : filteredContacts.map((contact) => (
                  <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell dir="ltr" className="font-mono text-sm">{contact.phone}</TableCell>
                    <TableCell>{contact.plotNumber}</TableCell>
                    <TableCell>{contact.area}</TableCell>
                    <TableCell>{contact.district}</TableCell>
                    <TableCell>{contact.neighborhood}</TableCell>
                    <TableCell className="font-mono text-xs">{contact.sendSessionId ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.sentAt ? format(new Date(contact.sentAt), "dd/MM HH:mm") : "—"}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={contact.status}
                        onValueChange={(v) => handleStatusUpdate(contact.id, v)}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs" data-testid={`select-status-${contact.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">لم يُرسل</SelectItem>
                          <SelectItem value="sent">أُرسلت</SelectItem>
                          <SelectItem value="will_sell">يريد البيع</SelectItem>
                          <SelectItem value="will_buy">يريد الشراء</SelectItem>
                          <SelectItem value="not_interested">غير مهتم</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
