import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  // Behind Coolify's reverse proxy the Host header is the public domain. Trust it
  // here (shared by proxy.ts middleware AND auth.ts) so Auth.js doesn't reject
  // requests with UntrustedHost.
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
