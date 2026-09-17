import { LogOutIcon, RefreshCwIcon, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { credentialsSignIn } from "@/app/login/actions";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/seed-data/demo-users";
import type { CurrentUser } from "@/lib/current-user";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ user }: { user: CurrentUser }) {
  const otherDemoUsers = DEMO_USERS.filter((d) => d.email !== user.email);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-2" />}>
        <Avatar className="size-6">
          <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col">
          <span className="flex items-center gap-1.5 font-medium">
            <UserIcon className="size-3.5" />
            {user.name}
          </span>
          <span className="text-muted-foreground text-xs font-normal">{ROLE_LABELS[user.role]}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground text-[10px] font-normal tracking-wide uppercase">
          Switch demo role
        </DropdownMenuLabel>
        {otherDemoUsers.map((demoUser) => (
          <form key={demoUser.email} action={credentialsSignIn}>
            <input type="hidden" name="email" value={demoUser.email} />
            <input type="hidden" name="password" value={DEMO_PASSWORD} />
            <DropdownMenuItem render={<button type="submit" className="flex w-full items-center gap-2" />}>
              <RefreshCwIcon className="size-3.5 shrink-0" />
              <span className="flex min-w-0 flex-col text-left">
                <span className="truncate">{demoUser.name}</span>
                <span className="text-muted-foreground truncate text-[11px]">{ROLE_LABELS[demoUser.role]}</span>
              </span>
            </DropdownMenuItem>
          </form>
        ))}
        <DropdownMenuSeparator />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <DropdownMenuItem
            variant="destructive"
            render={<button type="submit" className="flex w-full items-center gap-2" />}
          >
            <LogOutIcon className="size-3.5" />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
