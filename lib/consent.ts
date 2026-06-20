/**
 * Cookie/analytics consent (client-only). PostHog stays OFF until the visitor explicitly accepts —
 * `setConsent` persists the choice and fires a window event so the analytics provider can init/teardown
 * without a reload. ponytail: localStorage + a CustomEvent is plenty; no consent-management SDK.
 */
export const CONSENT_KEY = "idea-cookie-consent";
export const CONSENT_EVENT = "idea-consent-change";
export type Consent = "accepted" | "declined";

export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(CONSENT_KEY);
  return v === "accepted" || v === "declined" ? v : null;
}

export function setConsent(value: Consent): void {
  window.localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}
