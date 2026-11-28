import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI as string;
if (!uri) throw new Error("MONGODB_URI is not set");

const g = globalThis as unknown as { _wedplanMongo?: MongoClient };

export const client =
  g._wedplanMongo ??
  (g._wedplanMongo = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8_000,
  }));

export const db = client.db(process.env.DB_NAME ?? "wedding-planning-platform");

/* const options = { maxPoolSize: 10, serverSelectionTimeoutMS: 8_000 };

let client: MongoClient;

if (process.env.NODE_ENV === "development") {
  const g = globalThis as unknown as { _wedplanMongo?: MongoClient };
  client = g._wedplanMongo ??= new MongoClient(uri, options);
} else {
  client = new MongoClient(uri, options);
} */

/* import { MongoClient } from "mongodb";

const g = globalThis as unknown as { _wedplanMongo?: MongoClient };

export const client =
  g._wedplanMongo ??
  new MongoClient(process.env.MONGODB_URI as string, {
    maxPoolSize: 10,
    maxIdleTimeMS: 60_000,
    serverSelectionTimeoutMS: 8_000,
  });

g._wedplanMongo = client; // keep it in production too, not only in dev

export const db = client.db(process.env.DB_NAME ?? "wedding-planning-platform");

*/

/* import { attachDatabasePool } from "@vercel/functions";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI as string;
if (!uri) throw new Error("MONGODB_URI is not set");

const g = globalThis as unknown as { _wedplanMongo?: MongoClient };

export const client =
  g._wedplanMongo ??
  new MongoClient(uri, {
    maxPoolSize: 10,
    maxIdleTimeMS: 5_000,
    serverSelectionTimeoutMS: 8_000,
    // serverSelectionTimeoutMS: 15_000,
  });

if (!g._wedplanMongo) {
  attachDatabasePool(client);
  g._wedplanMongo = client;
} 

// g._wedplanMongo = client;
// attachDatabasePool(client);

export const db = client.db(process.env.DB_NAME ?? "wedding-planning-platform"); 

*/
