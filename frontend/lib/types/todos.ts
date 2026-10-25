export interface StudentTodo {
  id: string;
  title: string;
  /** Tanggal saja (YYYY-MM-DD), tanpa jam. */
  due_on: string | null;
  done: boolean;
  created_at: string;
  done_at: string | null;
}
