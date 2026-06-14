import { z } from "zod";

// Empty string (field left blank) or a valid http(s) URL. Callers convert "" to
// null before the DB write (those columns are nullable). The scheme is restricted
// so `javascript:`/`data:` URLs can't be stored and later rendered into a public
// <a href>/<img src> (stored-XSS guard). Shared by the profile (1.4) and the
// workflow-node (2.2) schemas — one source of truth for the URL guard.
export const urlOrEmpty = z.union([
  z.literal(""),
  z
    .url("Enter a valid URL")
    .refine(
      (u) => /^https?:\/\//i.test(u),
      "URL must start with http:// or https://",
    ),
]);
