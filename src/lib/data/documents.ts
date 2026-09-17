import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { assertEntityAccess, entityIdScopeWhere, entityScopeWhere, type CurrentUser } from "@/lib/tenant-scope";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  QUARTERLY_DOCUMENT_TYPES,
  canReviewDocuments,
  canUploadDocuments,
} from "@/lib/constants";
import type { DocumentType, Quarter, ReviewStatus } from "@prisma/client";

export interface DocumentFilters {
  entityId?: string;
  type?: DocumentType;
  reviewStatus?: ReviewStatus;
  search?: string;
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-120);
}

async function resolveReportingPeriodId(financialYearId: string, type: DocumentType, quarter?: Quarter) {
  const targetQuarter: Quarter = QUARTERLY_DOCUMENT_TYPES.includes(type) ? (quarter ?? "Q1") : "ANNUAL";
  const period = await prisma.reportingPeriod.findUnique({
    where: { financialYearId_quarter: { financialYearId, quarter: targetQuarter } },
  });
  if (!period) {
    throw new Error(`No ${targetQuarter} reporting period found for this financial year.`);
  }
  return period.id;
}

/** Entities the current user may pick from — one (their own) for entity-scoped roles, all for DSAC-wide roles. */
export async function listEntityOptions(user: CurrentUser) {
  return prisma.entity.findMany({
    where: entityIdScopeWhere(user),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** List documents in scope for the current user, with their latest version. */
export async function listDocuments(user: CurrentUser, filters: DocumentFilters) {
  const tenantWhere = entityScopeWhere(user);
  const entityWhere = tenantWhere.entityId ? tenantWhere : filters.entityId ? { entityId: filters.entityId } : {};

  const documents = await prisma.document.findMany({
    where: {
      ...entityWhere,
      deletedAt: null,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.search
        ? { title: { contains: filters.search, mode: "insensitive" as const } }
        : {}),
      ...(filters.reviewStatus
        ? { versions: { some: { reviewStatus: filters.reviewStatus } } }
        : {}),
    },
    include: {
      entity: { select: { id: true, name: true } },
      reportingPeriod: { select: { quarter: true, financialYear: { select: { label: true } } } },
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { author: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return documents
    .filter((d) => d.versions.length > 0)
    .map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      entityId: d.entity.id,
      entityName: d.entity.name,
      financialYearLabel: d.reportingPeriod?.financialYear.label ?? null,
      quarter: d.reportingPeriod?.quarter ?? null,
      latestVersion: {
        versionNumber: d.versions[0].versionNumber,
        reviewStatus: d.versions[0].reviewStatus,
        authorName: d.versions[0].author.name,
        createdAt: d.versions[0].createdAt,
        fileSize: d.versions[0].fileSize,
        mimeType: d.versions[0].mimeType,
      },
    }));
}

/** Loads a version + its parent document, enforcing tenant access. Used by download/preview routes. */
export async function getVersionWithAccess(user: CurrentUser, versionId: string) {
  const version = await prisma.documentVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { document: true },
  });
  assertEntityAccess(user, version.document.entityId);
  return version;
}

export async function getDocumentDetail(user: CurrentUser, documentId: string) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: {
      entity: { select: { id: true, name: true } },
      reportingPeriod: { select: { quarter: true, financialYear: { select: { label: true } } } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          author: { select: { name: true } },
          reviewedBy: { select: { name: true } },
        },
      },
    },
  });
  assertEntityAccess(user, document.entityId);
  return document;
}

export async function createDocumentVersion(
  user: CurrentUser,
  params: {
    entityId: string;
    documentId?: string;
    type: DocumentType;
    title: string;
    financialYearId: string;
    quarter?: Quarter;
    changeNote?: string;
    file: Buffer;
    filename: string;
    mimeType: string;
  },
) {
  if (!canUploadDocuments(user.role)) {
    throw new Error("Forbidden: this role cannot upload documents.");
  }
  assertEntityAccess(user, params.entityId);

  if (!ALLOWED_UPLOAD_MIME_TYPES[params.mimeType]) {
    throw new Error(`Unsupported file type: ${params.mimeType}`);
  }
  if (params.file.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error(`File exceeds the ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)}MB limit.`);
  }
  if (params.file.byteLength === 0) {
    throw new Error("File is empty.");
  }

  const reportingPeriodId = await resolveReportingPeriodId(params.financialYearId, params.type, params.quarter);

  let document = params.documentId
    ? await prisma.document.findUniqueOrThrow({ where: { id: params.documentId } })
    : await prisma.document.findFirst({
        where: { entityId: params.entityId, type: params.type, reportingPeriodId },
      });

  if (document) {
    assertEntityAccess(user, document.entityId);
  } else {
    document = await prisma.document.create({
      data: { entityId: params.entityId, type: params.type, title: params.title, reportingPeriodId },
    });
  }

  const lastVersion = await prisma.documentVersion.findFirst({
    where: { documentId: document.id },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;
  const checksum = crypto.createHash("sha256").update(params.file).digest("hex");
  const storageKey = `entities/${params.entityId}/documents/${document.id}/v${versionNumber}-${sanitizeFilename(params.filename)}`;

  await storage.upload(storageKey, params.file, params.mimeType);

  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber,
      storageKey,
      checksum,
      fileSize: params.file.byteLength,
      mimeType: params.mimeType,
      authorId: user.id,
      changeNote: params.changeNote,
      // Auto-acknowledgement: the platform confirms receipt the moment the
      // file lands in storage and the DB record commits — no separate
      // "submitted but not yet received" window in this synchronous flow.
      reviewStatus: "RECEIVED",
    },
  });

  return { document, version };
}

export async function reviewDocumentVersion(
  user: CurrentUser,
  versionId: string,
  action: "start_review" | "approve" | "return",
  comment?: string,
) {
  if (!canReviewDocuments(user.role)) {
    throw new Error("Forbidden: this role cannot review documents.");
  }
  if (action === "return" && !comment?.trim()) {
    throw new Error("A reason is required to return a document.");
  }

  const version = await prisma.documentVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { document: true },
  });

  const nextStatus: ReviewStatus = action === "start_review" ? "UNDER_REVIEW" : action === "approve" ? "APPROVED" : "RETURNED";

  return prisma.documentVersion.update({
    where: { id: versionId },
    data: {
      reviewStatus: nextStatus,
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewComment: action === "return" ? comment : (version.reviewComment ?? undefined),
    },
  });
}

/** Restores an older version by re-submitting its exact content as a new, latest version. */
export async function restoreDocumentVersion(user: CurrentUser, versionId: string) {
  const source = await prisma.documentVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { document: true },
  });
  if (!canUploadDocuments(user.role)) {
    throw new Error("Forbidden: this role cannot restore document versions.");
  }
  assertEntityAccess(user, source.document.entityId);

  const lastVersion = await prisma.documentVersion.findFirstOrThrow({
    where: { documentId: source.documentId },
    orderBy: { versionNumber: "desc" },
  });

  return prisma.documentVersion.create({
    data: {
      documentId: source.documentId,
      versionNumber: lastVersion.versionNumber + 1,
      storageKey: source.storageKey,
      checksum: source.checksum,
      fileSize: source.fileSize,
      mimeType: source.mimeType,
      authorId: user.id,
      changeNote: `Restored from version ${source.versionNumber}.`,
      reviewStatus: "RECEIVED",
    },
  });
}
