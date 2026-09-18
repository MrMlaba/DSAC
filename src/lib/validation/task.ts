import { z } from "zod";

export const createTaskSchema = z.object({
  entityId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required.").max(200, "Keep the title under 200 characters."),
  description: z.string().trim().max(2000).optional(),
  assigneeId: z.string().min(1),
  direction: z.enum(["INTERNAL", "TO_DSAC", "FROM_DSAC"]),
  dueDate: z.string().min(1).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]),
});
