import { notFound } from "next/navigation";
import { requireDsacUser } from "@/lib/portal";
import { getEntityContext } from "@/lib/data/entity-view";
import { PerformanceView } from "@/components/performance-view";

export default async function EntityPerformancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireDsacUser();
  const { id } = await params;
  const { fy } = await searchParams;
  const ctx = await getEntityContext(user, id, fy).catch(() => null);
  if (!ctx) notFound();
  return <PerformanceView ctx={ctx} user={user} />;
}
