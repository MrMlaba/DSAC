# Microsoft Graph integration layer

Everything here sits behind the `GraphAdapter` interface in `graph.ts`. This prototype only ships
the mock implementation — there's no real Azure AD app registration to test a live one against —
but the interface is shaped so a real implementation can be dropped in later without touching any
caller (same pattern as the S3/MinIO storage adapter in `src/lib/storage.ts`).

`MICROSOFT_GRAPH_CLIENT_ID` / `_CLIENT_SECRET` / `_TENANT_ID` (see `.env.example`) currently only
flip `isGraphConfigured`, used for UI messaging ("connect Microsoft 365" vs. "synced (mock)"). They
don't activate a real client — see "Swapping in a real implementation" below.

## Required scopes, by capability

| Capability | Graph API | Scope | Permission type |
|---|---|---|---|
| Open/save Office documents in SharePoint/OneDrive | Files | `Files.ReadWrite.All` | Delegated |
| Same, app-only (no signed-in user) | Files | `Sites.ReadWrite.All` | Application |
| Calendar sync for deadlines | Calendar | `Calendars.ReadWrite` | Delegated |
| Entra ID sign-in | — | `openid`, `profile`, `email` | Delegated — already wired up via NextAuth's Microsoft Entra ID provider in `src/lib/auth.ts`, not through this adapter |

Teams notifications in this build (`src/lib/notifications/teams.ts`) use a plain Incoming Webhook
URL (`TEAMS_WEBHOOK_URL`), not the Graph chat/channel message API — that needs a registered Teams
app plus a bot, which is out of scope for a hackathon prototype. A production build would likely
still prefer the webhook for this reason unless Teams messages need to originate from a specific
signed-in identity.

## Swapping in a real implementation

1. Add `@microsoft/microsoft-graph-client` and `@azure/msal-node`.
2. Acquire a token — client-credentials flow for the application-permission scopes above (no
   signed-in user needed for this platform's background jobs), or on-behalf-of if a capability
   should act as the signed-in user instead.
3. Implement `GraphAdapter`'s methods against the real Files/Calendar APIs and swap the `graph`
   export in `graph.ts`. Nothing outside this file needs to change.
