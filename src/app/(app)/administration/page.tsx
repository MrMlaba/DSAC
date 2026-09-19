import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon, BookOpenIcon, ShieldIcon } from "lucide-react";
import { requireUser } from "@/lib/current-user";
import { canAdminister } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  { href: "/administration/standards", icon: BookOpenIcon, title: "Reporting standards", description: "The standard KPI structure, expense lines, reporting calendar, status rules and the exact formulas behind every figure and percentage." },
  { href: "/administration/audit-log", icon: ShieldIcon, title: "Audit log", description: "Append-only record of report submissions and reviews, document views and downloads, decisions and AI interactions." },
] as const;

export default async function AdministrationPage() {
  const user = await requireUser();
  if (!canAdminister(user.role)) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Administration" description="How reporting is standardised, and the record of what has happened. DSAC Admin only." />
      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group block">
            <Card className="group-hover:border-primary/40 h-full transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <s.icon className="size-4" />
                  {s.title}
                </CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-primary inline-flex items-center gap-1 text-sm group-hover:underline">
                  Open <ArrowRightIcon className="size-3.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
