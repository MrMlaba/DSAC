import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { APP_NAME, DEMO_BANNER, ROLE_LABELS } from "@/lib/constants";
import { DEMO_PASSWORD, DEMO_USERS } from "@/lib/seed-data/demo-users";
import { ENTITY_SEEDS } from "@/lib/seed-data/entities";
import { isMicrosoftEntraConfigured, signIn } from "@/lib/auth";
import { credentialsSignIn } from "./actions";
import { AlertCircleIcon, LandmarkIcon, ShieldCheckIcon } from "lucide-react";

function entityNameForSlug(slug?: string) {
  if (!slug) return null;
  return ENTITY_SEEDS.find((e) => e.slug === slug)?.name ?? null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <LandmarkIcon className="size-6" />
          {APP_NAME}
        </div>
        <div className="space-y-4">
          <Badge variant="secondary" className="text-xs font-medium tracking-wide uppercase">
            {DEMO_BANNER}
          </Badge>
          <blockquote className="max-w-md text-2xl leading-snug font-medium text-balance">
            One dashboard for 26 public entities and 6 NPOs — targets, funding
            and risk, tracked before deadlines are missed.
          </blockquote>
          <p className="max-w-md text-sm text-primary-foreground/80">
            Built for the GovTech Hackathon 2026 — Department of Sport, Arts
            and Culture: Public Entities Reporting System challenge.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          © 2026 · Prototype for evaluation purposes only.
        </p>
      </div>

      <div className="flex flex-col justify-center gap-8 px-6 py-10 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="space-y-1 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground text-sm">
              Use the demo password <code className="rounded bg-muted px-1 py-0.5">{DEMO_PASSWORD}</code>, or pick a
              one-click demo account below.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Sign in failed</AlertTitle>
              <AlertDescription>Invalid email or password. Please try again.</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sign in with email</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={credentialsSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="you@dsac.demo.gov.za" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </form>

              {isMicrosoftEntraConfigured && (
                <form
                  action={async () => {
                    "use server";
                    await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
                  }}
                  className="mt-3"
                >
                  <Button type="submit" variant="outline" className="w-full gap-2">
                    <ShieldCheckIcon className="size-4" />
                    Sign in with Microsoft
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <p className="text-muted-foreground text-center text-xs font-medium tracking-wide uppercase lg:text-left">
              One-click demo accounts
            </p>
            <div className="grid gap-2">
              {DEMO_USERS.map((demoUser) => {
                const entityName = entityNameForSlug(demoUser.entitySlug);
                return (
                  <form key={demoUser.email} action={credentialsSignIn}>
                    <input type="hidden" name="email" value={demoUser.email} />
                    <input type="hidden" name="password" value={DEMO_PASSWORD} />
                    <button
                      type="submit"
                      className="hover:bg-accent hover:text-accent-foreground group flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors"
                    >
                      <span>
                        <span className="block font-medium">{demoUser.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          {ROLE_LABELS[demoUser.role]}
                          {entityName ? ` · ${entityName}` : ""}
                        </span>
                      </span>
                      <span className="text-muted-foreground group-hover:text-foreground text-xs">Sign in →</span>
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
