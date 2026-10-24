import { apiFetch } from "@/lib/api/server";
import type { StudentTodo } from "@/lib/types";

export function getTodos() {
  return apiFetch<StudentTodo[]>("/api/student/todos");
}
