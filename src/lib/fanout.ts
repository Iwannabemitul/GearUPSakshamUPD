/**
 * Fanout bridge — API routes call `fanout()` after a successful DB write so
 * the realtime service (mini-services/realtime-service, port 3004) pushes
 * the event to every subscribed socket.
 *
 * Fire-and-forget: if the realtime service is down the API response is
 * unaffected (clients catch up via REST `?since=` on reconnect).
 */

export type FanoutChannels = string[]; // "user:<id>", "role:<x>", "dept:<y>"

export type FanoutEvent =
  | "assignment:created"
  | "assignment:updated"
  | "assessment:started"
  | "assessment:submitted"
  | "competency:updated";

export async function fanout(
  event: FanoutEvent,
  payload: unknown,
  channels: FanoutChannels,
): Promise<void> {
  const url = process.env.REALTIME_SERVICE_URL ?? "http://localhost:3004";
  const secret = process.env.FANOUT_SECRET;
  if (!secret) return; // realtime fanout not configured — skip silently
  try {
    await fetch(`${url}/fanout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-fanout-secret": secret,
      },
      body: JSON.stringify({ event, payload, channels }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Realtime service unreachable — REST catch-up covers the gap.
  }
}
