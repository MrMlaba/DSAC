"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { getRequestIp } from "@/lib/request-ip";
import { checkRateLimit } from "@/lib/rate-limit";

// Generous enough to never bother a presenter clicking through one-click
// demo accounts, but bounds brute-force/credential-stuffing against login.
const LOGIN_LIMIT = 20;
const LOGIN_WINDOW_SECONDS = 60;

export async function credentialsSignIn(formData: FormData): Promise<void> {
  const ip = (await getRequestIp()) ?? "unknown";
  const { allowed } = checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS);
  if (!allowed) {
    redirect("/login?error=rate_limited");
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}
