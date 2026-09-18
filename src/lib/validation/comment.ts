import { z } from "zod";

export const createCommentSchema = z.object({
  entityId: z.string().min(1),
  documentId: z.string().min(1).optional(),
  documentVersionId: z.string().min(1).optional(),
  kpiId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  body: z.string().trim().min(1, "Comment can't be empty.").max(5000, "Keep comments under 5000 characters."),
  mentionedUserIds: z.array(z.string().min(1)).max(20).optional(),
});
