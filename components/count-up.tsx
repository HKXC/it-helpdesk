'use client';
import { useEffect, useRef, useState } from 'react';

// Animates a number from its previous value to the new one. Skips animation when
// the user prefers reduced motion.
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now(),
      a = from.current,
      b = value;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (b - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = b;
    };
  }, [value, duration]);
  return <>{shown}</>;
}
