"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Apakah elemen yang bisa digulir mendatar masih punya isi di kiri atau kanan. Dipakai untuk
 * menampilkan petunjuk geser pada toolbar yang terpotong di layar sempit.
 */
export function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const start = node.scrollLeft > 4;
    const end = node.scrollLeft + node.clientWidth < node.scrollWidth - 4;
    setEdges((current) =>
      current.start === start && current.end === end ? current : { start, end },
    );
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  const scrollBy = useCallback((direction: 1 | -1) => {
    const node = ref.current;
    node?.scrollBy({ left: direction * Math.max(160, node.clientWidth * 0.6), behavior: "smooth" });
  }, []);

  return { ref, edges, scrollBy };
}
