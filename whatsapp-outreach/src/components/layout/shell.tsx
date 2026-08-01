import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, Settings, Plus, Menu, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "لوحة القيادة", icon: LayoutDashboard },
    { href: "/campaigns/new", label: "حملة جديدة", icon: Plus },
    { href: "/test-send", label: "إرسال تجريبي", icon: Send },
    { href: "/settings", label: "الإعدادات", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-background rtl">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-sidebar px-6 text-sidebar-foreground shadow-sm">
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-xl tracking-tight">مكتب عقارات</span>
        </div>

        <nav className="hidden md:flex items-center gap-6 mr-10 font-medium text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 transition-colors hover:text-sidebar-primary",
                location === item.href ? "text-sidebar-primary" : "text-sidebar-foreground/80"
              )}
              data-testid={`nav-${item.href.replace("/", "") || "home"}`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-auto md:hidden text-sidebar-foreground">
              <Menu className="h-5 w-5" />
              <span className="sr-only">فتح القائمة</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-sidebar text-sidebar-foreground border-sidebar-border rtl">
            <SheetTitle className="text-sidebar-foreground mb-6 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-sidebar-primary" />
              مكتب عقارات
            </SheetTitle>
            <nav className="grid gap-4 text-lg font-medium">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    location === item.href ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          {children}
        </div>
      </main>
    </div>
  );
}
