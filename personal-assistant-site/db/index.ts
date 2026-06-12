import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type D1Binding = Parameters<typeof drizzle>[0];
type RuntimeGlobal = typeof globalThis & {
  env?: { DB?: D1Binding };
  __env__?: { DB?: D1Binding };
};

export function getDb() {
  const runtimeGlobal = globalThis as RuntimeGlobal;
  const db = runtimeGlobal.env?.DB ?? runtimeGlobal.__env__?.DB;

  if (!db) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(db, { schema });
}
