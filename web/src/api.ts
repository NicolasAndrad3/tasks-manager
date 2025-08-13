// src/api.ts
export type Todo = {
  id: number;
  title: string;
  isDone: boolean;
  dueAt?: string | null;
  minutes?: number | null;
  notifyPlanMinutes: number[];
  notifyEmail?: string | null;
};

// Base URL: usa env em prod; em dev cai no origin (para o proxy do Vite)
const API =
  import.meta.env.VITE_API?.replace(/\/+$/, "") ||
  `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;

async function ok<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` – ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export async function listTodos(): Promise<Todo[]> {
  const res = await fetch(`${API}/api/todos/`, { method: "GET", credentials: "include" });
  return ok<Todo[]>(res);
}

export async function createTodo(p: {
  title: string;
  isDone: boolean;
  dueAt?: string | null;
  minutes?: number | null;
  notifyPlanMinutes?: number[];
  notifyEmail?: string | null;
}): Promise<Todo> {
  const body = {
    title: p.title,
    isDone: p.isDone,
    dueAt: p.dueAt ?? null,
    minutes: p.minutes ?? null,
    notifyPlanMinutes: p.notifyPlanMinutes ?? [],
    notifyEmail: p.notifyEmail ?? null,
  };
  const res = await fetch(`${API}/api/todos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  return ok<Todo>(res);
}

export async function updateTodo(
  id: number,
  p: {
    title: string;
    isDone: boolean;
    dueAt?: string | null;
    minutes?: number | null;
    notifyPlanMinutes?: number[];
    notifyEmail?: string | null;
  }
): Promise<void> {
  const res = await fetch(`${API}/api/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: p.title,
      isDone: p.isDone,
      dueAt: p.dueAt ?? null,
      minutes: p.minutes ?? null,
      notifyPlanMinutes: p.notifyPlanMinutes ?? [],
      notifyEmail: p.notifyEmail ?? null,
    }),
    credentials: "include",
  });
  await ok(res);
}

export async function deleteTodo(id: number): Promise<void> {
  const res = await fetch(`${API}/api/todos/${id}`, { method: "DELETE", credentials: "include" });
  await ok(res);
}

console.info("[API] base =", API);
