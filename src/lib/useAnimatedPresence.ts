import { useEffect, useState } from 'react';

/**
 * Keeps a conditionally rendered overlay, drawer, modal, or option bar mounted
 * while its CSS exit animation plays, then unmounts cleanly.
 */
export function useAnimatedPresence(open: boolean, durationMs = 220): {
  mounted: boolean;
  closing: boolean;
} {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, mounted, durationMs]);

  return {
    mounted: open || mounted,
    closing: !open && mounted,
  };
}

/**
 * Retains the last non-null value during an exit animation so modals/popovers/toasts
 * driven by nullable state animate smoothly out before unmounting.
 */
export function useRetainedValue<T>(
  value: T | null,
  durationMs = 220
): {
  renderedValue: T | null;
  closing: boolean;
} {
  const [retained, setRetained] = useState<T | null>(value);

  useEffect(() => {
    if (value !== null) {
      setRetained(value);
      return;
    }
    if (retained === null) return;
    const timer = window.setTimeout(() => {
      setRetained(null);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [value, retained, durationMs]);

  return {
    renderedValue: value !== null ? value : retained,
    closing: value === null && retained !== null,
  };
}
