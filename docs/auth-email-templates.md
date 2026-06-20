# Branded Supabase auth email templates

These replace the plain default Supabase auth emails with on-brand HTML (violet glass, the `idea`
wordmark, a clear CTA button). **They are NOT code** — Supabase stores email templates in the
dashboard, so paste each block by hand:

**Supabase Dashboard → Authentication → Emails → Templates**, pick the template, set the **Subject**,
paste the **Message body (HTML)**, Save. Repeat per template.

Notes / gotchas:
- Email HTML must be **table-based with inline styles** — Gmail/Outlook strip `<style>` blocks and
  don't support flexbox/gradients. That's why these look more verbose than the app.
- The logo is **text** (`idea`), not an `<img>`, so there's nothing to host and no broken-image box.
- Supabase template variables: `{{ .ConfirmationURL }}` is the action link; `{{ .Token }}` is the
  6-digit OTP (not used here); `{{ .SiteURL }}`, `{{ .Email }}` available if needed.
- After pasting, use the dashboard's **Send test email** to preview in a real client.
- Confirm signup + Reset password are the priority (the two users actually hit). Magic Link / Invite
  / Change Email reuse the same shell — swap the heading, paragraph and button label.

---

## 1. Confirm signup

**Subject:** `Confirm your idea account`

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e9f3;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">
                  <span style="display:inline-block;width:24px;height:24px;background:#6d5ef0;border-radius:7px;vertical-align:middle;margin-right:8px;"></span>idea
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">Confirm your email</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 20px 32px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">
                  Welcome to <b style="color:#0f172a;">idea</b> — the cookbook for AI workflows. Confirm your email to start sharing and remixing recipes.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6d5ef0;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:12px;">Confirm email</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <p style="margin:0;font-size:12.5px;line-height:1.6;color:#94a3b8;">
                  If the button doesn't work, paste this link into your browser:<br>
                  <a href="{{ .ConfirmationURL }}" style="color:#6d5ef0;word-break:break-all;">{{ .ConfirmationURL }}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;border-top:1px solid #eef1f6;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                  You're getting this because someone signed up for idea with this address. If it wasn't you, you can safely ignore it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2. Reset password (Recovery)

**Subject:** `Reset your idea password`

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1fa;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e7e9f3;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">
                  <span style="display:inline-block;width:24px;height:24px;background:#6d5ef0;border-radius:7px;vertical-align:middle;margin-right:8px;"></span>idea
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;">Reset your password</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 20px 32px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">
                  We got a request to reset the password for your idea account. Click below to choose a new one. This link expires in 1 hour.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#6d5ef0;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:12px;">Reset password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px 32px;">
                <p style="margin:0;font-size:12.5px;line-height:1.6;color:#94a3b8;">
                  If the button doesn't work, paste this link into your browser:<br>
                  <a href="{{ .ConfirmationURL }}" style="color:#6d5ef0;word-break:break-all;">{{ .ConfirmationURL }}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;border-top:1px solid #eef1f6;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
                  Didn't ask for this? Ignore this email — your password stays the same.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 3. Magic Link

**Subject:** `Your idea sign-in link`

Same shell as above — swap the heading/paragraph/button:

- **Heading:** `Sign in to idea`
- **Paragraph:** `Click below to sign in to your idea account. This link expires in 1 hour and can be used once.`
- **Button label:** `Sign in`
- **Footer:** `Didn't try to sign in? You can safely ignore this email.`

---

## 4. Invite user & 5. Change Email Address

Reuse the same shell:

- **Invite** — Subject `You're invited to idea` · Heading `You've been invited` · Button `Accept invite`.
- **Change Email** — Subject `Confirm your new email` · Heading `Confirm your new email` · Paragraph
  `Confirm this address to make it the new email on your idea account.` · Button `Confirm new email`.
