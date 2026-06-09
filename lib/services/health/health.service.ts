/**
 * Reference service — proves the `lib/services/*` convention (AR2 / DR-1).
 * Framework-agnostic: no `next/*`, no request/response handling.
 */

export type HealthStatus = {
  ok: true;
  service: string;
};

export function getHealth(): HealthStatus {
  return { ok: true, service: "idea" };
}
