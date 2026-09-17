"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCwIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecalculateRiskButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function recalculate() {
    setLoading(true);
    try {
      const res = await fetch("/api/risk/recalculate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Recalculation failed.");
      toast.success(`Risk recalculated for ${data.entitiesRecalculated} entities.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recalculation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={loading} onClick={recalculate}>
      {loading ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
      Recalculate now
    </Button>
  );
}
