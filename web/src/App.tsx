import { useEffect, useMemo, useRef, useState } from "react";
import { createTodo, deleteTodo, listTodos, Todo, updateTodo } from "./api";
import Calendar from "./Calendar";

type Filter = "all" | "active" | "done";
type Mode = "due" | "duration" | "none";
type Notify = "none" | "email";

type NotifyPlan = { offsetHours: number; subject: string; body: string };
type Meta = {
  minutes?: number;
  dueAt?: string | null;
  notify?: { method: "email"; target: string };
  notifyPlan?: NotifyPlan[];
};

const TITLE = "Tasks Schedule";

const THEME_VARS: Record<"light" | "dark", Record<string, string>> = {
  light: {
    "--bg-0": "#f7f8fb",
    "--bg-1": "#eef2ff",
    "--bg-2": "#fbfcfe",
    "--surface": "rgba(255,255,255,.92)",
    "--border": "#e5e7eb",
    "--text": "#0b1220",
    "--muted": "#475569",
    "--primary": "#7c5cff",
    "--chip-bg": "#f1f5f9",
  },
  dark: {
    "--bg-0": "#0a1120",
    "--bg-1": "#0a1020",
    "--bg-2": "#0c1424",
    "--surface": "rgba(2,6,23,.75)",
    "--border": "#101827",
    "--text": "#e5e7eb",
    "--muted": "#9aa4b2",
    "--primary": "#7c5cff",
    "--chip-bg": "rgba(148,163,184,.12)",
  },
};

function joinDateTime(dateStr: string, timeStr: string) {
  if (!dateStr) return "";
  return timeStr ? `${dateStr}T${timeStr}` : dateStr;
}
function parseDue(value?: string | null): Date | null {
  if (!value) return null;
  const s = value.includes("T") ? value : `${value}T00:00:00`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function fmtEnDate(d: Date) {
  return d.toLocaleDateString("en-US");
}
function fmtEnTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function formatDueHuman(value?: string | null) {
  const d = parseDue(value);
  if (!d) return "";
  const date = fmtEnDate(d);
  const time = value && value.includes("T") ? fmtEnTime(d) : "";
  return time ? `${date} ${time}` : date;
}
function buildNotifyPlan(title: string, dueAtISO: string): NotifyPlan[] {
  const base = parseDue(dueAtISO);
  if (!base) return [];
  const dateStr = fmtEnDate(base);
  const timeStr = fmtEnTime(base);
  return [
    {
      offsetHours: 3,
      subject: `Reminder: "${title}" in 3 hours`,
      body: `Event "${title}" starts at ${timeStr} on ${dateStr}. That's in 3 hours.`,
    },
    {
      offsetHours: 1,
      subject: `Reminder: "${title}" in 1 hour`,
      body: `Event "${title}" starts at ${timeStr} on ${dateStr}. That's in 1 hour.`,
    },
    {
      offsetHours: 0,
      subject: `It's time: "${title}"`,
      body: `Event "${title}" is today at ${timeStr}.`,
    },
  ];
}

export default function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("ts-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(THEME_VARS[theme]).forEach(([k, v]) => root.style.setProperty(k, v));
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("ts-theme", theme);
  }, [theme]);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [meta, setMeta] = useState<Record<number, Meta>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("due");
  const [hours, setHours] = useState<number | "">("");
  const [mins, setMins] = useState<number | "">("");
  const [dueDate, setDueDate] = useState<string>("");
  const [dueTime, setDueTime] = useState<string>("");

  const [calOpen, setCalOpen] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  const [notify, setNotify] = useState<Notify>("none");
  const [contact, setContact] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!calOpen) return;
    const onDown = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [calOpen]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("task-meta");
      if (raw) setMeta(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("task-meta", JSON.stringify(meta));
  }, [meta]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const items = await listTodos();
      setTodos(items);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => todos.filter((t) => (filter === "all" ? true : filter === "active" ? !t.isDone : t.isDone)),
    [todos, filter]
  );
  const remaining = useMemo(() => todos.filter((t) => !t.isDone).length, [todos]);

  const totalMinutes = () =>
    (typeof hours === "number" ? hours * 60 : 0) + (typeof mins === "number" ? mins : 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const created = await createTodo({ title: cleanTitle, isDone: false });

    const dueAtStr = mode === "due" ? joinDateTime(dueDate, dueTime) : "";
    const plan = dueAtStr ? buildNotifyPlan(cleanTitle, dueAtStr) : [];

    const notifyObj =
      mode === "due" && notify === "email" && contact.trim()
        ? { method: "email" as const, target: contact.trim() }
        : undefined;

    const m: Meta =
      mode === "duration"
        ? { minutes: totalMinutes(), dueAt: null }
        : mode === "due"
        ? {
            minutes: undefined,
            dueAt: dueAtStr || null,
            notify: notifyObj,
            notifyPlan: notifyObj ? plan : [],
          }
        : {};

    setTodos((prev) => [created, ...prev]);
    setMeta((prev) => ({ ...prev, [created.id]: m }));

    setTitle("");
    setHours("");
    setMins("");
    setDueDate("");
    setDueTime("");
    setNotify("none");
    setContact("");
    setCalOpen(false);
    inputRef.current?.focus();
  }

  async function handleToggle(todo: Todo) {
    const next = { ...todo, isDone: !todo.isDone };
    setTodos((prev) => prev.map((p) => (p.id === todo.id ? next : p)));
    await updateTodo(todo.id, { title: next.title, isDone: next.isDone });
  }

  async function handleDelete(todo: Todo) {
    setTodos((prev) => prev.filter((p) => p.id !== todo.id));
    const m = { ...meta };
    delete m[todo.id];
    setMeta(m);
    await deleteTodo(todo.id);
  }

  const chipBg = { background: "var(--chip-bg)" } as const;
  const muted = { color: "var(--muted)" } as const;
  const text = { color: "var(--text)" } as const;
  const fieldStyle = {
    background: "color-mix(in oklab, var(--surface) 92%, white)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  } as const;

  return (
    <div
      className="min-h-dvh"
      style={{
        backgroundImage:
          "radial-gradient(78% 120% at 80% 0%, var(--bg-1) 0%, var(--bg-0) 42%, var(--bg-2) 100%)",
        ...text,
      }}
    >
      <div className="mx-auto max-w-6xl px-6 py-16 flex items-center justify-center">
        <div
          className="w-full max-w-5xl rounded-[28px] p-10 backdrop-blur transition-shadow overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 60px 120px -60px rgba(2,6,23,.25), 0 8px 30px -10px rgba(2,6,23,.10)",
            ...text,
          }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight" style={text}>
                {TITLE}
              </h1>
              <p className="text-sm mt-1" style={muted}>.NET 8 API · React + Vite</p>
            </div>
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="h-11 w-11 rounded-2xl transition-shadow"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 6px 18px -8px rgba(2,6,23,.18)",
              }}
              title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              aria-label="Toggle theme"
            >
              <span className="grid place-items-center text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
            </button>
          </div>

          <form onSubmit={handleAdd} className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,140px] items-start">
            <div className="min-w-0 grid grid-cols-1 lg:grid-cols-[1fr,260px,1fr] gap-4">
              <input
                ref={inputRef}
                placeholder="Task title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-14 rounded-2xl px-5 text-[15px] shadow-sm focus:outline-none"
                style={{ ...fieldStyle, boxShadow: "0 2px 10px -6px rgba(2,6,23,.08)" }}
              />

              <div className="h-14 rounded-2xl px-2 flex items-center gap-2"
                   style={{ ...fieldStyle, boxShadow: "0 2px 10px -6px rgba(2,6,23,.08)" }}>
                {(["due", "duration", "none"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className="px-3 h-10 rounded-xl text-sm font-medium"
                    style={
                      mode === m
                        ? { background: "var(--primary)", color: "#fff", boxShadow: "0 8px 18px -8px var(--primary)" }
                        : { color: "var(--muted)" }
                    }
                  >
                    {m === "due" ? "Due" : m === "duration" ? "Duration" : "None"}
                  </button>
                ))}
              </div>

              {mode === "duration" ? (
                <div className="grid grid-cols-[1fr,1fr] gap-3">
                  <div className="relative">
                    <input
                      aria-label="Hours"
                      type="number" min={0} step={1} placeholder="HH"
                      value={hours}
                      onChange={(e) => setHours(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
                      className="h-14 w-full rounded-2xl px-5 pr-10 text-[15px] shadow-sm focus:outline-none"
                      style={fieldStyle}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={muted}>h</span>
                  </div>
                  <div className="relative">
                    <input
                      aria-label="Minutes"
                      type="number" min={0} max={59} step={1} placeholder="MM"
                      value={mins}
                      onChange={(e) => {
                        const v = e.target.value === "" ? "" : Number(e.target.value);
                        setMins(v === "" ? "" : Math.max(0, Math.min(59, v)));
                      }}
                      className="h-14 w-full rounded-2xl px-5 pr-10 text-[15px] shadow-sm focus:outline-none"
                      style={fieldStyle}
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={muted}>min</span>
                  </div>
                </div>
              ) : mode === "due" ? (
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCalOpen((v) => !v)}
                      className="h-14 flex-1 rounded-2xl px-4 text-left text-[15px] shadow-sm focus:outline-none"
                      style={{ ...fieldStyle, boxShadow: "0 2px 10px -6px rgba(2,6,23,.08)" }}
                    >
                      {dueDate ? formatDueHuman(joinDateTime(dueDate, dueTime)) : "Select a date"}
                    </button>
                    <input
                     type="time"
                     value={dueTime}
                     onChange={(e) => setDueTime(e.target.value)}
                     className="time-input h-14 w-[140px] rounded-2xl px-3 text-[15px] focus:outline-none focus:ring-0"
                     style={fieldStyle}
                   />
                  </div>

                  {calOpen && (
                    <div ref={calRef} className="relative">
                      <Calendar value={dueDate || undefined} onChange={(v) => setDueDate(v)} onClose={() => setCalOpen(false)} />
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-2 min-w-0">
                    <div className="inline-flex rounded-2xl p-1"
                         style={{ ...chipBg, border: "1px solid var(--border)" }}>
                      {(["none", "email"] as Notify[]).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNotify(n)}
                          className="px-3 h-10 rounded-xl text-sm font-medium"
                          style={
                            notify === n
                              ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 8px 18px -10px rgba(2,6,23,.18)", border: "1px solid var(--border)" }
                              : { color: "var(--muted)" }
                          }
                        >
                          {n === "none" ? "No notify" : "Email"}
                        </button>
                      ))}
                    </div>
                    {notify === "email" && (
                      <input
                        placeholder="email@domain.com"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        className="h-12 w-full min-w-0 rounded-2xl px-4 text-[14px] shadow-sm focus:outline-none"
                        style={fieldStyle}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-14 rounded-2xl grid place-items-center text-sm"
                     style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}>
                  No schedule
                </div>
              )}
            </div>

            <div className="flex items-start justify-end">
              <button
                type="submit"
                disabled={!title.trim() || (mode === "duration" && totalMinutes() === 0)}
                className="w-[140px] h-14 rounded-2xl font-medium disabled:opacity-50"
                style={{ background: "var(--primary)", color: "#fff", boxShadow: "0 20px 30px -18px var(--primary)" }}
              >
                Add
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between mb-5">
            <div className="inline-flex rounded-full p-1" style={{ ...chipBg, border: "1px solid var(--border)" }}>
              {(["all", "active", "done"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium"
                  style={
                    filter === f
                      ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 10px 20px -12px rgba(2,6,23,.18)", border: "1px solid var(--border)" }
                      : { color: "var(--muted)" }
                  }
                >
                  {f === "all" ? "All" : f === "active" ? "Active" : "Done"}
                </button>
              ))}
            </div>
            <div className="text-sm" style={muted}>{loading ? "Loading…" : `${remaining} pending`}</div>
          </div>

          {loading ? (
            <ul className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="h-20 rounded-2xl animate-pulse" style={chipBg} />
              ))}
            </ul>
          ) : filtered.length === 0 ? (
            <div className="text-sm" style={muted}>No tasks yet.</div>
          ) : (
            <ul className="space-y-3">
              {filtered.map((t) => {
                const m = meta[t.id] || {};
                const dueDateObj = parseDue(m.dueAt);
                const now = new Date();
                const overdue = !!(dueDateObj && !t.isDone && dueDateObj.getTime() < now.getTime());
                return (
                  <li
                    key={t.id}
                    className="group rounded-2xl p-4 flex items-center gap-4"
                    style={{
                      background: "color-mix(in oklab, var(--surface) 85%, white)",
                      border: "1px solid var(--border)",
                      boxShadow: "0 10px 24px -16px rgba(2,6,23,.18)",
                    }}
                  >
                    <input
                      id={`t-${t.id}`}
                      type="checkbox"
                      checked={t.isDone}
                      onChange={() => handleToggle(t)}
                      className="size-5 accent-indigo-600"
                    />
                    <label
                      htmlFor={`t-${t.id}`}
                      className={`flex-1 ${t.isDone ? "line-through" : ""}`}
                      style={{ color: t.isDone ? "var(--muted)" : "var(--text)" }}
                    >
                      <div className="font-medium text-[15px]">{t.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {typeof m.minutes === "number" && (
                          <span
                            className="px-2 py-0.5 rounded-full"
                            style={{
                              background: "color-mix(in oklab, #0ea5e9 16%, var(--chip-bg))",
                              color: "color-mix(in oklab, #0ea5e9 70%, var(--text))",
                            }}
                          >
                            ⏱ {m.minutes} min
                          </span>
                        )}
                        {m.dueAt && (
                          <span
                            className="px-2 py-0.5 rounded-full"
                            style={
                              overdue
                                ? { background: "color-mix(in oklab, #f43f5e 16%, var(--chip-bg))", color: "color-mix(in oklab, #f43f5e 70%, var(--text))" }
                                : { background: "var(--chip-bg)", color: "color-mix(in oklab, var(--text) 70%, var(--chip-bg))" }
                            }
                          >
                            Due: {formatDueHuman(m.dueAt)}
                          </span>
                        )}
                        {m.notify && (
                          <span
                            className="px-2 py-0.5 rounded-full"
                            style={{ background: "color-mix(in oklab, #8b5cf6 16%, var(--chip-bg))", color: "color-mix(in oklab, #8b5cf6 75%, var(--text))" }}
                          >
                            Notify: EMAIL
                          </span>
                        )}
                      </div>
                    </label>

                    <button
                      onClick={() => handleDelete(t)}
                      className="opacity-100 px-3 py-2 rounded-xl"
                      style={{
                        background: "color-mix(in oklab, #f43f5e 8%, var(--surface))",
                        color: "color-mix(in oklab, #f43f5e 70%, var(--text))",
                        boxShadow: "0 10px 20px -12px rgba(244,63,94,.25)",
                      }}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
