/**
 * Realtime service smoke test:
 *  1. mint a HMAC token the same way /api/realtime/token does
 *  2. connect a socket.io client, subscribe
 *  3. POST /fanout
 *  4. expect the event to arrive on the subscribed channel
 *
 * Run: bun scripts/test-realtime.ts
 */

import { createHmac } from "node:crypto";
import { io } from "socket.io-client";

const FANOUT_SECRET = process.env.FANOUT_SECRET ?? "";
if (!FANOUT_SECRET) {
  console.error("FANOUT_SECRET missing");
  process.exit(1);
}

const uid = "test-user-1";
const payload = { uid, role: "employee", dept: "Department of Statistics", exp: Math.floor(Date.now() / 1000) + 300 };
const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
const sig = createHmac("sha256", FANOUT_SECRET).update(body).digest("hex");
const token = `${body}.${sig}`;

const socket = io("http://localhost:3004", { transports: ["websocket", "polling"] });

const timeout = setTimeout(() => {
  console.error("FAIL: event not received within 5s");
  process.exit(1);
}, 5000);

socket.on("connect", () => {
  console.log("connected:", socket.id);
  socket.emit("subscribe", { token, channels: [`user:${uid}`, "dept:Department of Statistics"], name: "Test" }, (res: { ok: boolean; channels?: string[]; error?: string }) => {
    console.log("subscribe ack:", JSON.stringify(res));
    if (!res.ok) process.exit(1);
    socket.on("assignment:created", (p: unknown) => {
      console.log("RECEIVED assignment:created:", JSON.stringify(p));
      clearTimeout(timeout);
      console.log("PASS");
      process.exit(0);
    });
    fetch("http://localhost:3004/fanout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-fanout-secret": FANOUT_SECRET },
      body: JSON.stringify({ event: "assignment:created", payload: { hello: "world" }, channels: [`user:${uid}`] }),
    }).then((r) => console.log("fanout status:", r.status));
  });
});

socket.on("connect_error", (e) => {
  console.error("connect_error:", e.message);
  process.exit(1);
});
