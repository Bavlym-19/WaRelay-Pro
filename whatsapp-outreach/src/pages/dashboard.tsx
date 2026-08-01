import { useListCampaigns } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Plus, BarChart3, Users, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: campaigns, isLoading } = useListCampaigns();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">لوحة القيادة</h1>
          <p className="text-muted-foreground mt-1">نظرة عامة على جميع حملات التسويق العقاري</p>
        </div>
        <Link href="/campaigns/new" data-testid="button-new-campaign">
          <Button className="w-full sm:w-auto gap-2">
            <Plus className="h-4 w-4" />
            إنشاء حملة جديدة
          </Button>
        </Link>
      </div>

      {!campaigns?.length ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mb-2">لا توجد حملات</CardTitle>
          <CardDescription className="max-w-sm mb-6">
            لم تقم بإنشاء أي حملات بعد. ابدأ بإضافة جهات الاتصال الخاصة بك وإرسال رسائل WhatsApp الأولى.
          </CardDescription>
          <Link href="/campaigns/new">
            <Button>ابدأ الآن</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="group hover:border-primary/50 transition-colors flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="line-clamp-2 text-lg leading-tight" title={campaign.name}>
                    {campaign.name}
                  </CardTitle>
                  <Badge 
                    variant={
                      campaign.status === "done" ? "default" :
                      campaign.status === "sending" ? "secondary" : "outline"
                    }
                    className="shrink-0"
                  >
                    {campaign.status === "done" ? "مكتملة" :
                     campaign.status === "sending" ? "جاري الإرسال" : "مسودة"}
                  </Badge>
                </div>
                <CardDescription>
                  {format(new Date(campaign.createdAt), "dd MMMM yyyy", { locale: ar })}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4 flex-1">
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>الكل:</span>
                    <strong className="text-foreground font-semibold">{campaign.totalContacts}</strong>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Send className="h-4 w-4" />
                    <span>تم الإرسال:</span>
                    <strong className="text-foreground font-semibold">{campaign.sentCount}</strong>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>مهتم بالشراء:</span>
                    <strong className="text-foreground font-semibold">{campaign.willBuyCount}</strong>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    <span>مهتم بالبيع:</span>
                    <strong className="text-foreground font-semibold">{campaign.willSellCount}</strong>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0 border-t mt-auto">
                <Link href={`/campaigns/${campaign.id}`} className="w-full mt-4">
                  <Button variant="outline" className="w-full group-hover:bg-primary/5 transition-colors">
                    عرض التفاصيل
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
