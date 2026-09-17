"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DownloadIcon, EyeIcon, HistoryIcon, Loader2Icon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const PREVIEWABLE_TEXT_TYPES = ["text/plain", "text/csv"];

export function DocumentVersionActions({
  versionId,
  mimeType,
  isLatest,
  canRestore,
}: {
  versionId: string;
  mimeType: string;
  isLatest: boolean;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [openingSharePoint, setOpeningSharePoint] = useState(false);

  const canPreviewInline = PREVIEWABLE_TEXT_TYPES.includes(mimeType);
  const canPreviewPdf = mimeType === "application/pdf";

  async function openTextPreview() {
    setPreviewOpen(true);
    setPreviewText(null);
    const res = await fetch(`/api/documents/versions/${versionId}/preview`);
    setPreviewText(res.ok ? await res.text() : "Unable to load preview.");
  }

  async function openInSharePoint() {
    setOpeningSharePoint(true);
    try {
      const res = await fetch(`/api/documents/versions/${versionId}/sharepoint-url`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get SharePoint link.");
      if (!data.configured) {
        toast.info("Microsoft Graph isn't configured — this is a mock SharePoint link for the demo.");
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to get SharePoint link.");
    } finally {
      setOpeningSharePoint(false);
    }
  }

  async function restore() {
    setRestoring(true);
    try {
      const res = await fetch(`/api/documents/versions/${versionId}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed.");
      toast.success(`Restored as version ${data.versionNumber}.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {canPreviewInline && (
        <Button size="icon-sm" variant="ghost" title="Preview" onClick={openTextPreview}>
          <EyeIcon />
        </Button>
      )}
      {canPreviewPdf && (
        <Button size="icon-sm" variant="ghost" title="Preview" render={<a href={`/api/documents/versions/${versionId}/view`} target="_blank" rel="noreferrer" />}>
          <EyeIcon />
        </Button>
      )}
      <Button size="icon-sm" variant="ghost" title="Download" render={<a href={`/api/documents/versions/${versionId}/download`} />}>
        <DownloadIcon />
      </Button>
      <Button size="icon-sm" variant="ghost" title="Open in SharePoint" disabled={openingSharePoint} onClick={openInSharePoint}>
        {openingSharePoint ? <Loader2Icon className="animate-spin" /> : <ExternalLinkIcon />}
      </Button>
      {!isLatest && canRestore && (
        <Button size="icon-sm" variant="ghost" title="Restore this version" disabled={restoring} onClick={restore}>
          {restoring ? <Loader2Icon className="animate-spin" /> : <HistoryIcon />}
        </Button>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>Synthetic demo content.</DialogDescription>
          </DialogHeader>
          <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
            {previewText ?? "Loading…"}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
