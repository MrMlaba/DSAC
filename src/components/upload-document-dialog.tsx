"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloudIcon, FileIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPE_ORDER, PORTFOLIO_QUARTERS, QUARTER_LABELS, QUARTERLY_DOCUMENT_TYPES } from "@/lib/constants";
import type { EvidenceTargets } from "@/lib/data/evidence";
import type { DocumentType, Quarter } from "@prisma/client";

export function UploadDocumentDialog({
  entities,
  financialYears,
  defaultFinancialYearId,
  targets,
  initialLink,
}: {
  entities: { id: string; name: string }[];
  financialYears: { id: string; label: string }[];
  defaultFinancialYearId: string;
  /** What this entity's evidence can be linked to. Omitted for DSAC staff, who upload across entities. */
  targets?: EvidenceTargets;
  /** Pre-selected link, e.g. "report:<id>" — set when arriving from a "Go to Documents" prompt. */
  initialLink?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const changeNoteRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(Boolean(initialLink));
  const [link, setLink] = useState(initialLink ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [type, setType] = useState<DocumentType>(initialLink ? "OTHER" : "QUARTERLY_REPORT");
  const [financialYearId, setFinancialYearId] = useState(defaultFinancialYearId);
  const [quarter, setQuarter] = useState<Quarter>("Q1");
  const [title, setTitle] = useState("");
  const isQuarterly = QUARTERLY_DOCUMENT_TYPES.includes(type);

  function reset() {
    setFile(null);
    setTitle("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("entityId", entityId);
      form.set("type", type);
      form.set("financialYearId", financialYearId);
      if (isQuarterly) form.set("quarter", quarter);
      form.set("title", title || file.name);
      const changeNote = changeNoteRef.current?.value;
      if (changeNote) form.set("changeNote", changeNote);
      const [linkKind, linkId] = link.split(":");
      if (linkId) form.set(linkKind === "report" ? "reportId" : linkKind === "kpi" ? "kpiId" : "budgetLineId", linkId);

      const res = await fetch("/api/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");

      toast.success(`Uploaded — version ${data.versionNumber} received.`);
      setOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <UploadCloudIcon />
        Upload document
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              Uploading to an existing type/period creates a new version automatically — nothing is overwritten.
            </DialogDescription>
          </DialogHeader>

          {entities.length > 1 && (
            <div className="space-y-1.5">
              <Label>Entity</Label>
              <Select value={entityId} onValueChange={(v) => setEntityId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Document type</Label>
              <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOCUMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Financial year</Label>
              <Select value={financialYearId} onValueChange={(v) => setFinancialYearId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {financialYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      FY {y.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isQuarterly && (
            <div className="space-y-1.5">
              <Label>Quarter</Label>
              <Select value={quarter} onValueChange={(v) => setQuarter(v as Quarter)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PORTFOLIO_QUARTERS.map((q) => (
                    <SelectItem key={q} value={q}>
                      {QUARTER_LABELS[q]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q1 Quarterly Performance Report" />
          </div>

          {targets && (
            <div className="space-y-1.5">
              <Label htmlFor="evidence-link">This document supports</Label>
              <select
                id="evidence-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
              >
                <option value="">Nothing in particular (general document)</option>
                <optgroup label="A report or compliance requirement">
                  {targets.reports.map((t) => (
                    <option key={t.id} value={`report:${t.id}`}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="A KPI">
                  {targets.kpis.map((t) => (
                    <option key={t.id} value={`kpi:${t.id}`}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="A budget line">
                  {targets.lines.map((t) => (
                    <option key={t.id} value={`line:${t.id}`}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-muted-foreground text-xs">Attachments are evidence — link them to what they prove so DSAC sees them in context.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Change note (optional)</Label>
            <Textarea ref={changeNoteRef} rows={2} placeholder="What changed in this version?" />
          </div>

          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
          >
            {file ? (
              <>
                <FileIcon className="text-muted-foreground size-6" />
                <p className="font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">{(file.size / 1024).toFixed(0)} KB</p>
              </>
            ) : (
              <>
                <UploadCloudIcon className="text-muted-foreground size-6" />
                <p>Drag a file here, or</p>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-xs">PDF, Word, Excel, CSV or text — up to 25MB.</p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting || !file}>
              {submitting && <Loader2Icon className="animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
