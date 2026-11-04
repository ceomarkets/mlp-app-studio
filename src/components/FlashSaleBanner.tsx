const pad = (n: number) => String(n).padStart(2, "0");

/** "1d 04 : 28 : 45" a partir de milisegundos restantes. */
export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const hms = `${pad(h)} : ${pad(m)} : ${pad(s % 60)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}
