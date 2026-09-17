"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, UndoIcon, SearchIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReviewStatus } from "@prisma/client";

type Action = "start_review" | "approve" | "return";

export function DocumentReviewActions({ versionId, status }: { versionId: string; status: ReviewStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [comment, setComment] = useState("");

  async function act(action: Action, body?: Record<string, unknown>) {
    setLoading(action);
    try {
      const res = await fetch(`/api/documents/versions/${versionId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      toast.success(action === "approve" ? "Approved." : action === "return" ? "Returned to the entity." : "Marked under review.");
      setReturnOpen(false);
      setComment("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setLoading(null);
    }
  }

  if (status === "APPROVED" || status === "RETURNED") return null;

  return (
    <div className="flex flex-wrap gap-2">
      {status === "RECEIVED" && (
        <Button size="sm" variant="outline" disabled={!!loading} onClick={() => act("start_review")}>
          {loading === "start_review" ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
          Start review
        </Button>
      )}
      <Button size="sm" disabled={!!loading} onClick={() => act("approve")}>
        {loading === "approve" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
        Approve
      </Button>
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogTrigger render={<Button size="sm" variant="outline" disabled={!!loading} />}>
          <UndoIcon />
          Return
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Return this document</DialogTitle>
            <DialogDescription>Tell the entity what needs to change before resubmission.</DialogDescription>
          </DialogHeader>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Reason for returning…" />
          <DialogFooter>
            <Button variant="outline" disabled={!!loading} onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!!loading || !comment.trim()} onClick={() => act("return", { comment })}>
              {loading === "return" && <Loader2Icon className="animate-spin" />}
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
