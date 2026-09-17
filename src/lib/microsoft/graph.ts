/**
 * Microsoft Graph integration layer — behind this interface so a real
 * implementation (Files/Calendar APIs) can be dropped in without touching
 * any caller, same pattern as src/lib/storage.ts. Always mocked in this
 * prototype: there's no real Azure AD app registration to test against,
 * and per the brief, integrations without local infra fall back to a
 * deterministic mock rather than being left unbuilt. See README.md in this
 * folder for the scopes a real implementation would need.
 */
export interface GraphAdapter {
  getFileWebUrl(params: { entityName: string; documentTitle: string }): Promise<string>;
  syncDeadlineToCalendar(params: {
    userEmail: string;
    title: string;
    dueDate: Date;
    description?: string;
  }): Promise<{ synced: boolean; eventUrl?: string }>;
}

class MockGraphAdapter implements GraphAdapter {
  async getFileWebUrl({ entityName, documentTitle }: { entityName: string; documentTitle: string }) {
    return `https://mock-tenant.sharepoint.com/sites/${encodeURIComponent(entityName)}/Shared%20Documents/${encodeURIComponent(documentTitle)}`;
  }

  async syncDeadlineToCalendar({ userEmail, title }: { userEmail: string; title: string; dueDate: Date; description?: string }) {
    console.log(`[graph:mock] Would sync calendar event "${title}" for ${userEmail} (Microsoft Graph not configured).`);
    return { synced: false };
  }
}

export const isGraphConfigured = Boolean(
  process.env.MICROSOFT_GRAPH_CLIENT_ID && process.env.MICROSOFT_GRAPH_CLIENT_SECRET && process.env.MICROSOFT_GRAPH_TENANT_ID,
);

export const graph: GraphAdapter = new MockGraphAdapter();
