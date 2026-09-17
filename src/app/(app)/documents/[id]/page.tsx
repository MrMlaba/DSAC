import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireUser } from "@/lib/current-user";
import { getDocumentDetail } from "@/lib/data/documents";
import { canReviewDocuments, canUploadDocuments, DOCUMENT_TYPE_LABELS, isDsacWideRole } from "@/lib/constants";
import { ReviewStatusBadge } from "@/components/review-status-badge";
import { DocumentReviewActions } from "@/components/document-review-actions";
import { DocumentVersionActions } from "@/components/document-version-actions";
import { DocumentAiAssist } from "@/components/document-ai-assist";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let document;
  try {
    document = await getDocumentDetail(user, id);
  } catch {
    notFound();
  }

  const dsacWide = isDsacWideRole(user.role);
  const latest = document.versions[0];

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{document.title}</h1>
          <ReviewStatusBadge status={latest.reviewStatus} />
        </div>
        <p className="text-muted-foreground text-sm">
          {DOCUMENT_TYPE_LABELS[document.type]}
          {document.reportingPeriod && document.reportingPeriod.quarter !== "ANNUAL" ? ` · ${document.reportingPeriod.quarter}` : ""}
          {document.reportingPeriod ? ` · FY ${document.reportingPeriod.financialYear.label}` : ""}
          {dsacWide ? ` · ${document.entity.name}` : ""}
        </p>
      </div>

      {latest.reviewComment && latest.reviewStatus === "RETURNED" && (
        <Card className="border-[var(--status-serious)]/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Returned by {latest.reviewedBy?.name}</CardTitle>
            <CardDescription>{latest.reviewComment}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {canReviewDocuments(user.role) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Review — version {latest.versionNumber}</CardTitle>
            <CardDescription>Actions apply to the latest version only.</CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentReviewActions versionId={latest.id} status={latest.reviewStatus} />
          </CardContent>
        </Card>
      )}

      {canReviewDocuments(user.role) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI assist</CardTitle>
            <CardDescription>Extracts key figures and checks them against recorded KPI actuals for this period.</CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentAiAssist versionId={latest.id} existingSummary={latest.aiSummary} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version history</CardTitle>
          <CardDescription>Every save or upload creates a new, immutable version.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Change note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {document.versions.map((v, i) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium tabular-nums">v{v.versionNumber}</TableCell>
                  <TableCell>
                    <ReviewStatusBadge status={v.reviewStatus} />
                  </TableCell>
                  <TableCell>{v.author.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(v.createdAt).toLocaleString("en-ZA")}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatBytes(v.fileSize)}</TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate text-xs">{v.changeNote ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <DocumentVersionActions
                      versionId={v.id}
                      mimeType={v.mimeType}
                      isLatest={i === 0}
                      canRestore={canUploadDocuments(user.role)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Badge variant="outline" className="text-[10px]">
        Checksum (SHA-256) of the latest version: {latest.checksum.slice(0, 16)}…
      </Badge>
    </div>
  );
}
