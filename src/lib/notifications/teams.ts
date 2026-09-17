/**
 * Microsoft Teams incoming webhook — genuinely optional (unlike email/MinIO,
 * there's no local stand-in for Teams), so this no-ops with a console log
 * when unconfigured, per the brief's "never break the demo" rule.
 */
export async function sendTeamsMessage(text: string) {
  const url = process.env.TEAMS_WEBHOOK_URL;
  if (!url) {
    console.log(`[teams:mock] ${text}`);
    return;
  }
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.error("[teams] Failed to post message:", error instanceof Error ? error.message : error);
  }
}
