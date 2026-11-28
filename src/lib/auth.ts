import { client, db } from "@/lib/mongodb";
import { mongodbAdapter } from "@better-auth/mongo-adapter";

import { betterAuth } from "better-auth";
import { APIError, getOAuthState } from "better-auth/api";
import { jwt } from "better-auth/plugins";

// import { MongoClient } from "mongodb";

// const client = new MongoClient(process.env.MONGODB_URI as string);
// const db = client.db("wedding-planning-platform");

export const auth = betterAuth({
  // baseURL: process.env.BETTER_AUTH_URL, // also used as the JWT issuer and audience
  // secret: process.env.BETTER_AUTH_SECRET,
  // trustedOrigins: [process.env.CLIENT_URL as string],

  database: mongodbAdapter(db, { client }),

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: true,
      }, // customer | vendor

      businessName: {
        type: "string",
        required: false,
        input: true,
      },

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

      subscriptionExpiresAt: {
        type: "date",
        required: false,
        input: false,
      },

      phone: {
        type: "string",
        required: false,
        input: true,
      },

      address: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  databaseHooks: {
    user: {
      /* create: {
        // Public sign-up can only ever create a customer or a vendor, never an admin
        before: async (user) => ({
          data: {
            ...user,
            role: user.role === "vendor" ? "vendor" : "customer",
          },
        }),
      }, */

      create: {
        before: async (user, ctx) => {
          let role: string | undefined = user.role as string | undefined;
          let businessName: string | undefined = (
            user as { businessName?: string }
          ).businessName;

          // Google sign-up: pick up what the sign-up page sent in additionalData
          if (ctx?.path === "/callback/:id") {
            const state = await getOAuthState<{
              role?: string;
              businessName?: string;
            }>();

            if (state?.role) role = state.role;
            if (state?.businessName) businessName = state.businessName;
          }

          return {
            data: {
              ...user,
              role: role === "vendor" ? "vendor" : "customer", // admin is impossible here
              businessName:
                role === "vendor"
                  ? businessName?.trim().slice(0, 80)
                  : undefined,
            },
          };
        },
      },

      update: {
        // Users can't change their own role through profile updates
        before: async (data) => {
          if ("role" in data)
            throw new APIError("FORBIDDEN", {
              message: "You can't change your role.",
            });

          return { data };
        },

        // after: async (user, ctx) => {
        //   if ((user as { isBlocked?: boolean }).isBlocked) {
        //     await ctx?.context.internalAdapter.deleteSessions(user.id);
        //   }
        // },
      },
    },

    session: {
      create: {
        // Blocked users can't sign in
        before: async (session, ctx) => {
          const u = await ctx?.context.internalAdapter.findUserById(
            session.userId,
          );

          if ((u as { isBlocked?: boolean } | null)?.isBlocked) {
            throw new APIError("FORBIDDEN", {
              message: "Your account has been blocked.",
            });
          }

          return { data: session };
        },
      },
    },
  },

  // plugins: [jwt(), nextCookies()],
  plugins: [jwt()],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh expiry every 24 hours
    cookieCache: {
      enabled: true,
      strategy: "jwt",
      // maxAge: 5 * 24 * 60 * 60, // 5 days
      maxAge: 5 * 60, // 5 minutes, so a block or role change shows up quickly
    },
  },
});
