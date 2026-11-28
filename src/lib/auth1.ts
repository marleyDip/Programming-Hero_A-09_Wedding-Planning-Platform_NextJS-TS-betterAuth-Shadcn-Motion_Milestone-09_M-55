import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { MongoClient } from "mongodb";
import { BRANCHES } from "./branches";

const client = new MongoClient(process.env.MONGODB_URI as string);
const db = client.db("wedding-planning-platform");

export const auth1 = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),

  user: {
    additionalFields: {
      role: {
        // type: "string",
        type: ["admin", "user", "branchManager"],
        input: false,
        defaultValue: "user",
      },

      // Only branch managers have a branch. Set by an admin on the server, never by the user.
      // Better Auth does not check enum values at runtime, so Express must validate the value.
      branch: {
        type: [...BRANCHES],
        input: false,
        required: false,
        defaultValue: null,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  plugins: [jwt()],

  session: {
    cookieCache: {
      enabled: true,
      strategy: "jwt",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    },
  },
});
