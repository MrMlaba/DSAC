import { auth } from "@/lib/auth";
import { isDsacWideRole } from "@/lib/constants";
import type { Role } from "@prisma/client";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  entityId: string | null;
}

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

/**
 * Tenant-isolation guard: throws unless the current user is a DSAC-wide role
 * or belongs to the given entity. Every entity-scoped data access should
 * call this (or filter through it) rather than relying on the UI alone.
 */
export function assertEntityAccess(user: CurrentUser, entityId: string) {
  if (isDsacWideRole(user.role)) return;
  if (user.entityId === entityId) return;
  throw new Error("Forbidden: user does not have access to this entity");
}

/**
 * Returns a Prisma `where` fragment that scopes a query to the current
 * user's entity, or `{}` (no restriction) for DSAC-wide roles. Use this for
 * models that reference an entity via an `entityId` foreign key (Kpi,
 * Document, Task, ...).
 */
export function entityScopeWhere(user: CurrentUser): { entityId?: string } {
  if (isDsacWideRole(user.role)) return {};
  if (!user.entityId) return { entityId: "__none__" }; // no entity => no rows
  return { entityId: user.entityId };
}

/**
 * Same as `entityScopeWhere`, but for querying the Entity model itself
 * (whose primary key is `id`, not `entityId`).
 */
export function entityIdScopeWhere(user: CurrentUser): { id?: string } {
  if (isDsacWideRole(user.role)) return {};
  if (!user.entityId) return { id: "__none__" };
  return { id: user.entityId };
}
