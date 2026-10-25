"use client";

import { useCallback, useRef, useState } from "react";

import { commitReady } from "@/features/cekpaham/lib/recording";
import { transcribeCekPahamChunk } from "@/lib/mutations";

// Dua kegagalan beruntun berarti caption tidak bisa diandalkan; berhenti dan
// biarkan rekaman jalan terus (jawaban tetap tercatat, transkripnya menyusul).
const MAX_FAILURES = 2;
// Potongan yang menumpuk lebih dari ini dibuang: caption yang terlambat tak berguna.
const MAX_PENDING = 3;

/**
 * Caption sementara dari potongan audio. Best-effort: tidak pernah menghalangi rekaman.
 * Potongan dikirim bersamaan (satu yang lambat tidak menahan yang lain), teksnya
 * dipasang menurut urutan potongan.
 */
export function useLiveCaption(cekpahamId: string, purpose: "mic_test" | "answer") {
  const [text, setText] = useState("");
  const [available, setAvailable] = useState(true);
  const [pending, setPending] = useState(0);
  const textRef = useRef("");
  const pendingRef = useRef(0);
  const failures = useRef(0);
  const issued = useRef(0);
  const next = useRef(0);
  const done = useRef(new Map<number, string | null>());
  const epoch = useRef(0);

  const push = useCallback(
    (blob: Blob) => {
      if (pendingRef.current >= MAX_PENDING) return;
      const index = issued.current;
      issued.current += 1;
      const mine = epoch.current;
      pendingRef.current += 1;
      setPending(pendingRef.current);

      void (async () => {
        let chunk: string | null = null;
        try {
          const result = await transcribeCekPahamChunk(cekpahamId, blob, purpose);
          if (result.ok) chunk = result.text;
        } catch {
          // dihitung gagal di bawah
        }
        if (mine !== epoch.current) return;
        pendingRef.current -= 1;
        setPending(pendingRef.current);
        if (chunk === null) {
          failures.current += 1;
          if (failures.current >= MAX_FAILURES) setAvailable(false);
        } else {
          failures.current = 0;
        }
        done.current.set(index, chunk);
        const committed = commitReady(done.current, next.current, textRef.current);
        next.current = committed.next;
        if (committed.text !== textRef.current) {
          textRef.current = committed.text;
          setText(committed.text);
        }
      })();
    },
    [cekpahamId, purpose],
  );

  const reset = useCallback(() => {
    epoch.current += 1;
    textRef.current = "";
    pendingRef.current = 0;
    failures.current = 0;
    issued.current = 0;
    next.current = 0;
    done.current.clear();
    setText("");
    setPending(0);
    setAvailable(true);
  }, []);

  return { text, available, pending, push, reset, getText: () => textRef.current };
}
