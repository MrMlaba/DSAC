import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no Prisma, no Node-only providers). Used by
 * middleware.ts for route protection. The full config in auth.ts extends
 * this with the Credentials/Entra ID providers and DB-backed callbacks,
 * and only ever runs in a Node.js runtime (route handlers, server
 * components) since Prisma's query engine is not Edge-compatible.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
