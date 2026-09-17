import { auth } from "@/lib/auth";
import type { CurrentUser } from "@/lib/tenant-scope";

export type { CurrentUser };
export { assertEntityAccess, entityScopeWhere, entityIdScopeWhere } from "@/lib/tenant-scope";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
    entityId: session.user.entityId,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
