"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AtSignIcon, CheckIcon, Loader2Icon, SendIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { useEntityEvents } from "@/hooks/use-entity-events";

interface CommentAuthor {
  id: string;
  name: string;
  role: string;
}
interface CommentData {
  id: string;
  body: string;
  authorId: string;
  author: CommentAuthor;
  createdAt: string;
  resolved: boolean;
  mentionedUserIds: string[];
  replies: CommentData[];
}
interface TeamMember {
  id: string;
  name: string;
}
interface PresenceUser {
  userId: string;
  name: string;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-ZA");
}

export function CommentsFeed({
  entityId,
  anchor,
  initialComments,
  teamMembers,
  currentUserId,
  canComment,
}: {
  entityId: string;
  anchor: { documentId?: string; documentVersionId?: string; kpiId?: string; taskId?: string };
  initialComments: CommentData[];
  teamMembers: TeamMember[];
  currentUserId: string;
  canComment: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEntityEvents(entityId, {
    "comment.created": (data) => {
      const { comment, parentId } = data as {
        comment: CommentData & { documentId: string | null; documentVersionId: string | null; kpiId: string | null; taskId: string | null };
        parentId: string | null;
      };
      const sameAnchor =
        comment.documentId === (anchor.documentId ?? null) &&
        comment.documentVersionId === (anchor.documentVersionId ?? null) &&
        comment.kpiId === (anchor.kpiId ?? null) &&
        comment.taskId === (anchor.taskId ?? null);
      if (!sameAnchor) return;

      setComments((prev) => {
        if (parentId) {
          return prev.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, comment] } : c));
        }
        if (prev.some((c) => c.id === comment.id)) return prev;
        return [{ ...comment, replies: [] }, ...prev];
      });
    },
    "comment.resolved": (data) => {
      const { commentId } = data as { commentId: string };
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c)));
    },
    "presence.updated": (data) => setPresence(data as PresenceUser[]),
  });

  async function post(text: string, parentId?: string) {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId, ...anchor, body: text, parentId, mentionedUserIds: parentId ? [] : mentioned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to post comment.");
      if (parentId) {
        setReplyBody("");
        setReplyTo(null);
      } else {
        setBody("");
        setMentioned([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resolve(commentId: string) {
    try {
      await fetch(`/api/comments/${commentId}/resolve`, { method: "POST" });
    } catch {
      toast.error("Failed to resolve comment.");
    }
  }

  const others = presence.filter((p) => p.userId !== currentUserId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UsersIcon className="text-muted-foreground size-4" />
        <p className="text-muted-foreground text-xs">
          {others.length === 0 ? "Only you are viewing this workspace right now." : `Also viewing: ${others.map((p) => p.name).join(", ")}`}
        </p>
      </div>

      {canComment && (
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Post a comment…" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                  <AtSignIcon />
                  Mention
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {teamMembers.map((m) => (
                    <DropdownMenuCheckboxItem
                      key={m.id}
                      checked={mentioned.includes(m.id)}
                      onCheckedChange={(checked) =>
                        setMentioned((prev) => (checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)))
                      }
                    >
                      {m.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {mentioned.map((id) => (
                <Badge key={id} variant="outline" className="text-[10px]">
                  @{teamMembers.find((m) => m.id === id)?.name}
                </Badge>
              ))}
            </div>
            <Button size="sm" disabled={submitting || !body.trim()} onClick={() => post(body)}>
              {submitting ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              Post
            </Button>
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex gap-2">
                <Avatar className="size-7 shrink-0">
                  <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{c.author.name}</span>
                    <span className="text-muted-foreground text-xs">{timeAgo(c.createdAt)}</span>
                    {c.resolved && (
                      <Badge variant="outline" className="text-[10px] text-[var(--status-good)]">
                        <CheckIcon className="size-3" /> Resolved
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
                  <div className="flex gap-2">
                    {canComment && (
                      <button
                        className="text-muted-foreground hover:text-foreground text-xs"
                        onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                      >
                        Reply
                      </button>
                    )}
                    {canComment && !c.resolved && (
                      <button className="text-muted-foreground hover:text-foreground text-xs" onClick={() => resolve(c.id)}>
                        Mark resolved
                      </button>
                    )}
                  </div>

                  {replyTo === c.id && (
                    <div className="flex gap-2 pt-1">
                      <Textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={2} placeholder="Reply…" />
                      <Button size="sm" disabled={submitting || !replyBody.trim()} onClick={() => post(replyBody, c.id)}>
                        Send
                      </Button>
                    </div>
                  )}

                  {c.replies.length > 0 && (
                    <div className="space-y-2 border-l pl-3">
                      {c.replies.map((r) => (
                        <div key={r.id} className="flex gap-2">
                          <Avatar className="size-6 shrink-0">
                            <AvatarFallback className="text-[9px]">{initials(r.author.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium">{r.author.name}</span>
                              <span className="text-muted-foreground text-[11px]">{timeAgo(r.createdAt)}</span>
                            </div>
                            <p className="text-xs break-words whitespace-pre-wrap">{r.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
