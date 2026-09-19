import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/current-user";
import { isDsacWideRole } from "@/lib/constants";

/** Pages that only make sense inside an entity's own portal. DSAC staff are sent to their dashboard instead. */
export async function requirePortalUser(): Promise<CurrentUser & { entityId: string }> {
  const user = await requireUser();
  if (isDsacWideRole(user.role) || !user.entityId) redirect("/dashboard");
  return user as CurrentUser & { entityId: string };
}

/** Pages that only make sense for DSAC staff. Entity users are sent to their dashboard instead. */
export async function requireDsacUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!isDsacWideRole(user.role)) redirect("/dashboard");
  return user;
}
