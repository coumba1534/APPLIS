// Petits éléments partagés : messages éphémères (toast) et icônes de navigation.
import { useEffect, useState } from 'preact/hooks';

let setMsg: ((m: string | null) => void) | null = null;
let timer: number | undefined;

export function toast(message: string) {
  setMsg?.(message);
  clearTimeout(timer);
  timer = window.setTimeout(() => setMsg?.(null), 2600);
}

export function Toast() {
  const [msg, set] = useState<string | null>(null);
  useEffect(() => { setMsg = set; return () => { setMsg = null; }; }, []);
  return msg ? <div class="toast" role="status">{msg}</div> : null;
}

export const icons = {
  today: <svg viewBox="0 0 24 24"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" /></svg>,
  read: <svg viewBox="0 0 24 24"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z" /><path d="M12 6.5v13" /></svg>,
  plan: <svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  group: <svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><circle cx="17" cy="8" r="2.5" /><path d="M16 13.6c2.4 0 4 1.4 4.5 4" /></svg>,
  bell: <svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>,
};
