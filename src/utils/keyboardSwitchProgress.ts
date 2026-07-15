export type SmoothProgressController = {
  start: (onUpdate: (value: number) => void) => void;
  setMilestone: (target: number) => void;
  complete: () => Promise<void>;
  stop: () => void;
};

export function createSmoothProgressController(): SmoothProgressController {
  let rafId = 0;
  let current = 0;
  let target = 0;
  let running = false;
  let onUpdate: ((value: number) => void) | null = null;

  const tick = () => {
    if (!running) return;
    const delta = target - current;
    const step = delta * 0.1;
    if (Math.abs(delta) < 0.2) {
      current = target;
    } else {
      current += step;
    }
    onUpdate?.(current);
    if (target < 90 && current >= target - 2) {
      target = Math.min(90, target + 0.12);
    }
    rafId = requestAnimationFrame(tick);
  };

  return {
    start(cb) {
      current = 0;
      target = 6;
      onUpdate = cb;
      running = true;
      onUpdate(0);
      rafId = requestAnimationFrame(tick);
    },
    setMilestone(nextTarget) {
      target = Math.max(target, Math.min(96, nextTarget));
    },
    complete() {
      return new Promise<void>((resolve) => {
        target = 100;
        const waitDone = () => {
          if (!running) {
            resolve();
            return;
          }
          if (current >= 99.6) {
            onUpdate?.(100);
            window.setTimeout(() => {
              running = false;
              cancelAnimationFrame(rafId);
              resolve();
            }, 320);
            return;
          }
          rafId = requestAnimationFrame(waitDone);
        };
        waitDone();
      });
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      onUpdate = null;
    },
  };
}
