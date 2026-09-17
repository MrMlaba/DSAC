"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TASK_DIRECTION_LABELS, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/lib/constants";
import type { TaskStatus } from "@prisma/client";

export interface TaskCardData {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  direction: string;
  dueDate: string | null;
  entity: { id: string; name: string };
  assignee: { id: string; name: string };
  assigner: { id: string; name: string };
  _count: { comments: number };
}

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  BLOCKED: "IN_PROGRESS",
  DONE: null,
};

export function TasksBoard({ tasks, showEntity, canEdit }: { tasks: TaskCardData[]; showEntity: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);

  async function moveTask(taskId: string, status: TaskStatus) {
    setUpdating(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update task.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task.");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUS_ORDER.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div key={status} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h3>
              <Badge variant="outline" className="text-[10px]">
                {columnTasks.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {columnTasks.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="text-muted-foreground py-6 text-center text-xs">Nothing here.</CardContent>
                </Card>
              ) : (
                columnTasks.map((task) => {
                  const next = NEXT_STATUS[task.status];
                  return (
                    <Card key={task.id}>
                      <CardHeader className="gap-1 pb-2">
                        <CardTitle className="text-sm leading-snug font-medium">{task.title}</CardTitle>
                        <p className="text-muted-foreground text-xs">
                          {TASK_DIRECTION_LABELS[task.direction as keyof typeof TASK_DIRECTION_LABELS]}
                          {showEntity ? ` · ${task.entity.name}` : ""}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs">
                        {task.description && <p className="text-muted-foreground line-clamp-2">{task.description}</p>}
                        <p className="text-muted-foreground">
                          {task.assigner.name} → {task.assignee.name}
                        </p>
                        <div className="flex items-center justify-between">
                          {task.dueDate ? (
                            <Badge variant="outline" className="text-[10px]">
                              Due {new Date(task.dueDate).toLocaleDateString("en-ZA")}
                            </Badge>
                          ) : (
                            <span />
                          )}
                          {task._count.comments > 0 && <span className="text-muted-foreground">{task._count.comments} comment(s)</span>}
                        </div>
                        {canEdit && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {task.status !== "BLOCKED" && task.status !== "DONE" && (
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={updating === task.id}
                                onClick={() => moveTask(task.id, "BLOCKED")}
                              >
                                Block
                              </Button>
                            )}
                            {next && (
                              <Button size="xs" disabled={updating === task.id} onClick={() => moveTask(task.id, next)}>
                                {updating === task.id ? <Loader2Icon className="animate-spin" /> : <ArrowRightIcon />}
                                {TASK_STATUS_LABELS[next]}
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
