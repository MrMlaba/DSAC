import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryBars } from "@/components/category-bars";
import { JobCreationChart } from "@/components/job-creation-chart";
import { AuditHistory } from "@/components/audit-history";
import { ENTITY_TYPE_LABELS, SECTOR_LABELS, GENDER_LABELS, RACE_LABELS, AGE_BAND_LABELS, DISABILITY_LABELS } from "@/lib/constants";
import { getEntityProfileData } from "@/lib/data/entity-profile";
import type { CurrentUser } from "@/lib/tenant-scope";
import type { EntityContext } from "@/lib/data/entity-view";

const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Details({ items }: { items: [string, string | number | null | undefined][] }) {
  return (
    <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The Profile tab: organisational information, plus audit history and (aggregated, POPIA-safe) workforce data. */
export async function ProfileView({ ctx, user }: { ctx: EntityContext; user: CurrentUser }) {
  const { entity, selectedFinancialYear } = ctx;
  const { auditHistory, jobCreationByYear, workforceStats } = await getEntityProfileData(user, entity.id, selectedFinancialYear.id);

  const totals = (pick: (w: (typeof workforceStats)[number]) => string) => {
    const map = new Map<string, number>();
    for (const w of workforceStats) map.set(pick(w), (map.get(pick(w)) ?? 0) + w.headcount);
    return map;
  };
  const toBars = (map: Map<string, number>, labels: Record<string, string>) => [...map.entries()].map(([key, value], i) => ({ label: labels[key] ?? key, value, color: palette[i % palette.length] }));
  const totalHeadcount = workforceStats.reduce((sum, w) => sum + w.headcount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Details
              items={[
                ["Name", entity.name],
                ["Type", ENTITY_TYPE_LABELS[entity.type]],
                ["Sector", SECTOR_LABELS[entity.sector]],
                ["Registration no.", entity.registrationNumber],
                ["Established", entity.establishedYear],
                ["Province", entity.province],
                ["Physical address", entity.physicalAddress],
              ]}
            />
            {entity.mandate && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">Mandate</p>
                <p className="text-sm">{entity.mandate}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact &amp; governance</CardTitle>
            <CardDescription>Synthetic demonstration details.</CardDescription>
          </CardHeader>
          <CardContent>
            <Details
              items={[
                ["Contact person", entity.contactPerson],
                ["Email", entity.contactEmail],
                ["Telephone", entity.contactPhone],
                ["Website", entity.website],
                ["Accounting authority", entity.accountingAuthority],
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit findings &amp; opinion history</CardTitle>
          <CardDescription>Across all financial years on record.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuditHistory auditHistory={auditHistory} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jobs created</CardTitle>
            <CardDescription>Permanent, temporary and youth jobs, by financial year.</CardDescription>
          </CardHeader>
          <CardContent>
            <JobCreationChart jobCreationByYear={jobCreationByYear} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff demographics</CardTitle>
            <CardDescription>Aggregated headcount only, FY {selectedFinancialYear.label} — {totalHeadcount} staff. No individual employee records are stored, per POPIA data-minimisation.</CardDescription>
          </CardHeader>
          <CardContent>
            {totalHeadcount === 0 ? (
              <p className="text-muted-foreground text-sm">No workforce data recorded for this financial year.</p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {(
                  [
                    ["Gender", toBars(totals((w) => w.gender), GENDER_LABELS)],
                    ["Race", toBars(totals((w) => w.raceCategory), RACE_LABELS)],
                    ["Age band", toBars(totals((w) => w.ageBand), AGE_BAND_LABELS)],
                    ["Disability status", toBars(totals((w) => w.disabilityStatus), DISABILITY_LABELS)],
                  ] as const
                ).map(([title, items]) => (
                  <div key={title}>
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{title}</p>
                    <CategoryBars items={items} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
