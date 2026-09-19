"use client";

import { useState } from "react";
import { toast } from "sonner";
import { SparklesIcon, SendIcon, Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EXAMPLES = ["Which entities are at critical risk?", "Which reports are overdue?", "What is our overall utilisation?"];

export function AskTheData() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [toolsUsed, setToolsUsed] = useState<string[]>([]);

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to answer.");
      setAnswer(data.answer);
      setToolsUsed(data.toolsUsed ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to answer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SparklesIcon className="size-4" />
          Ask the data
        </CardTitle>
        <CardDescription>Answers use only structured query results from this dashboard — never raw SQL, never data outside your access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Which entities are at critical risk?" />
          <Button type="submit" size="icon" disabled={loading || !question.trim()}>
            {loading ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          </Button>
        </form>

        {!answer && !loading && (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuestion(ex);
                  ask(ex);
                }}
                className="bg-muted hover:bg-muted/70 rounded-full px-2.5 py-1 text-xs transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}

        {answer && (
          <div className="bg-muted space-y-2 rounded-lg p-3">
            <p className="text-sm whitespace-pre-wrap">{answer}</p>
            {toolsUsed.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground text-[10px] tracking-wide uppercase">Data used:</span>
                {toolsUsed.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {t.replaceAll("_", " ")}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
