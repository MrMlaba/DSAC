import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { JWT } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";

const hasEntraConfig =
  !!process.env.MICROSOFT_ENTRA_ID_CLIENT_ID &&
  !!process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET &&
  !!process.env.MICROSOFT_ENTRA_ID_TENANT_ID;

const providers: NextAuthConfig["providers"] = [
  Credentials({
    id: "credentials",
    name: "Demo login",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email : undefined;
      const password = typeof credentials?.password === "string" ? credentials.password : undefined;
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.hashedPassword) return null;

      const valid = await bcrypt.compare(password, user.hashedPassword);
      if (!valid) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        entityId: user.entityId,
      };
    },
  }),
];

// Microsoft Entra ID is only offered when fully configured. Users must
// already exist (provisioned by a DSAC Admin) — this prototype does not
// auto-create accounts from SSO, matching least-privilege practice.
if (hasEntraConfig) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_ENTRA_ID_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_ENTRA_ID_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.MICROSOFT_ENTRA_ID_TENANT_ID}/v2.0`,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "microsoft-entra-id") {
        const existing = await prisma.user.findUnique({ where: { email: user.email ?? "" } });
        if (!existing) return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.entityId = user.entityId;
        return token;
      }
      if (token.email && !token.role) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.entityId = dbUser.entityId;
        }
      }
      return token;
    },
    async session({ session, token }: { session: import("next-auth").Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "EXECUTIVE_VIEWER";
        session.user.entityId = token.entityId ?? null;
      }
      return session;
    },
  },
});

export const isMicrosoftEntraConfigured = hasEntraConfig;
