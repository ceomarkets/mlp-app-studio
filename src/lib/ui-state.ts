import { useSyncExternalStore } from "react";

/** Interruptor global (abrir/cerrar una ventana desde cualquier parte de la app). */
export function createToggle() {
  let open = false;
  const subs = new Set<() => void>();
  const set = (v: boolean) => {
    open = v;
    subs.forEach((s) => s());
  };
  const subscribe = (fn: () => void) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };
  return {
    open: () => set(true),
    close: () => set(false),
    set,
    use: () =>
      useSyncExternalStore(
        subscribe,
        () => open,
        () => false,
      ),
  };
}

export const cartUI = createToggle();
export const rewardsUI = createToggle();
export const authUI = createToggle();
export const toolsUI = createToggle();
