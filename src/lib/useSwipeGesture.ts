import { useRef, useState, type TouchEvent } from 'react';
import { triggerAndroidHaptic } from './androidBridge';

export type SwipeDirection = 'left' | 'right' | 'down' | 'horizontal';

interface UseSwipeGestureOptions {
  direction: SwipeDirection;
  threshold?: number;
  edgeOnlyPx?: number;
  enabled?: boolean;
  onTrigger: (dir: 'left' | 'right' | 'down') => void;
}

export function useSwipeGesture({
  direction,
  threshold = 75,
  edgeOnlyPx,
  enabled = true,
  onTrigger,
}: UseSwipeGestureOptions) {
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    x: number;
    y: number;
    locked: boolean;
    ignore: boolean;
    hapticFired: boolean;
  } | null>(null);

  const reset = () => {
    dragRef.current = null;
    setIsDragging(false);
    setOffsetX(0);
    setOffsetY(0);
  };

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (!enabled || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (edgeOnlyPx !== undefined && touch.clientX > edgeOnlyPx) {
      dragRef.current = null;
      return;
    }
    const target = e.target as HTMLElement | null;
    const ignore = Boolean(target?.closest('input, textarea, select, [data-no-swipe="true"]'));
    dragRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      locked: false,
      ignore,
      hapticFired: false,
    };
  };

  const onTouchMove = (e: TouchEvent<HTMLElement>) => {
    const start = dragRef.current;
    if (!enabled || !start || start.ignore || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;

    const isVertical = direction === 'down';
    if (!start.locked) {
      if (isVertical) {
        if (dy > 10 && dy > Math.abs(dx) * 1.15) {
          start.locked = true;
          setIsDragging(true);
        } else if (Math.abs(dx) > 10 || dy < -10) {
          start.ignore = true;
          return;
        } else {
          return;
        }
      } else {
        const validDir =
          direction === 'horizontal'
            ? Math.abs(dx) > 10
            : direction === 'left'
              ? dx < -10
              : dx > 10;
        if (validDir && Math.abs(dx) > Math.abs(dy) * 1.15) {
          start.locked = true;
          setIsDragging(true);
        } else if (Math.abs(dy) > 10 || (direction === 'left' && dx > 10) || (direction === 'right' && dx < -10)) {
          start.ignore = true;
          return;
        } else {
          return;
        }
      }
    }

    if (isVertical) {
      const clampedY = Math.max(0, dy);
      if (!start.hapticFired && clampedY >= threshold) {
        start.hapticFired = true;
        triggerAndroidHaptic();
      }
      setOffsetY(clampedY);
    } else {
      const clampedX =
        direction === 'left'
          ? Math.min(0, dx)
          : direction === 'right'
            ? Math.max(0, dx)
            : Math.max(-140, Math.min(140, dx));
      if (!start.hapticFired && Math.abs(clampedX) >= threshold) {
        start.hapticFired = true;
        triggerAndroidHaptic();
      }
      setOffsetX(clampedX);
    }
  };

  const onTouchEnd = () => {
    const start = dragRef.current;
    const curX = offsetX;
    const curY = offsetY;
    reset();
    if (!enabled || !start || start.ignore || !start.locked) return;

    if (direction === 'down' && curY >= threshold) {
      onTrigger('down');
    } else if (direction === 'left' && curX <= -threshold) {
      onTrigger('left');
    } else if (direction === 'right' && curX >= threshold) {
      onTrigger('right');
    } else if (direction === 'horizontal') {
      if (curX <= -threshold) onTrigger('left');
      else if (curX >= threshold) onTrigger('right');
    }
  };

  return {
    offsetX,
    offsetY,
    isDragging,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset,
    },
  };
}

/**
 * Interactive horizontal swipe hook for segmented capsule navbars.
 * Tracks live finger offset (with edge resistance) and computes a continuous
 * `visualIndex` so the capsule pill indicator glides smoothly with the gesture.
 */
export function useCapsuleSwipe(
  count: number,
  activeIndex: number,
  onSelectIndex: (nextIndex: number) => void,
  viewportWidth = 340
) {
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; locked: boolean; ignore: boolean } | null>(null);

  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    const ignore = Boolean(
      target?.closest('input[type="range"], input, textarea, select, [data-no-tab-swipe]')
    );
    dragRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      locked: false,
      ignore,
    };
  };

  const onTouchMove = (e: TouchEvent<HTMLElement>) => {
    const start = dragRef.current;
    if (!start || start.ignore || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;

    if (!start.locked) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.25) {
        start.locked = true;
        setIsDragging(true);
      } else if (Math.abs(dy) > 12) {
        start.ignore = true;
        return;
      } else {
        return;
      }
    }

    const atStartEdge = activeIndex === 0 && dx > 0;
    const atEndEdge = activeIndex === count - 1 && dx < 0;
    const damped = atStartEdge || atEndEdge ? dx * 0.28 : dx;
    setDragOffsetPx(Math.max(-viewportWidth * 0.6, Math.min(viewportWidth * 0.6, damped)));
  };

  const finish = () => {
    const start = dragRef.current;
    dragRef.current = null;
    if (start?.locked) {
      if (dragOffsetPx < -52 && activeIndex < count - 1) {
        onSelectIndex(activeIndex + 1);
      } else if (dragOffsetPx > 52 && activeIndex > 0) {
        onSelectIndex(activeIndex - 1);
      }
    }
    setDragOffsetPx(0);
    setIsDragging(false);
  };

  const visualIndex = Math.max(
    0,
    Math.min(count - 1, activeIndex + (isDragging ? -dragOffsetPx / viewportWidth : 0))
  );

  return {
    dragOffsetPx,
    isDragging,
    visualIndex,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd: finish,
      onTouchCancel: finish,
    },
  };
}
