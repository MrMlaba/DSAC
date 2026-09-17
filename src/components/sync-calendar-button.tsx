"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarPlusIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncCalendarButton({ deadlineId }: { deadlineId: string }) {
  const [loading, setLoading] = useState(false);

  async function sync() {
    setLoading(true);
    try {
      const res = await fetch(`/api/deadlines/${deadlineId}/sync-calendar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to sync.");
      toast[data.configured ? "success" : "info"](
        data.configured ? "Added to your calendar." : "Microsoft Graph isn't configured — this is a mock calendar sync for the demo.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="xs" variant="outline" disabled={loading} onClick={sync}>
      {loading ? <Loader2Icon className="animate-spin" /> : <CalendarPlusIcon />}
      Add to calendar
    </Button>
  );
}
