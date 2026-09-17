import { requireUser } from "@/lib/current-user";
import { listTasks } from "@/lib/data/tasks";
import { listEntityOptions } from "@/lib/data/documents";
import { isDsacWideRole, isReadOnlyRole, taskDirectionsForRole } from "@/lib/constants";
import { TasksBoard } from "@/components/tasks-board";
import { CreateTaskDialog } from "@/components/create-task-dialog";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const dsacWide = isDsacWideRole(user.role);
  const resolved = await searchParams;
  const entityId = dsacWide && typeof resolved.entity === "string" ? resolved.entity : undefined;

  const [tasks, entities] = await Promise.all([listTasks(user, { entityId }), listEntityOptions(user)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground text-sm">
            Work assigned within an entity, to DSAC, or from DSAC to an entity.
          </p>
        </div>
        {!isReadOnlyRole(user.role) && <CreateTaskDialog entities={entities} directions={taskDirectionsForRole(user.role)} />}
      </div>

      <TasksBoard
        tasks={tasks.map((t) => ({
          ...t,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        }))}
        showEntity={dsacWide}
        canEdit={!isReadOnlyRole(user.role)}
      />
    </div>
  );
}
