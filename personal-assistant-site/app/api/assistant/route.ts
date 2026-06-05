import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { agendaBlocks, captures, notes, tasks } from "../../../db/schema";

type Priority = "high" | "medium" | "low";
type TaskStatus = "open" | "done";
type NoteKind = "decision" | "idea" | "reference" | "general";
type AgendaTone = "deep" | "admin" | "meeting" | "personal";

type PostPayload =
  | {
      type: "task";
      title?: string;
      priority?: Priority;
      project?: string;
      dueDate?: string | null;
    }
  | {
      type: "note";
      title?: string;
      body?: string;
      kind?: NoteKind;
    }
  | {
      type: "agenda";
      label?: string;
      startTime?: string;
      endTime?: string;
      tone?: AgendaTone;
    }
  | {
      type: "capture";
      text?: string;
    };

type PatchPayload = {
  type?: "task";
  id?: number;
  status?: TaskStatus;
  priority?: Priority;
  project?: string;
  dueDate?: string | null;
};

function getOwnerEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email") ?? "local-preview@example.com";
}

function routeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const detail =
    error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("Cloudflare D1 binding")) {
    return "D1 is not available in this local preview. The deployed Sites version will persist data.";
  }

  if (combined.includes("no such table")) {
    return "The assistant tables are unavailable. Generate and deploy the Drizzle migration so Sites can apply it to D1.";
  }

  return message;
}

function isPriority(value: unknown): value is Priority {
  return value === "high" || value === "medium" || value === "low";
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "open" || value === "done";
}

function isNoteKind(value: unknown): value is NoteKind {
  return value === "decision" || value === "idea" || value === "reference" || value === "general";
}

function isAgendaTone(value: unknown): value is AgendaTone {
  return value === "deep" || value === "admin" || value === "meeting" || value === "personal";
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function classifyCapture(text: string): "task" | "note" | "agenda" {
  const lower = text.toLowerCase();

  if (lower.startsWith("note:") || lower.startsWith("remember ") || lower.includes(" idea ")) {
    return "note";
  }

  if (
    lower.startsWith("schedule ") ||
    lower.includes(" meeting ") ||
    lower.includes(" call ") ||
    lower.includes(" at ")
  ) {
    return "agenda";
  }

  return "task";
}

function getAgendaDefaults(text: string) {
  const hourMatch = text.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\b/);
  const startHour = hourMatch ? Number(hourMatch[1]) : 9;
  const startMinute = hourMatch?.[2] ?? "00";
  const endHour = Math.min(startHour + 1, 23);
  const startTime = `${String(startHour).padStart(2, "0")}:${startMinute}`;
  const endTime = `${String(endHour).padStart(2, "0")}:${startMinute}`;

  return { startTime, endTime };
}

export async function GET(request: Request) {
  try {
    const ownerEmail = getOwnerEmail(request);
    const db = getDb();
    const [taskRows, noteRows, agendaRows, captureRows] = await Promise.all([
      db
        .select()
        .from(tasks)
        .where(eq(tasks.ownerEmail, ownerEmail))
        .orderBy(desc(tasks.updatedAt), desc(tasks.id))
        .limit(60),
      db
        .select()
        .from(notes)
        .where(eq(notes.ownerEmail, ownerEmail))
        .orderBy(desc(notes.updatedAt), desc(notes.id))
        .limit(40),
      db
        .select()
        .from(agendaBlocks)
        .where(eq(agendaBlocks.ownerEmail, ownerEmail))
        .orderBy(agendaBlocks.startTime, desc(agendaBlocks.id))
        .limit(20),
      db
        .select()
        .from(captures)
        .where(eq(captures.ownerEmail, ownerEmail))
        .orderBy(desc(captures.createdAt), desc(captures.id))
        .limit(8),
    ]);

    return Response.json({
      tasks: taskRows,
      notes: noteRows,
      agendaBlocks: agendaRows,
      captures: captureRows,
      persistence: "d1",
    });
  } catch (error) {
    return Response.json({
      tasks: [],
      notes: [],
      agendaBlocks: [],
      captures: [],
      persistence: "demo",
      error: routeErrorMessage(error),
    });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as PostPayload;
    const ownerEmail = getOwnerEmail(request);
    const db = getDb();

    if (payload.type === "task") {
      const title = cleanText(payload.title);

      if (!title) {
        return Response.json({ error: "Task title is required." }, { status: 400 });
      }

      const [item] = await db
        .insert(tasks)
        .values({
          ownerEmail,
          title,
          priority: isPriority(payload.priority) ? payload.priority : "medium",
          project: cleanText(payload.project) || "Inbox",
          dueDate: cleanText(payload.dueDate) || null,
        })
        .returning();

      return Response.json({ item }, { status: 201 });
    }

    if (payload.type === "note") {
      const title = cleanText(payload.title);

      if (!title) {
        return Response.json({ error: "Note title is required." }, { status: 400 });
      }

      const [item] = await db
        .insert(notes)
        .values({
          ownerEmail,
          title,
          body: cleanText(payload.body),
          kind: isNoteKind(payload.kind) ? payload.kind : "general",
        })
        .returning();

      return Response.json({ item }, { status: 201 });
    }

    if (payload.type === "agenda") {
      const label = cleanText(payload.label);

      if (!label) {
        return Response.json({ error: "Agenda label is required." }, { status: 400 });
      }

      const [item] = await db
        .insert(agendaBlocks)
        .values({
          ownerEmail,
          label,
          startTime: cleanText(payload.startTime) || "09:00",
          endTime: cleanText(payload.endTime) || "10:00",
          tone: isAgendaTone(payload.tone) ? payload.tone : "deep",
        })
        .returning();

      return Response.json({ item }, { status: 201 });
    }

    if (payload.type === "capture") {
      const text = cleanText(payload.text);

      if (!text) {
        return Response.json({ error: "Capture text is required." }, { status: 400 });
      }

      const createdType = classifyCapture(text);
      const [capture] = await db
        .insert(captures)
        .values({
          ownerEmail,
          rawText: text,
          interpretedAs: createdType,
        })
        .returning();

      if (createdType === "note") {
        const title = text.replace(/^note:\s*/i, "").slice(0, 96);
        const [item] = await db
          .insert(notes)
          .values({
            ownerEmail,
            title,
            body: text,
            kind: text.toLowerCase().includes("decision") ? "decision" : "general",
          })
          .returning();

        return Response.json({ capture, createdType, item }, { status: 201 });
      }

      if (createdType === "agenda") {
        const defaults = getAgendaDefaults(text);
        const [item] = await db
          .insert(agendaBlocks)
          .values({
            ownerEmail,
            label: text,
            startTime: defaults.startTime,
            endTime: defaults.endTime,
            tone: text.toLowerCase().includes("meeting") ? "meeting" : "admin",
          })
          .returning();

        return Response.json({ capture, createdType, item }, { status: 201 });
      }

      const [item] = await db
        .insert(tasks)
        .values({
          ownerEmail,
          title: text,
          priority: text.toLowerCase().includes("urgent") ? "high" : "medium",
          project: "Inbox",
        })
        .returning();

      return Response.json({ capture, createdType, item }, { status: 201 });
    }

    return Response.json({ error: "Unsupported assistant payload." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = (await request.json()) as PatchPayload;
    const ownerEmail = getOwnerEmail(request);

    if (payload.type !== "task" || typeof payload.id !== "number") {
      return Response.json({ error: "Task id is required." }, { status: 400 });
    }

    const values: Partial<typeof tasks.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (isTaskStatus(payload.status)) {
      values.status = payload.status;
    }
    if (isPriority(payload.priority)) {
      values.priority = payload.priority;
    }
    if (typeof payload.project === "string") {
      values.project = payload.project.trim() || "Inbox";
    }
    if (typeof payload.dueDate === "string" || payload.dueDate === null) {
      values.dueDate = cleanText(payload.dueDate) || null;
    }

    const db = getDb();
    const [item] = await db
      .update(tasks)
      .set(values)
      .where(and(eq(tasks.id, payload.id), eq(tasks.ownerEmail, ownerEmail)))
      .returning();

    if (!item) {
      return Response.json({ error: "Task was not found." }, { status: 404 });
    }

    return Response.json({ item });
  } catch (error) {
    return Response.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const ownerEmail = getOwnerEmail(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const id = Number(url.searchParams.get("id"));

    if (!Number.isFinite(id)) {
      return Response.json({ error: "A numeric id is required." }, { status: 400 });
    }

    const db = getDb();

    if (type === "task") {
      await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.ownerEmail, ownerEmail)));
      return Response.json({ ok: true });
    }

    if (type === "note") {
      await db.delete(notes).where(and(eq(notes.id, id), eq(notes.ownerEmail, ownerEmail)));
      return Response.json({ ok: true });
    }

    if (type === "agenda") {
      await db.delete(agendaBlocks).where(and(eq(agendaBlocks.id, id), eq(agendaBlocks.ownerEmail, ownerEmail)));
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported delete type." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: routeErrorMessage(error) }, { status: 500 });
  }
}
