// src/api.ts
export type Todo = {
  id: number;
  title: string;
  isDone: boolean;
  dueAt?: string | null;
  minutes?: number | null;
  notifyPlanMinutes: number[];
  // notifyEmail?: string | null; // se você adicionar no modelo
};

// Base URL: usa env (VITE_API). Se não houver, cai pro origin atual.
const API =
  (import.meta.env.VITE_API as string | undefined)?.replace(/\/+$/, "") ||
  `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;

// Helper para tratar erros HTTP
async function ok<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${text ? ` – ${text}` : ""}`);
  }
  return res.json() as Promise<T>;
}

// Endpoints
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
  // notifyEmail?: string | null;
}): Promise<Todo> {
  const body = {
    title: p.title,
    isDone: p.isDone,
    dueAt: p.dueAt ?? null,
    minutes: p.minutes ?? null,
    notifyPlanMinutes: p.notifyPlanMinutes ?? [],
    // notifyEmail: p.notifyEmail ?? null,
  };
  const res = await fetch(`${API}/api/todos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  return ok<Todo>(res);
}

export async function updateTodo(id: number, p: {
  title: string;
  isDone: boolean;
  dueAt?: string | null;
  minutes?: number | null;
  notifyPlanMinutes?: number[];
  // notifyEmail?: string | null;
}): Promise<void> {
  const res = await fetch(`${API}/api/todos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: p.title,
      isDone: p.isDone,
      dueAt: p.dueAt ?? null,
      minutes: p.minutes ?? null,
      notifyPlanMinutes: p.notifyPlanMinutes ?? [],
      // notifyEmail: p.notifyEmail ?? null,
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
