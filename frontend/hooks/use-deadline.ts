"use client";

import { useEffect, useState } from "react";

/**
 * Waktu ke tenggat yang berdetak. `expired` menjadi true tepat saat tenggat lewat, tanpa
 * menunggu muat ulang, supaya tombol kumpul terkunci sendiri. Server tetap yang memutuskan.
 */
export function useDeadline(deadlineIso: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineIso) return;
    const target = new Date(deadlineIso).getTime();
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 30_000);
    // Satu pewaktu tepat di tenggat, agar penguncian tidak telat sampai 30 detik.
    const remaining = target - Date.now();
    const exact = remaining > 0 ? window.setTimeout(tick, remaining + 250) : null;
    return () => {
      window.clearInterval(interval);
      if (exact !== null) window.clearTimeout(exact);
    };
  }, [deadlineIso]);

  if (!deadlineIso) return { expired: false, remainingMs: null };
  const remainingMs = new Date(deadlineIso).getTime() - now;
  return { expired: remainingMs <= 0, remainingMs };
}
