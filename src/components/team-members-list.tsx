import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@prisma/client";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function TeamMembersList({ members }: { members: { id: string; name: string; email: string; role: Role }[] }) {
  if (members.length === 0) {
    return <p className="text-muted-foreground text-sm">No team members recorded for this entity.</p>;
  }

  return (
    <div className="space-y-3">
      {members.map((m) => (
        <div key={m.id} className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{m.name}</p>
            <p className="text-muted-foreground truncate text-xs">{m.email}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {ROLE_LABELS[m.role]}
          </Badge>
        </div>
      ))}
    </div>
  );
}
