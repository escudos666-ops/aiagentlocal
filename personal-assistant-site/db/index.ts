import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type D1Binding = Parameters<typeof drizzle>[0];
type RuntimeWithD1 = typeof globalThis & {
  DB?: D1Binding;
  env?: {
    DB?: D1Binding;
  };
};

export function getDb() {
  const runtime = globalThis as RuntimeWithD1;
  const db = runtime.DB ?? runtime.env?.DB;

  if (!db) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(db, { schema });
}
