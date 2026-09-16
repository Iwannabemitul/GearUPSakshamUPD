/**
 * Saksham realtime service — socket.io on port 3004.
 *
 * Channel model (rooms named exactly like channels):
 *   user:<userId>     — events for one person
 *   role:trainer      — every subscribed trainer
 *   role:admin        — every subscribed admin
 *   role:employee     — every subscribed employee
 *   dept:<department> — everyone in one department
 *
 * Auth: the Next app mints a short-lived HMAC token at /api/realtime/token
 * (signed with FANOUT_SECRET). The client sends it with `subscribe`; this
 * service verifies signature + expiry and only allows channels that match
 * the token's identity.
 *
 * Fanout: the Next API routes POST to /fanout (x-fanout-secret) after DB
 * writes; this service emits the event to the requested channels.
 *
 * Presence: clients emit presence:ping every 25s. A user whose sockets have
 * all gone silent for 60s is broadcast offline.
 *
 * Run: bun run dev:realtime   (from the project root; port 3004)
 */

import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Server, type Socket } from "socket.io";

const PORT = Number(process.env.REALTIME_PORT ?? 3004);
const FANOUT_SECRET = process.env.FANOUT_SECRET ?? "";
const PING_INTERVAL_MS = 25_000;
const OFFLINE_AFTER_MS = 60_000;

type TokenPayload = {
  uid: string;
  role: string;
  dept: string;
  exp: number;
};

function verifyToken(token: string): TokenPayload | null {
  if (!FANOUT_SECRET) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", FANOUT_SECRET).update(body).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (!payload.uid || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Channels the identity may join. */
function allowedChannels(p: TokenPayload): string[] {
  const channels = [`user:${p.uid}`, `role:${p.role}`];
  if (p.dept) channels.push(`dept:${p.dept}`);
  return channels;
}

const httpServer = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/fanout") {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!FANOUT_SECRET || req.headers["x-fanout-secret"] !== FANOUT_SECRET) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "bad fanout secret" }));
        return;
      }
      try {
        const { event, payload, channels } = JSON.parse(raw) as {
          event: string;
          payload: unknown;
          channels: string[];
        };
        if (!event || !Array.isArray(channels)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "event and channels required" }));
          return;
        }
        for (const ch of channels) {
          io.to(ch).emit(event, payload);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, channels, event }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "invalid JSON" }));
      }
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
  pingInterval: PING_INTERVAL_MS,
  pingTimeout: OFFLINE_AFTER_MS,
});

/** userId → presence record (sockets + lastSeen). */
const presence = new Map<string, { sockets: Set<string>; lastSeen: number; dept: string; name: string }>();

function broadcastPresence(userId: string, online: boolean) {
  const rec = presence.get(userId);
  const event = online ? "presence:user_online" : "presence:user_offline";
  const payload = { userId, dept: rec?.dept ?? "", name: rec?.name ?? "" };
  const channels = [`role:trainer`, `role:admin`];
  if (rec?.dept) channels.push(`dept:${rec.dept}`);
  for (const ch of channels) io.to(ch).emit(event, payload);
}

io.on("connection", (socket: Socket) => {
  let identity: TokenPayload | null = null;
  let joinedChannels: string[] = [];

  socket.on("subscribe", (data: unknown, ack?: (res: unknown) => void) => {
    const { token, channels, name } = (data ?? {}) as {
      token?: string;
      channels?: string[];
      name?: string;
    };
    if (!token) {
      ack?.({ ok: false, error: "token required" });
      return;
    }
    const payload = verifyToken(token);
    if (!payload) {
      ack?.({ ok: false, error: "invalid or expired token" });
      return;
    }

    // Refresh identity (re-subscribe after token rotation keeps the socket).
    for (const ch of joinedChannels) socket.leave(ch);
    identity = payload;
    const allowed = new Set(allowedChannels(payload));
    joinedChannels = (channels ?? allowedChannels(payload)).filter((ch) =>
      allowed.has(ch),
    );
    for (const ch of joinedChannels) socket.join(ch);

    // Presence bookkeeping.
    const existing = presence.get(payload.uid);
    if (!existing || existing.sockets.size === 0) {
      presence.set(payload.uid, {
        sockets: new Set([socket.id]),
        lastSeen: Date.now(),
        dept: payload.dept,
        name: name ?? "",
      });
      broadcastPresence(payload.uid, true);
    } else {
      existing.sockets.add(socket.id);
      existing.lastSeen = Date.now();
    }

    ack?.({ ok: true, channels: joinedChannels });
  });

  socket.on("presence:ping", () => {
    if (!identity) return;
    const rec = presence.get(identity.uid);
    if (rec) rec.lastSeen = Date.now();
  });

  socket.on("disconnect", () => {
    if (!identity) return;
    const rec = presence.get(identity.uid);
    if (!rec) return;
    rec.sockets.delete(socket.id);
    if (rec.sockets.size === 0) {
      // Give a small grace period for reconnects before broadcasting offline.
      const uid = identity.uid;
      setTimeout(() => {
        const current = presence.get(uid);
        if (current && current.sockets.size === 0) {
          broadcastPresence(uid, false);
          presence.delete(uid);
        }
      }, 3000);
    }
  });
});

// Offline sweeper: drop users silent for > 60s (belt to socket.io's braces).
setInterval(() => {
  const now = Date.now();
  for (const [uid, rec] of presence) {
    if (rec.sockets.size > 0 && now - rec.lastSeen > OFFLINE_AFTER_MS) {
      broadcastPresence(uid, false);
      presence.delete(uid);
      for (const sid of rec.sockets) {
        io.in(sid).disconnectSockets(true);
      }
    }
  }
}, 15_000);

httpServer.listen(PORT, () => {
  console.log(`[realtime-service] listening on :${PORT}`);
  console.log(
    `[realtime-service] FANOUT_SECRET ${FANOUT_SECRET ? "configured" : "MISSING — fanout disabled"}`,
  );
});
