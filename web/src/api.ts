import axios from "axios";

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "/api";
export const api = axios.create({ baseURL: API_BASE });

export type Todo = { id: number; title: string; isDone: boolean; };
export type TodoDto = { title: string; isDone: boolean; };

function normalizeArray(data: any): Todo[] {
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (data?.value && Array.isArray(data.value)) return data.value;
  if (data?.$values && Array.isArray(data.$values)) return data.$values;
  if (typeof data === "string") { try { const p = JSON.parse(data); if (Array.isArray(p)) return p; } catch{} }
  console.warn("Unexpected todos payload:", data);
  return [];
}

export async function listTodos(): Promise<Todo[]> {
  const { data } = await api.get("/todos");
  return normalizeArray(data);
}

export async function createTodo(dto: TodoDto): Promise<Todo> {
  const { data } = await api.post("/todos", dto);
  return data as Todo;
}

export async function updateTodo(id: number, dto: TodoDto): Promise<void> {
  await api.put(`/todos/${id}`, dto);
}

export async function deleteTodo(id: number): Promise<void> {
  await api.delete(`/todos/${id}`);
}
