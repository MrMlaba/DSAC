"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // Polling failure is silent — the bell just shows stale counts until the next tick.
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    refresh();
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    refresh();
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) refresh();
      }}
    >
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <BellIcon />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]" variant="destructive">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-primary text-xs hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">No notifications yet.</p>
        ) : (
          <ScrollArea className="h-80">
            <div className="space-y-1 p-1">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`block rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="leading-snug font-medium">{n.title}</p>
                    {!n.read && <span className="bg-primary mt-1 size-1.5 shrink-0 rounded-full" />}
                  </div>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{n.body}</p>
                  <p className="text-muted-foreground mt-1 text-[10px]">{new Date(n.createdAt).toLocaleString("en-ZA")}</p>
                </Link>
              ))}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
