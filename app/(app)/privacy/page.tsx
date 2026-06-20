import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/legal/legal-doc";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy — idea",
  description: `How ${SITE_NAME} collects, uses, and protects your data.`,
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated="June 20, 2026">
      <p>
        This policy explains what {SITE_NAME} collects, why, and the choices you
        have. {SITE_NAME} is a place to share and remix multi-tool AI workflows.
        We keep data collection to what the product needs.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account.</strong> Your email and authentication data, handled
          by our auth provider (Supabase), plus the profile you create — handle,
          display name, bio, profession, AI stack and avatar.
        </li>
        <li>
          <strong>Content you create.</strong> Workflows, comments, votes,
          boards and follows. Anything you publish is public by design.
        </li>
        <li>
          <strong>Usage analytics.</strong> Only if you accept cookies, we use a
          privacy-friendly analytics tool (PostHog) to understand how the
          cookbook is used. Decline and no analytics cookie is set.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Essential cookies keep you signed in. The optional analytics cookie runs
        only after you accept it in the banner; you can decline with no loss of
        functionality.
      </p>

      <h2>How we use your data</h2>
      <ul>
        <li>To run your account and show your published content to others.</li>
        <li>To operate, secure and improve the service.</li>
        <li>To understand aggregate usage (only with your consent).</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We do not sell your data. We rely on infrastructure providers that
        process data on our behalf — Supabase (database, auth, storage), Vercel
        (hosting) and PostHog (analytics, consent-gated). Each only processes
        what their service requires.
      </p>

      <h2>Your rights</h2>
      <p>
        You can edit your profile any time, and you can permanently delete your
        account — and all the content tied to it — from{" "}
        <Link href="/settings/danger">Settings → Danger zone</Link>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your data? Reach us at{" "}
        <a href="mailto:hello@idea.app">hello@idea.app</a>.
      </p>
    </LegalDoc>
  );
}
