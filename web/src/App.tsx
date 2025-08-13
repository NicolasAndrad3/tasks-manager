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

  // alarms locais
  timerStartedAt?: string | null;
  timerAlerted?: boolean;
  dueAlerted?: boolean;
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

// ---------------- Utils ----------------
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
    { offsetHours: 3, subject: `Reminder: "${title}" in 3 hours`, body: `Event "${title}" starts at ${timeStr} on ${dateStr}. That's in 3 hours.` },
    { offsetHours: 1, subject: `Reminder: "${title}" in 1 hour`, body: `Event "${title}" starts at ${timeStr} on ${dateStr}. That's in 1 hour.` },
    { offsetHours: 0, subject: `It's time: "${title}"`, body: `Event "${title}" is today at ${timeStr}.` },
  ];
}

// AM/PM helpers
function isPm(time: string) {
  if (!time) return false;
  const [h] = time.split(":").map(Number);
  return h >= 12;
}
function toggleAmPm(current: string): string {
  if (!current) return "12:00";
  let [h, m] = current.split(":").map(Number);
  if (h >= 12) h -= 12; else h += 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---- Local alarm helpers (beep + Notification) ----
function playBeep(durationMs = 900, freq = 880) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = freq;
    o.start();
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, durationMs + 100);
  } catch {}
}
async function ensureNotifPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }
}
function notifyBrowser(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch {}
  } else {
    try { alert(`${title}\n\n${body}`); } catch {}
  }
  if (navigator.vibrate) navigator.vibrate([220, 80, 220]);
}
function fireAlarm(kind: "due" | "duration", title: string, when: Date) {
  const prettyTime = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const prettyDate = when.toLocaleDateString();
  const head = kind === "due" ? "Time's up!" : "Timer finished!";
  const body = `${title} — ${prettyDate} ${prettyTime}`;
  playBeep();
  notifyBrowser(head, body);
}

// ---------------- Segmented ----------------
function Segmented<T extends string>(props: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const { value, onChange, options, className = "", style } = props;
  return (
    <div className={`seg w-full h-14 rounded-2xl px-2 ${className}`} style={style}>
      <div className="flex w-full h-full items-center gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`seg-btn flex-1 h-10 rounded-xl text-sm grid place-items-center ${value === o.value ? "is-active" : ""}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- Component ----------------
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
    try { const raw = localStorage.getItem("task-meta"); if (raw) setMeta(JSON.parse(raw)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem("task-meta", JSON.stringify(meta)); }, [meta]);

  // Backend fetch
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const items = await listTodos();
        setTodos(items);
      } catch (err) {
        console.error("Failed to load todos from API", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () => todos.filter((t) => (filter === "all" ? true : filter === "active" ? !t.isDone : t.isDone)),
    [todos, filter]
  );
  const remaining = useMemo(() => todos.filter((t) => !t.isDone).length, [todos]);

  const totalMinutes = () =>
    (typeof hours === "number" ? hours * 60 : 0) + (typeof mins === "number" ? mins : 0);

  // ---------- handleAdd corrigido ----------
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();

    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const dueAtStr: string | null =
      mode === "due" ? joinDateTime(dueDate, dueTime) : null;

    const minutesVal: number | null =
      mode === "duration" ? totalMinutes() : null;

    const notifyPlanMinutes: number[] =
      mode === "due" && notify === "email" && dueAtStr
        ? buildNotifyPlan(cleanTitle, dueAtStr).map(p => p.offsetHours * 60)
        : [];

    // monta payload sem brigar com tipos do api.ts
    const payload: any = {
      title: cleanTitle,
      isDone: false,
      dueAt: dueAtStr,
      minutes: minutesVal,
      notifyPlanMinutes,
    };
    if (notify === "email") {
      payload.notifyEmail = (contact.trim() || null);
    }

    try {
      const created = await createTodo(payload);

      const notifyObj =
        mode === "due" && notify === "email" && contact.trim()
          ? { method: "email" as const, target: contact.trim() }
          : undefined;

      const m: Meta =
        mode === "duration"
          ? {
              minutes: minutesVal ?? 0,
              dueAt: null,
              timerStartedAt: new Date().toISOString(),
              timerAlerted: false,
            }
          : mode === "due"
          ? {
              minutes: undefined,
              dueAt: dueAtStr,
              dueAlerted: false,
              notify: notifyObj,
              notifyPlan:
                notifyObj && dueAtStr
                  ? buildNotifyPlan(cleanTitle, dueAtStr)
                  : [],
            }
          : {};

      setTodos(prev => [created, ...prev]);
      setMeta(prev => ({ ...prev, [created.id]: m }));

      // reset
      setTitle("");
      setHours("");
      setMins("");
      setDueDate("");
      setDueTime("");
      setNotify("none");
      setContact("");
      setCalOpen(false);
      inputRef.current?.focus();
    } catch (err) {
      console.error("Failed to create todo", err);
    }
  }

  async function handleToggle(todo: Todo) {
    const next = { ...todo, isDone: !todo.isDone };
    setTodos((prev) => prev.map((p) => (p.id === todo.id ? next : p)));
    try { await updateTodo(todo.id, { title: next.title, isDone: next.isDone }); } catch (err) { console.error(err); }
  }

  async function handleDelete(todo: Todo) {
    setTodos((prev) => prev.filter((p) => p.id !== todo.id));
    const m = { ...meta }; delete m[todo.id]; setMeta(m);
    try { await deleteTodo(todo.id); } catch (err) { console.error(err); }
  }

  const chipBg = { background: "var(--chip-bg)" } as const;
  const muted = { color: "var(--muted)" } as const;
  const text = { color: "var(--text)" } as const;
  const fieldStyle = {
    background: "color-mix(in oklab, var(--surface) 92%, white)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  } as const;

  // ---------- Alarm scheduling ----------
  useEffect(() => {
    let disposed = false;
    const timers: number[] = [];

    (async () => { await ensureNotifPermission(); })();

    const now = Date.now();

    for (const t of todos) {
      if (t.isDone) continue;
      const m = meta[t.id];
      if (!m) continue;

      // Due alarms
      if (m.dueAt && !m.dueAlerted) {
        const due = parseDue(m.dueAt)?.getTime();
        if (due) {
          const ms = due - now;
          if (ms <= 0) {
            if (!disposed) {
              fireAlarm("due", t.title, new Date(due));
              setMeta((prev) => ({ ...prev, [t.id]: { ...prev[t.id], dueAlerted: true } }));
            }
          } else if (ms < 2_147_000_000) {
            const id = window.setTimeout(() => {
              if (disposed) return;
              fireAlarm("due", t.title, new Date());
              setMeta((prev) => ({ ...prev, [t.id]: { ...prev[t.id], dueAlerted: true } }));
            }, ms);
            timers.push(id);
          }
        }
      }

      // Duration alarms
      if (typeof m.minutes === "number" && m.minutes > 0 && !m.timerAlerted) {
        let start = m.timerStartedAt ? Date.parse(m.timerStartedAt) : NaN;
        if (!Number.isFinite(start)) {
          start = Date.now();
          setMeta((prev) => ({ ...prev, [t.id]: { ...prev[t.id], timerStartedAt: new Date(start).toISOString() } }));
        }
        const end = start + m.minutes * 60_000;
        const ms = end - now;
        if (ms <= 0) {
          if (!disposed) {
            fireAlarm("duration", t.title, new Date(end));
            setMeta((prev) => ({ ...prev, [t.id]: { ...prev[t.id], timerAlerted: true } }));
          }
        } else if (ms < 2_147_000_000) {
          const id = window.setTimeout(() => {
            if (disposed) return;
            fireAlarm("duration", t.title, new Date());
            setMeta((prev) => ({ ...prev, [t.id]: { ...prev[t.id], timerAlerted: true } }));
          }, ms);
          timers.push(id);
        }
      }
    }

    return () => {
      disposed = true;
      timers.forEach(clearTimeout);
    };
  }, [todos, meta]);

  return (
    <div className="min-h-dvh" style={{ backgroundImage: "radial-gradient(78% 120% at 80% 0%, var(--bg-1) 0%, var(--bg-0) 42%, var(--bg-2) 100%)", ...text }}>
      <div className="mx-auto max-w-7xl px-6 py-16 flex items-center justify-center">
        <div className="w-full max-w-6xl rounded-[28px] p-10 backdrop-blur transition-shadow" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 60px 120px -60px rgba(2,6,23,.25), 0 8px 30px -10px rgba(2,6,23,.10)", overflow: "visible", ...text }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight" style={text}>{TITLE}</h1>
              <p className="text-sm mt-1" style={muted}>.NET 8 API · React + Vite</p>
            </div>
            <button onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} className="h-11 w-11 rounded-2xl transition-shadow" style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 6px 18px -8px rgba(2,6,23,.18)" }} title={theme === "dark" ? "Switch to light" : "Switch to dark"} aria-label="Toggle theme">
              <span className="grid place-items-center text-lg">{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
          </div>

          {/* FORM */}
          <form onSubmit={handleAdd} className="mb-6 space-y-4">
            {/* Linha 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-4">
              <input ref={inputRef} placeholder="Task title…" value={title} onChange={(e) => setTitle(e.target.value)} className="h-14 rounded-2xl px-5 text-[15px] shadow-sm focus:outline-none" style={{ ...fieldStyle, boxShadow: "0 2px 10px -6px rgba(2,6,23,.08)" }} />

              <Segmented<Mode>
                value={mode}
                onChange={setMode}
                options={[{ value: "due", label: "Due" },{ value: "duration", label: "Duration" },{ value: "none", label: "None" }]}
                className="seg-field"
                style={fieldStyle}
              />
            </div>

            {/* Linha 2 */}
            {mode === "duration" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <input aria-label="Hours" type="number" min={0} step={1} placeholder="HH" value={hours} onChange={(e) => setHours(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))} className="h-14 w-full rounded-2xl px-5 pr-10 text-[15px] shadow-sm focus:outline-none" style={fieldStyle} />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={muted}>h</span>
                </div>
                <div className="relative">
                  <input aria-label="Minutes" type="number" min={0} max={59} step={1} placeholder="MM" value={mins} onChange={(e) => { const v = e.target.value === "" ? "" : Number(e.target.value); setMins(v === "" ? "" : Math.max(0, Math.min(59, v))); }} className="h-14 w-full rounded-2xl px-5 pr-10 text-[15px] shadow-sm focus:outline-none" style={fieldStyle} />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs" style={muted}>min</span>
                </div>
              </div>
            ) : mode === "due" ? (
              <div className="space-y-3">
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setCalOpen((v) => !v)} className="h-14 flex-1 min-w-[220px] rounded-2xl px-4 text-left text-[15px] shadow-sm focus:outline-none" style={{ ...fieldStyle, boxShadow: "0 2px 10px -6px rgba(2,6,23,.08)" }}>
                      {dueDate ? formatDueHuman(joinDateTime(dueDate, dueTime)) : "Select a date"}
                    </button>

                    <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="time-input h-14 w-[140px] rounded-2xl px-3 text-[15px] focus:outline-none focus:ring-0" style={fieldStyle} />

                    <button type="button" onClick={() => setDueTime((v) => toggleAmPm(v))} className="h-14 rounded-2xl px-4 text-sm font-medium" style={{ ...fieldStyle, boxShadow: "0 2px 10px -6px rgba(2,6,23,.08)" }} title="Toggle AM/PM">
                      {isPm(dueTime) ? "PM" : "AM"}
                    </button>
                  </div>

                  {calOpen && (
                    <div ref={calRef} className="absolute z-50 mt-2">
                      <Calendar value={dueDate || undefined} onChange={(v) => setDueDate(v)} onClose={() => setCalOpen(false)} />
                    </div>
                  )}
                </div>

                {/* Notify: 50/50 com o input */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 min-w-0">
                  <Segmented<Notify>
                    value={notify}
                    onChange={setNotify}
                    options={[{ value: "none", label: "No notify" }, { value: "email", label: "Email" }]}
                    className="seg-field"
                    style={fieldStyle}
                  />

                  {notify === "email" && (
                    <input placeholder="email@domain.com" value={contact} onChange={(e) => setContact(e.target.value)} className="h-14 w-full rounded-2xl px-4 text-[14px] shadow-sm focus:outline-none" style={fieldStyle} />
                  )}
                </div>
              </div>
            ) : (
              <div className="h-14 rounded-2xl grid place-items-center text-sm" style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}>
                No schedule
              </div>
            )}

            {/* Add */}
            <div className="flex items-start justify-end pt-2">
              <button type="submit" disabled={!title.trim() || (mode === "duration" && totalMinutes() === 0)} className="w-[140px] h-14 rounded-2xl font-medium disabled:opacity-50" style={{ background: "var(--primary)", color: "#fff", boxShadow: "0 20px 30px -18px var(--primary)" }}>
                Add
              </button>
            </div>
          </form>

          <div className="flex items-center justify-between mb-5">
            <div className="inline-flex rounded-full p-1" style={{ ...chipBg, border: "1px solid var(--border)" }}>
              {(["all", "active", "done"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className="px-4 py-1.5 rounded-full text-sm font-medium" style={filter === f ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 10px 20px -12px rgba(2,6,23,.18)", border: "1px solid var(--border)" } : { color: "var(--muted)" }}>
                  {f === "all" ? "All" : f === "active" ? "Active" : "Done"}
                </button>
              ))}
            </div>
            <div className="text-sm" style={muted}>{loading ? "Loading…" : `${remaining} pending`}</div>
          </div>

          {loading ? (
            <ul className="space-y-4">{Array.from({ length: 3 }).map((_, i) => (<li key={i} className="h-20 rounded-2xl animate-pulse" style={chipBg} />))}</ul>
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
                  <li key={t.id} className="group rounded-2xl p-4 flex items-center gap-4" style={{ background: "color-mix(in oklab, var(--surface) 85%, white)", border: "1px solid var(--border)", boxShadow: "0 10px 24px -16px rgba(2,6,23,.18)" }}>
                    <input id={`t-${t.id}`} type="checkbox" checked={t.isDone} onChange={() => handleToggle(t)} className="size-5 accent-indigo-600" />
                    <label htmlFor={`t-${t.id}`} className={`flex-1 ${t.isDone ? "line-through" : ""}`} style={{ color: t.isDone ? "var(--muted)" : "var(--text)" }}>
                      <div className="font-medium text-[15px]">{t.title}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {typeof m.minutes === "number" && (
                          <span className="px-2 py-0.5 rounded-full" style={{ background: "color-mix(in oklab, #0ea5e9 16%, var(--chip-bg))", color: "color-mix(in oklab, #0ea5e9 70%, var(--text))" }}> {m.minutes} min</span>
                        )}
                        {m.dueAt && (
                          <span className="px-2 py-0.5 rounded-full" style={overdue ? { background: "color-mix(in oklab, #f43f5e 16%, var(--chip-bg))", color: "color-mix(in oklab, #f43f5e 70%, var(--text))" } : { background: "var(--chip-bg)", color: "color-mix(in oklab, var(--text) 70%, var(--chip-bg))" }}>Due: {formatDueHuman(m.dueAt)}</span>
                        )}
                        {m.notify && (
                          <span className="px-2 py-0.5 rounded-full" style={{ background: "color-mix(in oklab, #8b5cf6 16%, var(--chip-bg))", color: "color-mix(in oklab, #8b5cf6 75%, var(--text))" }}>Notify: EMAIL</span>
                        )}
                      </div>
                    </label>
                    <button onClick={() => handleDelete(t)} className="opacity-100 px-3 py-2 rounded-xl" style={{ background: "color-mix(in oklab, #f43f5e 8%, var(--surface))", color: "color-mix(in oklab, #f43f5e 70%, var(--text))", boxShadow: "0 10px 20px -12px rgba(244,63,94,.25)" }}>Delete</button>
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
