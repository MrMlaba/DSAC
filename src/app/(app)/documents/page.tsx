import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/current-user";
import { listDocuments, listEntityOptions } from "@/lib/data/documents";
import { listFinancialYears, getDefaultFinancialYear } from "@/lib/data/financial-years";
import { listEvidenceTargets } from "@/lib/data/evidence";
import { isDsacWideRole, canUploadDocuments, DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { ReviewStatusBadge } from "@/components/review-status-badge";
import { DocumentFilters } from "@/components/document-filters";
import { UploadDocumentDialog } from "@/components/upload-document-dialog";
import type { DocumentType, ReviewStatus } from "@prisma/client";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const dsacWide = isDsacWideRole(user.role);
  const resolved = await searchParams;

  const type = typeof resolved.type === "string" ? (resolved.type as DocumentType) : undefined;
  const reviewStatus = typeof resolved.status === "string" ? (resolved.status as ReviewStatus) : undefined;
  const search = typeof resolved.q === "string" ? resolved.q : undefined;
  const entityId = dsacWide && typeof resolved.entity === "string" ? resolved.entity : undefined;

  const targets = !dsacWide && user.entityId ? await listEvidenceTargets(user, user.entityId) : undefined;
  const initialLink = typeof resolved.link === "string" && /^(report|kpi|line):[w-]+$/.test(resolved.link) ? resolved.link : undefined;

  const [documents, entities, financialYears, defaultFy] = await Promise.all([
    listDocuments(user, { type, reviewStatus, search, entityId }),
    listEntityOptions(user),
    listFinancialYears(),
    getDefaultFinancialYear(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-muted-foreground text-sm">
            Supporting evidence and formal documents — versioned, linked to the KPI, budget line or report they support, with a DSAC review workflow.
          </p>
        </div>
        {canUploadDocuments(user.role) && (
          <UploadDocumentDialog
            entities={entities}
            financialYears={financialYears.map((y) => ({ id: y.id, label: y.label }))}
            defaultFinancialYearId={defaultFy?.id ?? financialYears.at(-1)?.id ?? ""}
            targets={targets}
            initialLink={initialLink}
          />
        )}
      </div>

      <DocumentFilters entities={dsacWide ? entities : undefined} />

      {documents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <FileTextIcon className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">No documents match the current filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Link key={doc.id} href={`/documents/${doc.id}`} className="block">
              <Card className="hover:border-primary/40 h-full transition-colors">
                <CardContent className="space-y-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-snug font-medium">{doc.title}</p>
                    <ReviewStatusBadge status={doc.latestVersion.reviewStatus} className="shrink-0" />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {DOCUMENT_TYPE_LABELS[doc.type]}
                    {doc.quarter && doc.quarter !== "ANNUAL" ? ` · ${doc.quarter}` : ""}
                    {doc.financialYearLabel ? ` · FY ${doc.financialYearLabel}` : ""}
                  </p>
                  {dsacWide && <p className="text-muted-foreground text-xs">{doc.entityName}</p>}
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>v{doc.latestVersion.versionNumber} · {doc.latestVersion.authorName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(doc.latestVersion.createdAt).toLocaleDateString("en-ZA")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
