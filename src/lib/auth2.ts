import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { jwt } from "better-auth/plugins";
import { MongoClient } from "mongodb";

/* ---------- env (fail fast if something is missing) ---------- */
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";
const CLIENT_URL = env("CLIENT_URL"); // e.g. http://localhost:3000
const SERVER_URL = env("BETTER_AUTH_URL"); // e.g. http://localhost:5000

const client = new MongoClient(env("MONGODB_URI"));
const db = client.db("wedding-planning-platform");

/** Roles a person may pick at public sign-up. "admin" is deliberately NOT here. */
const PUBLIC_ROLES = ["customer", "vendor"] as const;

export const auth2 = betterAuth({
  baseURL: SERVER_URL,
  secret: env("BETTER_AUTH_SECRET"),
  trustedOrigins: [CLIENT_URL],

  database: mongodbAdapter(db, { client }),

  user: {
    additionalFields: {
      // Chosen at sign-up (customer | vendor). Admin can never be chosen here.
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: true,
      },
      businessName: { type: "string", required: false, input: true },

      // Server-controlled: input:false means the client can never set these.
      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      subscriptionPlan: {
        type: "string",
        required: false,
        defaultValue: "free",
        input: false,
      },
      subscriptionExpiresAt: { type: "date", required: false, input: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  socialProviders: {
    google: {
      clientId: env("GOOGLE_CLIENT_ID"),
      clientSecret: env("GOOGLE_CLIENT_SECRET"),
    },
  },

  /* ---------- request-level rules ---------- */
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Sign-up: validate role + password rules (min 6, one uppercase, one lowercase)
      if (ctx.path === "/sign-up/email") {
        const body = (ctx.body ?? {}) as { role?: string; password?: string };

        if (
          body.role !== undefined &&
          !PUBLIC_ROLES.includes(body.role as (typeof PUBLIC_ROLES)[number])
        ) {
          throw new APIError("BAD_REQUEST", {
            message: "Please choose Customer or Vendor as your account role.",
          });
        }

        const pw = body.password ?? "";
        if (pw.length < 6 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw)) {
          throw new APIError("BAD_REQUEST", {
            message:
              "Password needs at least 6 characters, one uppercase and one lowercase letter.",
          });
        }
      }

      // Profile update: users must never change their own role or subscription/blocked status
      if (ctx.path === "/update-user") {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const forbidden = [
          "role",
          "isBlocked",
          "subscriptionPlan",
          "subscriptionExpiresAt",
        ];
        if (forbidden.some((k) => k in body)) {
          throw new APIError("FORBIDDEN", {
            message: "You can't change that field.",
          });
        }
      }
    }),
  },

  /* ---------- database-level safety nets ---------- */
  databaseHooks: {
    user: {
      create: {
        // Covers every sign-up path (email AND Google): anything that isn't customer/vendor
        // becomes "customer", so public registration can never produce an admin.
        before: async (user) => {
          const role = PUBLIC_ROLES.includes(
            user.role as (typeof PUBLIC_ROLES)[number],
          )
            ? user.role
            : "customer";
          return {
            data: { ...user, role, isBlocked: false, subscriptionPlan: "free" },
          };
        },
      },
    },
    session: {
      create: {
        // Blocked users can't sign in (credentials or Google)
        before: async (session, ctx) => {
          const u = await ctx?.context.internalAdapter.findUserById(
            session.userId,
          );
          if (u && (u as { isBlocked?: boolean }).isBlocked) {
            throw new APIError("FORBIDDEN", {
              message: "Your account has been blocked. Please contact support.",
            });
          }
          return { data: session };
        },
      },
    },
  },

  /* ---------- JWT for the Express API ---------- */
  plugins: [
    jwt({
      jwt: {
        issuer: SERVER_URL,
        audience: SERVER_URL,
        expirationTime: "15m",
        // Keep the payload small. Express still re-checks the user in MongoDB on protected routes.
        definePayload: ({ user }) => ({
          id: user.id,
          email: user.email,
          role: (user as { role?: string }).role ?? "customer",
        }),
      },
    }),
  ],

  session: {
    cookieCache: {
      enabled: true,
      strategy: "jwt",
      // 5 minutes (was 7 days): role / blocked changes show up quickly instead of a week later
      maxAge: 5 * 60,
    },
  },

  // Needed only if the client and the server are on different domains in production
  advanced: {
    defaultCookieAttributes: isProd
      ? { sameSite: "none", secure: true, httpOnly: true }
      : undefined,
  },
});

/* // scripts/make-admin.ts  (run: npx tsx scripts/make-admin.ts you@example.com)

import { MongoClient } from "mongodb";
const email = process.argv[2];
const client = new MongoClient(process.env.MONGODB_URI as string);
await client.connect();
const r = await client.db("wedding-planning-platform").collection("user").updateOne({ email }, { $set: { role: "admin" } });
console.log(r.matchedCount ? "Promoted to admin" : "No user with that email");
await client.close();
*/
