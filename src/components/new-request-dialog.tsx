"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FUNDING_REQUEST_CATEGORIES, REQUEST_CATEGORY_LABELS } from "@/lib/constants";
import type { RequestCategory } from "@prisma/client";

const selectClass = "border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function NewRequestDialog({ programmes }: { programmes: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<RequestCategory>("ADDITIONAL_FUNDING");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [programme, setProgramme] = useState("");
  const [motivation, setMotivation] = useState("");
  const [outcome, setOutcome] = useState("");
  const isFunding = FUNDING_REQUEST_CATEGORIES.includes(category);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          amountRequested: isFunding && amount.trim() ? Number(amount) : undefined,
          motivation,
          linkedProgramme: programme || undefined,
          expectedOutcome: outcome,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit the request.");
      toast.success("Request submitted to DSAC.");
      setOpen(false);
      setTitle("");
      setAmount("");
      setMotivation("");
      setOutcome("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit the request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PlusIcon />
        New request
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New budget or support request</DialogTitle>
            <DialogDescription>DSAC reviews it and responds here. You can attach supporting documents from the Documents page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="req-title">Request title</Label>
            <Input id="req-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Additional funding for facility repairs" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="req-category">Category</Label>
              <select id="req-category" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as RequestCategory)}>
                {(Object.keys(REQUEST_CATEGORY_LABELS) as RequestCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {REQUEST_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            {isFunding && (
              <div className="space-y-1.5">
                <Label htmlFor="req-amount">Amount requested (R)</Label>
                <Input id="req-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="tabular-nums" />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-programme">Linked programme</Label>
            <select id="req-programme" className={selectClass} value={programme} onChange={(e) => setProgramme(e.target.value)}>
              <option value="">None</option>
              {programmes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-motivation">Motivation</Label>
            <Textarea id="req-motivation" rows={3} value={motivation} onChange={(e) => setMotivation(e.target.value)} placeholder="Why is this needed?" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-outcome">Expected outcome</Label>
            <Textarea id="req-outcome" rows={2} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="What will change if it is approved?" required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || !title.trim() || !motivation.trim() || !outcome.trim()}>
              {saving && <Loader2Icon className="animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
