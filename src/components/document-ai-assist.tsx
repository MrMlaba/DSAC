"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SparklesIcon, Loader2Icon, AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Analysis {
  summary: string;
  keyFigures: { label: string; value: string }[];
  inconsistencies: string[];
}

export function DocumentAiAssist({ versionId, existingSummary }: { versionId: string; existingSummary: string | null }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(existingSummary ? null : null);
  const [hasRun, setHasRun] = useState(!!existingSummary);
  const [summary, setSummary] = useState(existingSummary);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/versions/${versionId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setAnalysis(data);
      setSummary(data.summary);
      setHasRun(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          Suggestions only — always for a human reviewer to check, never used to approve or return automatically.
        </p>
        <Button size="sm" variant="outline" disabled={loading} onClick={run}>
          {loading ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
          {hasRun ? "Re-run AI analysis" : "Run AI analysis"}
        </Button>
      </div>

      {summary && (
        <div className="bg-muted space-y-2 rounded-lg p-3 text-sm">
          <p className="whitespace-pre-wrap">{summary}</p>

          {analysis && analysis.keyFigures.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {analysis.keyFigures.map((f, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {f.label}: {f.value}
                </Badge>
              ))}
            </div>
          )}

          {analysis && analysis.inconsistencies.length > 0 && (
            <div className="space-y-1 border-t pt-2">
              <p className="flex items-center gap-1 text-xs font-medium text-[var(--status-warning)]">
                <AlertTriangleIcon className="size-3.5" />
                Possible inconsistencies to check
              </p>
              <ul className="list-inside list-disc space-y-0.5 text-xs">
                {analysis.inconsistencies.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
