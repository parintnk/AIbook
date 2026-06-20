import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc } from "@/components/legal/legal-doc";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service — idea",
  description: `The terms for using ${SITE_NAME}.`,
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated="June 20, 2026">
      <p>
        By using {SITE_NAME} you agree to these terms. If you don't agree,
        please don't use the service.
      </p>

      <h2>Your account</h2>
      <p>
        You're responsible for your account and for keeping your login secure.
        Provide accurate information and don't impersonate others.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don't post unlawful, harmful, hateful or infringing content.</li>
        <li>
          {SITE_NAME} shares workflow <em>recipes</em> — instructions and sample
          outputs — not an execution engine. Don't use it to distribute malware
          or to facilitate abuse.
        </li>
        <li>Don't scrape, overload, or attempt to break the service.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        You own the workflows and other content you create. By publishing, you
        grant {SITE_NAME} a non-exclusive license to host and display it, and
        you allow others to view and fork published recipes — forking and
        remixing is the point. You can unpublish or delete your content at any
        time; forks others already made may persist independently.
      </p>

      <h2>No warranty</h2>
      <p>
        The service and the shared recipes are provided "as is", without
        warranties. AI workflows can produce inaccurate results — verify before
        relying on them. To the extent permitted by law, {SITE_NAME} isn't
        liable for damages arising from use of the service.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account any time from{" "}
        <Link href="/settings/danger">Settings → Danger zone</Link>. We may
        suspend accounts that violate these terms.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms; material changes will be reflected by the
        "last updated" date above.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? <a href="mailto:hello@idea.app">hello@idea.app</a>.
      </p>
    </LegalDoc>
  );
}
