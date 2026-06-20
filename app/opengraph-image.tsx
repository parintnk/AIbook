import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// The default social card for EVERY route (root segment) — branded violet glass. Deeper
// segments can override with their own opengraph-image; until then a shared link renders this
// instead of a bare URL. Pure inline styles (next/og supports a flexbox CSS subset, no modules).
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "84px",
        background:
          "linear-gradient(135deg, #1b1430 0%, #2a2150 55%, #6D5EF0 160%)",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
        <div
          style={{
            width: "76px",
            height: "76px",
            borderRadius: "22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #7C6BFF, #6D5EF0)",
            boxShadow: "0 16px 40px rgba(109,94,240,0.6)",
          }}
        >
          <svg
            width="42"
            height="42"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="12" r="3" />
            <path d="M9 6h3a3 3 0 0 1 3 3M9 18h3a3 3 0 0 0 3-3" />
          </svg>
        </div>
        <div
          style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-1px" }}
        >
          {SITE_NAME}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            fontSize: "76px",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-2px",
            maxWidth: "920px",
          }}
        >
          A cookbook for AI workflows
        </div>
        <div
          style={{
            fontSize: "32px",
            color: "rgba(255,255,255,0.78)",
            maxWidth: "880px",
            lineHeight: 1.35,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>
    </div>,
    size,
  );
}
