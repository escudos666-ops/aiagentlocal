"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Priority = "high" | "medium" | "low";
type TaskStatus = "open" | "done";
type NoteKind = "decision" | "idea" | "reference" | "general";
type AgendaTone = "deep" | "admin" | "meeting" | "personal";

type Task = {
  id: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  project: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type Note = {
  id: number;
  title: string;
  body: string;
  kind: NoteKind;
  createdAt: string;
  updatedAt: string;
};

type AgendaBlock = {
  id: number;
  label: string;
  startTime: string;
  endTime: string;
  tone: AgendaTone;
  createdAt: string;
};

type Capture = {
  id: number;
  rawText: string;
  interpretedAs: "task" | "note" | "agenda";
  createdAt: string;
};

type AssistantState = {
  tasks: Task[];
  notes: Note[];
  agendaBlocks: AgendaBlock[];
  captures: Capture[];
  persistence: "d1" | "demo";
  error?: string;
};

type Props = {
  displayName: string;
  email: string | null;
};

const emptyState: AssistantState = {
  tasks: [],
  notes: [],
  agendaBlocks: [],
  captures: [],
  persistence: "d1",
};

const sampleState: AssistantState = {
  tasks: [
    {
      id: -1,
      title: "Capture the next thing you want off your mind",
      status: "open",
      priority: "high",
      project: "Today",
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: -2,
      title: "Review open loops before your next focus block",
      status: "open",
      priority: "medium",
      project: "Routine",
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  notes: [
    {
      id: -1,
      title: "Assistant rhythm",
      body: "Use the capture bar for tasks, notes, reminders, and schedule blocks. The deployed site stores them in D1.",
      kind: "reference",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  agendaBlocks: [
    {
      id: -1,
      label: "Deep work",
      startTime: "09:00",
      endTime: "10:30",
      tone: "deep",
      createdAt: new Date().toISOString(),
    },
    {
      id: -2,
      label: "Admin sweep",
      startTime: "14:00",
      endTime: "14:30",
      tone: "admin",
      createdAt: new Date().toISOString(),
    },
  ],
  captures: [],
  persistence: "demo",
};

const priorityTone: Record<Priority, string> = {
  high: "border-[#c2410c] bg-[#fff7ed] text-[#7c2d12]",
  medium: "border-[#1d7f75] bg-[#edf8f5] text-[#0b4f49]",
  low: "border-[#5b6b87] bg-[#f1f5f9] text-[#27364d]",
};

const agendaTone: Record<AgendaTone, string> = {
  deep: "border-l-[#1d7f75]",
  admin: "border-l-[#8a5a00]",
  meeting: "border-l-[#8b315d]",
  personal: "border-l-[#325d8c]",
};

function todayLabel() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function timeNowLabel() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function getNextId(items: { id: number }[]) {
  const minimum = items.reduce((lowest, item) => Math.min(lowest, item.id), 0);
  return minimum <= 0 ? minimum - 1 : -1;
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function parseJsonError(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "The assistant could not save that change.";
}

export default function AssistantClient({ displayName, email }: Props) {
  const [assistantState, setAssistantState] = useState<AssistantState>(emptyState);
  const [activeView, setActiveView] = useState<"desk" | "tasks" | "notes">("desk");
  const [command, setCommand] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<Priority>("medium");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [clock, setClock] = useState(timeNowLabel());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(timeNowLabel()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadState() {
      try {
        const response = await fetch("/api/assistant", { cache: "no-store" });
        const payload = (await response.json()) as AssistantState;

        if (!ignore) {
          setAssistantState(payload.persistence === "demo" ? sampleState : payload);
          setStatusMessage(payload.error ?? "");
        }
      } catch {
        if (!ignore) {
          setAssistantState(sampleState);
          setStatusMessage("Running local demo data until D1 is available.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadState();
    return () => {
      ignore = true;
    };
  }, []);

  const openTasks = useMemo(
    () => assistantState.tasks.filter((task) => task.status === "open"),
    [assistantState.tasks]
  );
  const doneTasks = useMemo(
    () => assistantState.tasks.filter((task) => task.status === "done"),
    [assistantState.tasks]
  );
  const highPriorityCount = openTasks.filter((task) => task.priority === "high").length;
  const nextBlock = assistantState.agendaBlocks[0];
  const focusScore = Math.max(10, 100 - openTasks.length * 9 - highPriorityCount * 7);

  async function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = command.trim();

    if (!text) {
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "capture", text }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(parseJsonError(payload));
      }

      setAssistantState((current) => {
        const next = { ...current };
        if (payload.createdType === "task") {
          next.tasks = [payload.item, ...current.tasks];
        }
        if (payload.createdType === "note") {
          next.notes = [payload.item, ...current.notes];
        }
        if (payload.createdType === "agenda") {
          next.agendaBlocks = [payload.item, ...current.agendaBlocks].sort((a, b) =>
            a.startTime.localeCompare(b.startTime)
          );
        }
        next.captures = [payload.capture, ...current.captures].slice(0, 8);
        return next;
      });
      setCommand("");
      setStatusMessage(`Captured as ${payload.createdType}.`);
    } catch (error) {
      const fallbackTask: Task = {
        id: getNextId(assistantState.tasks),
        title: text,
        status: "open",
        priority: "medium",
        project: "Inbox",
        dueDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAssistantState((current) => ({
        ...current,
        tasks: [fallbackTask, ...current.tasks],
        persistence: "demo",
      }));
      setCommand("");
      setStatusMessage(error instanceof Error ? error.message : "Saved locally for this preview.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskTitle.trim();

    if (!title) {
      return;
    }

    await saveItem(
      { type: "task", title, priority: taskPriority, project: "Inbox" },
      (item: Task) =>
        setAssistantState((current) => ({
          ...current,
          tasks: [item, ...current.tasks],
        })),
      {
        id: getNextId(assistantState.tasks),
        title,
        status: "open",
        priority: taskPriority,
        project: "Inbox",
        dueDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    setTaskTitle("");
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = noteTitle.trim();

    if (!title) {
      return;
    }

    await saveItem(
      { type: "note", title, body: noteBody, kind: "general" },
      (item: Note) =>
        setAssistantState((current) => ({
          ...current,
          notes: [item, ...current.notes],
        })),
      {
        id: getNextId(assistantState.notes),
        title,
        body: noteBody,
        kind: "general",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
    setNoteTitle("");
    setNoteBody("");
  }

  async function saveItem<T>(payload: object, onSaved: (item: T) => void, fallback: T) {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(parseJsonError(result));
      }

      onSaved(result.item as T);
      setStatusMessage("Saved.");
    } catch (error) {
      onSaved(fallback);
      setAssistantState((current) => ({ ...current, persistence: "demo" }));
      setStatusMessage(error instanceof Error ? error.message : "Saved locally for this preview.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleTask(task: Task) {
    const nextStatus: TaskStatus = task.status === "done" ? "open" : "done";

    setAssistantState((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === task.id ? { ...item, status: nextStatus } : item
      ),
    }));

    if (task.id < 0) {
      return;
    }

    try {
      const response = await fetch("/api/assistant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "task", id: task.id, status: nextStatus }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(parseJsonError(result));
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Could not update task.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <div className="mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-[#d9ded8] py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-[#65706b]">{todayLabel()} at {clock}</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Personal Assistant</h1>
            <p className="text-sm text-[#65706b]">
              Good to see you, {displayName}. {email ? "Workspace identity is active." : "Local preview identity is active."}
            </p>
          </div>

          <nav className="flex w-full gap-2 rounded-lg border border-[#cdd6d1] bg-white p-1 lg:w-auto">
            {(["desk", "tasks", "notes"] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className={`h-10 flex-1 rounded-md px-4 text-sm font-medium capitalize transition lg:flex-none ${
                  activeView === view
                    ? "bg-[#1d7f75] text-white"
                    : "text-[#36403b] hover:bg-[#eef2ef]"
                }`}
              >
                {view}
              </button>
            ))}
          </nav>
        </header>

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase text-[#53605a]">Today</h2>
                <span className="rounded-md bg-[#edf8f5] px-2 py-1 text-sm font-semibold text-[#0b4f49]">
                  {focusScore}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Metric label="Open" value={openTasks.length} />
                <Metric label="Done" value={doneTasks.length} />
                <Metric label="High" value={highPriorityCount} />
              </div>
            </section>

            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-[#53605a]">Quick Capture</h2>
              <form onSubmit={submitCommand} className="mt-4 flex flex-col gap-3">
                <textarea
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="Example: remind me to send the deployment note tomorrow"
                  className="min-h-28 resize-none rounded-md border border-[#cdd6d1] bg-[#fbfcfb] p-3 text-sm outline-none transition focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
                />
                <button
                  type="submit"
                  disabled={isSaving || !command.trim()}
                  className="h-10 rounded-md bg-[#171918] px-4 text-sm font-semibold text-white transition hover:bg-[#2d332f] disabled:bg-[#aab3ae]"
                >
                  Capture
                </button>
              </form>
              {statusMessage ? (
                <p className="mt-3 text-sm leading-6 text-[#785b13]">{statusMessage}</p>
              ) : null}
            </section>

            <section className="overflow-hidden rounded-lg border border-[#d9ded8] bg-white">
              <img
                src="/assistant-visual.png"
                alt="Assistant planning visual"
                className="h-44 w-full object-cover"
              />
              <div className="border-t border-[#d9ded8] p-4">
                <h2 className="text-sm font-semibold uppercase text-[#53605a]">Next Block</h2>
                <p className="mt-2 text-lg font-semibold">{nextBlock?.label ?? "No agenda yet"}</p>
                <p className="mt-1 text-sm text-[#65706b]">
                  {nextBlock ? `${nextBlock.startTime} to ${nextBlock.endTime}` : "Add one with quick capture."}
                </p>
              </div>
            </section>
          </aside>

          <section className="min-w-0 rounded-lg border border-[#d9ded8] bg-white">
            {activeView === "desk" ? (
              <DeskView
                agendaBlocks={assistantState.agendaBlocks}
                isLoading={isLoading}
                notes={assistantState.notes}
                openTasks={openTasks}
                onToggleTask={toggleTask}
              />
            ) : null}
            {activeView === "tasks" ? (
              <TasksView
                isLoading={isLoading}
                taskPriority={taskPriority}
                taskTitle={taskTitle}
                tasks={assistantState.tasks}
                onAddTask={addTask}
                onPriorityChange={setTaskPriority}
                onTaskTitleChange={setTaskTitle}
                onToggleTask={toggleTask}
              />
            ) : null}
            {activeView === "notes" ? (
              <NotesView
                isLoading={isLoading}
                noteBody={noteBody}
                noteTitle={noteTitle}
                notes={assistantState.notes}
                onAddNote={addNote}
                onNoteBodyChange={setNoteBody}
                onNoteTitleChange={setNoteTitle}
              />
            ) : null}
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-[#53605a]">Agenda</h2>
              <div className="mt-4 flex flex-col gap-3">
                {assistantState.agendaBlocks.length ? (
                  assistantState.agendaBlocks.map((block) => (
                    <div
                      key={block.id}
                      className={`border-l-4 bg-[#fbfcfb] px-3 py-2 ${agendaTone[block.tone]}`}
                    >
                      <p className="text-sm font-semibold">{block.label}</p>
                      <p className="mt-1 text-xs text-[#65706b]">
                        {block.startTime} to {block.endTime}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyLine text="No agenda blocks yet." />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-[#53605a]">Recent Captures</h2>
              <div className="mt-4 flex flex-col gap-3">
                {assistantState.captures.length ? (
                  assistantState.captures.map((capture) => (
                    <div key={capture.id} className="border-b border-[#eef2ef] pb-3 last:border-b-0 last:pb-0">
                      <p className="text-sm leading-6">{capture.rawText}</p>
                      <p className="mt-1 text-xs font-medium uppercase text-[#65706b]">
                        {capture.interpretedAs}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyLine text="Captured requests will appear here." />
                )}
              </div>
            </section>

            <section className="rounded-lg border border-[#d9ded8] bg-white p-4">
              <h2 className="text-sm font-semibold uppercase text-[#53605a]">Storage</h2>
              <p className="mt-3 text-sm leading-6 text-[#53605a]">
                {assistantState.persistence === "d1"
                  ? "D1 persistence is enabled for deployed use."
                  : "Preview mode is using local sample data until D1 is available."}
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#d9ded8] bg-[#fbfcfb] p-3">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase text-[#65706b]">{label}</p>
    </div>
  );
}

function DeskView({
  agendaBlocks,
  isLoading,
  notes,
  openTasks,
  onToggleTask,
}: {
  agendaBlocks: AgendaBlock[];
  isLoading: boolean;
  notes: Note[];
  openTasks: Task[];
  onToggleTask: (task: Task) => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-[#d9ded8] p-5">
        <h2 className="text-xl font-semibold">Command Desk</h2>
        <p className="mt-1 text-sm text-[#65706b]">The highest-signal view for the next few hours.</p>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="border-b border-[#d9ded8] p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Focus Queue</h3>
            <span className="text-sm text-[#65706b]">{openTasks.length} open</span>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {isLoading ? (
              <EmptyLine text="Loading your assistant state." />
            ) : openTasks.length ? (
              openTasks.slice(0, 8).map((task) => (
                <TaskRow key={task.id} task={task} onToggleTask={onToggleTask} />
              ))
            ) : (
              <EmptyLine text="All clear. Capture the next thing when it appears." />
            )}
          </div>
        </section>
        <section className="p-5">
          <h3 className="font-semibold">Memory</h3>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-[#65706b]">Next agenda block</p>
              <p className="mt-1 text-lg font-semibold">{agendaBlocks[0]?.label ?? "No block scheduled"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#65706b]">Latest note</p>
              <p className="mt-1 text-base font-semibold">{notes[0]?.title ?? "No notes yet"}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#53605a]">{notes[0]?.body ?? "Capture references, decisions, or ideas."}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TasksView({
  isLoading,
  taskPriority,
  taskTitle,
  tasks,
  onAddTask,
  onPriorityChange,
  onTaskTitleChange,
  onToggleTask,
}: {
  isLoading: boolean;
  taskPriority: Priority;
  taskTitle: string;
  tasks: Task[];
  onAddTask: (event: FormEvent<HTMLFormElement>) => void;
  onPriorityChange: (priority: Priority) => void;
  onTaskTitleChange: (title: string) => void;
  onToggleTask: (task: Task) => void;
}) {
  return (
    <div>
      <div className="border-b border-[#d9ded8] p-5">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <form onSubmit={onAddTask} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_110px]">
          <input
            value={taskTitle}
            onChange={(event) => onTaskTitleChange(event.target.value)}
            placeholder="Add a task"
            className="h-11 rounded-md border border-[#cdd6d1] bg-[#fbfcfb] px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
          />
          <select
            value={taskPriority}
            onChange={(event) => onPriorityChange(event.target.value as Priority)}
            className="h-11 rounded-md border border-[#cdd6d1] bg-[#fbfcfb] px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button type="submit" className="h-11 rounded-md bg-[#1d7f75] px-4 text-sm font-semibold text-white hover:bg-[#16665e]">
            Add
          </button>
        </form>
      </div>
      <div className="flex flex-col p-5">
        {isLoading ? (
          <EmptyLine text="Loading tasks." />
        ) : tasks.length ? (
          tasks.map((task) => <TaskRow key={task.id} task={task} onToggleTask={onToggleTask} />)
        ) : (
          <EmptyLine text="No tasks yet." />
        )}
      </div>
    </div>
  );
}

function NotesView({
  isLoading,
  noteBody,
  noteTitle,
  notes,
  onAddNote,
  onNoteBodyChange,
  onNoteTitleChange,
}: {
  isLoading: boolean;
  noteBody: string;
  noteTitle: string;
  notes: Note[];
  onAddNote: (event: FormEvent<HTMLFormElement>) => void;
  onNoteBodyChange: (body: string) => void;
  onNoteTitleChange: (title: string) => void;
}) {
  return (
    <div>
      <div className="border-b border-[#d9ded8] p-5">
        <h2 className="text-xl font-semibold">Notes</h2>
        <form onSubmit={onAddNote} className="mt-4 grid gap-3">
          <input
            value={noteTitle}
            onChange={(event) => onNoteTitleChange(event.target.value)}
            placeholder="Note title"
            className="h-11 rounded-md border border-[#cdd6d1] bg-[#fbfcfb] px-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
          />
          <textarea
            value={noteBody}
            onChange={(event) => onNoteBodyChange(event.target.value)}
            placeholder="Details, links, decisions, or context"
            className="min-h-28 resize-none rounded-md border border-[#cdd6d1] bg-[#fbfcfb] p-3 text-sm outline-none focus:border-[#1d7f75] focus:ring-2 focus:ring-[#cdece6]"
          />
          <button type="submit" className="h-11 w-full rounded-md bg-[#1d7f75] px-4 text-sm font-semibold text-white hover:bg-[#16665e] sm:w-32">
            Save Note
          </button>
        </form>
      </div>
      <div className="grid gap-0">
        {isLoading ? (
          <EmptyLine text="Loading notes." />
        ) : notes.length ? (
          notes.map((note) => (
            <article key={note.id} className="border-b border-[#eef2ef] p-5 last:border-b-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-semibold">{note.title}</h3>
                <span className="w-fit rounded-md border border-[#cdd6d1] px-2 py-1 text-xs font-medium uppercase text-[#53605a]">
                  {note.kind}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#53605a]">{note.body || "No extra details."}</p>
            </article>
          ))
        ) : (
          <EmptyLine text="No notes yet." />
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onToggleTask }: { task: Task; onToggleTask: (task: Task) => void }) {
  return (
    <div className="grid gap-3 border-b border-[#eef2ef] py-3 last:border-b-0 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:items-center">
      <button
        type="button"
        onClick={() => onToggleTask(task)}
        aria-label={task.status === "done" ? "Mark task open" : "Mark task done"}
        title={task.status === "done" ? "Mark open" : "Mark done"}
        className={`h-9 w-9 rounded-md border text-sm font-semibold ${
          task.status === "done"
            ? "border-[#1d7f75] bg-[#1d7f75] text-white"
            : "border-[#cdd6d1] bg-white text-[#53605a] hover:bg-[#eef2ef]"
        }`}
      >
        {task.status === "done" ? "OK" : ""}
      </button>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${task.status === "done" ? "text-[#7b8580]" : "text-[#171918]"}`}>
          {task.title}
        </p>
        <p className="mt-1 text-xs text-[#65706b]">
          {task.project} - {formatDate(task.dueDate)}
        </p>
      </div>
      <span className={`w-fit rounded-md border px-2 py-1 text-xs font-semibold uppercase ${priorityTone[task.priority]}`}>
        {task.priority}
      </span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-[#cdd6d1] p-4 text-sm leading-6 text-[#65706b]">{text}</p>;
}
