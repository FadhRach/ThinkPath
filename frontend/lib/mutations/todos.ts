import { apiFetchBrowser } from "@/lib/api/browser";
import type { StudentTodo } from "@/lib/types";

export function createTodo(input: { title: string; due_on?: string | null }) {
  return apiFetchBrowser<StudentTodo>("/api/student/todos", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTodo(id: string, input: { done?: boolean; title?: string }) {
  return apiFetchBrowser<StudentTodo>(`/api/student/todos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTodo(id: string) {
  return apiFetchBrowser<void>(`/api/student/todos/${id}`, { method: "DELETE" });
}
