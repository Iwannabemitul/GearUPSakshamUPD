"use client";

/**
 * Socket connection helpers.
 *
 * The original deployment reached the mini-services through a Caddy gateway
 * on the same origin (`/?XTransformPort=<port>`). Local/dev environments run
 * without Caddy, so clients connect DIRECTLY to the service ports by
 * default; set NEXT_PUBLIC_AI_URL / NEXT_PUBLIC_REALTIME_URL to restore the
 * gateway behaviour in production.
 */

export function aiSocketUrl(): string {
  return process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:3003";
}

export function realtimeSocketUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3004";
}
