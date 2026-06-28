import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["open", "done"] }).notNull().default("open"),
  priority: text("priority", { enum: ["high", "medium", "low"] })
    .notNull()
    .default("medium"),
  project: text("project").notNull().default("Personal"),
  dueDate: text("due_date"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  kind: text("kind", { enum: ["decision", "idea", "reference", "general"] })
    .notNull()
    .default("general"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const agendaBlocks = sqliteTable("agenda_blocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  label: text("label").notNull(),
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("10:00"),
  tone: text("tone", { enum: ["deep", "admin", "meeting", "personal"] })
    .notNull()
    .default("deep"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const captures = sqliteTable("captures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  rawText: text("raw_text").notNull(),
  interpretedAs: text("interpreted_as", {
    enum: ["task", "note", "agenda"],
  }).notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  requestText: text("request_text").notNull(),
  intent: text("intent").notNull().default("question"),
  route: text("route").notNull().default("unconfigured"),
  status: text("status", { enum: ["completed", "failed", "needs_confirmation"] })
    .notNull()
    .default("completed"),
  responseText: text("response_text").notNull().default(""),
  sourcesJson: text("sources_json").notNull().default("[]"),
  rawJson: text("raw_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
