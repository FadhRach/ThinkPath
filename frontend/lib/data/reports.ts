import { apiFetch } from "@/lib/api/server";
import type { ReportPayload } from "@/lib/types";

export function getReportOverview() {
  return apiFetch<ReportPayload>("/api/reports/overview");
}
