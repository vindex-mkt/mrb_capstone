"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconBell } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

const NOTIFICATION_LIMIT = 20;

function parseNotification(value: unknown): Notification | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;

  if (
    (typeof row.id !== "string" && typeof row.id !== "number") ||
    typeof row.type !== "string" ||
    typeof row.title !== "string" ||
    typeof row.body !== "string" ||
    typeof row.href !== "string" ||
    (row.read_at !== null && typeof row.read_at !== "string") ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: String(row.id),
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

function formatNotificationTime(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function NotificationsNavButton() {
  const [supabase] = useState(createClient);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const seenNotificationIds = useRef(new Set<string>());
  const realtimeNotifications = useRef(new Map<string, Notification>());

  useEffect(() => {
    let isCurrent = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isCurrent) return;
      setUserId(session?.user.id ?? null);
      setIsAuthLoading(false);
      setMenuOpen(false);
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!isCurrent) return;
      if (error) {
        console.error("No se pudo verificar la sesión de notificaciones:", error);
        setUserId(null);
      } else {
        setUserId(data.user?.id ?? null);
      }
      setIsAuthLoading(false);
    });

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let isCurrent = true;
    seenNotificationIds.current.clear();
    realtimeNotifications.current.clear();

    if (isAuthLoading) return () => { isCurrent = false; };
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      setErrorMessage(null);
      return () => { isCurrent = false; };
    }

    setNotifications([]);
    setUnreadCount(0);
    setIsLoading(true);
    setErrorMessage(null);

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = parseNotification(payload.new);
          if (!notification || seenNotificationIds.current.has(notification.id)) return;

          seenNotificationIds.current.add(notification.id);
          realtimeNotifications.current.set(notification.id, notification);
          setNotifications((current) =>
            [notification, ...current.filter((item) => item.id !== notification.id)]
              .slice(0, NOTIFICATION_LIMIT),
          );
          if (!notification.read_at) {
            setUnreadCount((current) => current + 1);
          }
        },
      )
      .subscribe((status) => {
        if (!isCurrent) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.error(`La suscripción Realtime de notificaciones falló: ${status}`);
          setErrorMessage("No se pudo conectar para recibir notificaciones en tiempo real.");
        }
      });

    const loadNotifications = async () => {
      const [notificationsResult, unreadResult] = await Promise.all([
        supabase
          .from("notifications")
          .select("id, type, title, body, href, read_at, created_at")
          .order("created_at", { ascending: false })
          .limit(NOTIFICATION_LIMIT),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .is("read_at", null),
      ]);

      if (notificationsResult.error) throw notificationsResult.error;
      if (unreadResult.error) throw unreadResult.error;
      if (!isCurrent) return;

      const loaded = (notificationsResult.data ?? []).flatMap((row) => {
        const notification = parseNotification(row);
        return notification ? [notification] : [];
      });
      for (const notification of loaded) {
        seenNotificationIds.current.add(notification.id);
      }

      const realtimeOnly = [...realtimeNotifications.current.values()].filter(
        (notification) => !loaded.some((item) => item.id === notification.id),
      );
      setNotifications((current) => {
        const combined = new Map(
          [...loaded, ...realtimeOnly, ...current].map((item) => [item.id, item]),
        );
        return [...combined.values()]
          .sort((left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
          )
          .slice(0, NOTIFICATION_LIMIT);
      });
      setUnreadCount(
        (unreadResult.count ?? 0) +
        realtimeOnly.filter((notification) => !notification.read_at).length,
      );
    };

    void loadNotifications()
      .catch((error: unknown) => {
        if (!isCurrent) return;
        console.error("No se pudieron cargar las notificaciones:", error);
        setErrorMessage("No se pudieron cargar las notificaciones. Inténtalo nuevamente.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      void supabase.removeChannel(channel);
    };
  }, [isAuthLoading, reloadKey, supabase, userId]);

  const markAsRead = async (notification: Notification) => {
    if (notification.read_at || !userId) return;

    try {
      const { data, error } = await supabase.rpc("mark_notification_read", {
        p_notification_id: Number(notification.id),
      });
      if (error) throw error;
      if (data !== true) throw new Error("La notificación no está disponible para esta cuenta.");

      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? { ...item, read_at: readAt } : item),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      console.error("No se pudo marcar la notificación como leída:", error);
      setErrorMessage("No se pudo actualizar esta notificación.");
    }
  };

  const markAllAsRead = async () => {
    if (!userId || isUpdating || unreadCount === 0) return;

    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.rpc("mark_all_notifications_read");
      if (error) throw error;

      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, read_at: notification.read_at ?? readAt })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("No se pudieron marcar todas las notificaciones como leídas:", error);
      setErrorMessage("No se pudieron actualizar las notificaciones.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isAuthLoading || !userId) {
    return (
      <Link
        href="/login"
        aria-label="Inicia sesión para ver tus notificaciones"
        title="Notificaciones"
        className="icon-btn h-9 w-9 sm:h-10 sm:w-10"
      >
        <IconBell className="h-5 w-5" />
      </Link>
    );
  }

  return (
    <div
      className="relative"
      data-menu-open={menuOpen}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setMenuOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setMenuOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={`Notificaciones${unreadCount > 0 ? `, ${unreadCount} sin leer` : ""}`}
        aria-expanded={menuOpen}
        aria-controls="navbar-notifications"
        onClick={() => setMenuOpen((open) => !open)}
        className="icon-btn h-9 w-9 sm:h-10 sm:w-10"
      >
        <IconBell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="count-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <div
        id="navbar-notifications"
        data-menu-open={menuOpen}
        className="invisible fixed left-4 right-4 top-[4.5rem] z-[70] w-auto translate-y-1 overflow-hidden rounded-2xl border border-border bg-surface opacity-0 shadow-xl transition duration-200 data-[menu-open=true]:visible data-[menu-open=true]:translate-y-0 data-[menu-open=true]:opacity-100 sm:left-auto sm:right-4 sm:w-[min(22rem,calc(100vw-2rem))] md:absolute md:right-0 md:top-full md:mt-2"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold text-foreground">Notificaciones</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount ? `${unreadCount} sin leer` : "Estás al día"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0 || isUpdating}
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Marcar todas como leídas
          </button>
        </div>

        {errorMessage && (
          <div className="px-4 py-3" role="alert">
            <p className="text-sm text-red-700">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
              className="mt-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
            >
              Intentar nuevamente
            </button>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground" role="status">
              Cargando notificaciones...
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No tienes notificaciones.
            </p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={notification.href}
                    onClick={() => {
                      void markAsRead(notification);
                      setMenuOpen(false);
                    }}
                    className={`block border-b border-border px-4 py-3 transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600 ${
                      notification.read_at ? "bg-surface" : "bg-brand-50/70"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-foreground">{notification.title}</span>
                      {!notification.read_at && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-label="Sin leer" />
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{notification.body}</span>
                    <time
                      className="mt-1 block text-xs text-muted-foreground"
                      dateTime={notification.created_at}
                    >
                      {formatNotificationTime(notification.created_at)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
