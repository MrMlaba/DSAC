"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcwIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeletedDocument {
  id: string;
  title: string;
  deletedAt: string | Date | null;
  entity: { name: string };
}

export function DeletedDocumentsList({ documents }: { documents: DeletedDocument[] }) {
  const router = useRouter();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function restore(id: string) {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/documents/${id}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed.");
      toast.success("Document restored.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Deleted documents — recoverable</p>
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between gap-2 text-sm">
          <div className="min-w-0">
            <p className="truncate">{doc.title}</p>
            <p className="text-muted-foreground text-xs">
              {doc.entity.name} · deleted {doc.deletedAt ? new Date(doc.deletedAt).toLocaleString("en-ZA") : ""}
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={restoringId === doc.id} onClick={() => restore(doc.id)}>
            {restoringId === doc.id ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
            Restore
          </Button>
        </div>
      ))}
    </div>
  );
}
