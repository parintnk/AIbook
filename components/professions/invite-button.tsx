"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Invite control (Story 6.2). The mockup's "Invite" — implemented as copy-the-page-link
 * (no invite/sharing backend in v1). Honest + useful: copies `/communities/{slug}` to the
 * clipboard so the member can share it.
 */
export function InviteButton({ slug }: { slug: string }) {
  function copy() {
    const url = `${window.location.origin}/communities/${slug}`;
    if (!navigator.clipboard) {
      toast.error("Couldn't copy the link.");
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => toast("Link copied — share it to invite."),
      () => toast.error("Couldn't copy the link."),
    );
  }

  return (
    <Button type="button" variant="outline" onClick={copy} className="shrink-0">
      <Share2 className="size-4" aria-hidden />
      Invite
    </Button>
  );
}
