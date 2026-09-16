"use client";

/**
 * RealtimeProvider — socket.io client for the realtime service (port 3004).
 *
 * Lifecycle:
 *   1. When the user is authenticated, fetch a short-lived HMAC token from
 *      /api/realtime/token and connect to the socket service.
 *   2. Emit `subscribe` with the token and this user's channels
 *      (user:<id>, role:<role>, dept:<department>).
 *   3. Send `presence:ping` every 25s so the service can broadcast presence.
 *   4. Re-fetch the token and re-subscribe every 8 minutes (token TTL 10 min).
 *   5. On reconnect, re-subscribe AND replay what was missed while offline
 *      via the REST `?since=` catch-up endpoints.
 *
 * Components subscribe with `useRealtimeEvent(event, handler)`.
 * Presence state (who is online) is exposed via `useRealtime()`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/lib/auth-context";

export type RealtimeEvent =
  | "assignment:created"
  | "assignment:updated"
  | "assessment:started"
  | "assessment:submitted"
  | "competency:updated"
  | "presence:user_online"
  | "presence:user_offline"
  | "attempts:catchup";

type TokenResponse = {
  token: string;
  userId: string;
  role: string;
  department: string | null;
  socketUrl: string;
};

export type RealtimeContextValue = {
  connected: boolean;
  /** Signed-in user's Store id (from the realtime token). */
  userId: string | null;
  /** userId -> online */
  presence: Map<string, boolean>;
};

type Handler = (payload: unknown) => void;

/** Module-level registry — dispatches socket events to hook subscribers. */
const handlers = new Map<string, Set<Handler>>();

function registerHandler(event: string, handler: Handler): () => void {
  let set = handlers.get(event);
  if (!set) {
    set = new Set();
    handlers.set(event, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
  };
}

function dispatch(event: string, payload: unknown) {
  const set = handlers.get(event);
  if (set) for (const fn of set) fn(payload);
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const sessionEmail = session?.email ?? null;
  const sessionRole = session?.role ?? null;
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [presence, setPresence] = useState<Map<string, boolean>>(new Map());

  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef<TokenResponse | null>(null);
  const offlineSinceRef = useRef<number>(0);

  const subscribe = useCallback(() => {
    const socket = socketRef.current;
    const tokenInfo = tokenRef.current;
    if (!socket || !tokenInfo || !socket.connected) return;

    const channels = [
      `user:${tokenInfo.userId}`,
      `role:${tokenInfo.role}`,
      ...(tokenInfo.department ? [`dept:${tokenInfo.department}`] : []),
    ];

    socket.emit(
      "subscribe",
      { token: tokenInfo.token, channels, name: session?.name ?? "" },
      (res: { ok: boolean }) => {
        if (!res?.ok) return;

        // Offline catch-up: replay events missed since we last listened.
        if (offlineSinceRef.current > 0) {
          const since = new Date(offlineSinceRef.current).toISOString();
          void (async () => {
            try {
              const resA = await fetch(
                `/api/assignments?since=${encodeURIComponent(since)}`,
              );
              if (resA.ok) {
                const data = (await resA.json()) as {
                  assignments: unknown[];
                };
                for (const a of data.assignments) dispatch("assignment:created", a);
              }
              const resB = await fetch(
                `/api/users/me/attempts?since=${encodeURIComponent(since)}`,
              );
              if (resB.ok) {
                const data = (await resB.json()) as { attempts: unknown[] };
                if (data.attempts.length > 0) {
                  dispatch("attempts:catchup", data.attempts);
                }
              }
            } catch {
              /* still offline — next reconnect will retry */
            }
          })();
        }
        offlineSinceRef.current = Date.now();
      },
    );
  }, [session]);

  const fetchToken = useCallback(async (): Promise<TokenResponse | null> => {
    try {
      const res = await fetch("/api/realtime/token");
      if (!res.ok) return null;
      return (await res.json()) as TokenResponse;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!session) {
      // Disconnecting fires the socket's own "disconnect" handler, which is
      // what flips `connected` off — no direct setState needed here.
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    let disposed = false;
    let tokenTimer: ReturnType<typeof setInterval> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      const tokenInfo = await fetchToken();
      if (!tokenInfo || disposed) return;
      tokenRef.current = tokenInfo;
      setUserId(tokenInfo.userId);

      const socket = io(tokenInfo.socketUrl, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        timeout: 5000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);
        offlineSinceRef.current = offlineSinceRef.current || Date.now();
        subscribe();
      });
      socket.on("disconnect", () => {
        setConnected(false);
        offlineSinceRef.current = Date.now();
      });
      socket.on("connect_error", () => setConnected(false));
      socket.io.on("reconnect", () => subscribe());

      const events: RealtimeEvent[] = [
        "assignment:created",
        "assignment:updated",
        "assessment:started",
        "assessment:submitted",
        "competency:updated",
        "presence:user_online",
        "presence:user_offline",
      ];
      for (const ev of events) {
        socket.on(ev, (payload: unknown) => {
          if (ev === "presence:user_online" || ev === "presence:user_offline") {
            const p = payload as { userId?: string };
            if (p?.userId) {
              const online = ev === "presence:user_online";
              setPresence((prev) => {
                const next = new Map(prev);
                next.set(p.userId as string, online);
                return next;
              });
            }
          }
          dispatch(ev, payload);
        });
      }

      // Presence heartbeat every 25s (service broadcasts offline after 60s).
      pingTimer = setInterval(() => {
        if (socket.connected) socket.emit("presence:ping");
      }, 25000);

      // Token rotation — re-fetch + re-subscribe every 8 minutes (TTL 10).
      tokenTimer = setInterval(() => {
        void (async () => {
          const fresh = await fetchToken();
          if (fresh && !disposed) {
            tokenRef.current = fresh;
            subscribe();
          }
        })();
      }, 8 * 60 * 1000);
    })();

    return () => {
      disposed = true;
      if (tokenTimer) clearInterval(tokenTimer);
      if (pingTimer) clearInterval(pingTimer);
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };

     
  }, [sessionEmail, sessionRole]);

  const value = useMemo<RealtimeContextValue>(
    () => ({ connected, userId, presence }),
    [connected, userId, presence],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

/** Subscribe to a single realtime event. The handler may change per render. */
export function useRealtimeEvent(
  event: RealtimeEvent,
  handler: (payload: unknown) => void,
) {
  const stable = useRef(handler);

  useEffect(() => {
    stable.current = handler;
  }, [handler]);

  useEffect(() => {
    return registerHandler(event, (p) => stable.current(p));
  }, [event]);
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    return { connected: false, userId: null, presence: new Map() };
  }
  return ctx;
}
