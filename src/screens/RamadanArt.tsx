// Éléments graphiques du Ramadan : lune (phases), ciel étoilé, lanternes, pluie d'étoiles.
import { useEffect, useRef } from 'preact/hooks';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Lune dont la partie éclairée vaut k (0 à 1), croissant qui grandit par la droite. */
export function Moon({ k, size, style, lit = '#F6DDB0', dark = 'rgba(255,255,255,.14)' }: { k: number; size?: number; style?: string; lit?: string; dark?: string }) {
  const r = 10, c = 12;
  const a = Math.abs(1 - 2 * k) * r, sweep = k < 0.5 ? 0 : 1;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={style} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill={dark} />
      {k >= 1 ? <circle cx={c} cy={c} r={r} fill={lit} />
        : k > 0 && <path d={`M${c} ${c - r} A${r} ${r} 0 0 1 ${c} ${c + r} A${a} ${r} 0 0 ${sweep} ${c} ${c - r}Z`} fill={lit} />}
    </svg>
  );
}

/** Ciel étoilé qui scintille, en fond d'un écran. */
export function Stars({ count = 90 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    let raf = 0, stars: { x: number; y: number; s: number; p: number; v: number }[] = [];
    const init = () => {
      const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1;
      cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0);
      stars = Array.from({ length: count }, () => ({ x: Math.random() * r.width, y: Math.random() * r.height * 0.8, s: Math.random() * 1.4 + 0.3, p: Math.random() * 6.28, v: Math.random() * 0.02 + 0.005 }));
    };
    const draw = () => {
      const r = cv.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      for (const st of stars) {
        st.p += st.v;
        ctx.globalAlpha = 0.35 + 0.65 * (reduceMotion() ? 0.7 : (Math.sin(st.p) + 1) / 2);
        ctx.fillStyle = '#F7F0E1';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.s, 0, 6.28); ctx.fill();
      }
      if (!reduceMotion()) raf = requestAnimationFrame(draw);
    };
    init(); draw();
    window.addEventListener('resize', init);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init); };
  }, []);
  return <canvas class="rw-sky" ref={ref} aria-hidden="true" />;
}

/** Lanterne (fanous) qui se balance. */
export function Lantern({ style, size = 44, delay = 0 }: { style: string; size?: number; delay?: number }) {
  return (
    <svg class="rw-lantern" style={`${style};animation-delay:${delay}s`} width={size} height={size * 3.4} viewBox="0 0 44 150">
      <line x1="22" y1="0" x2="22" y2="70" stroke="#E9B45F" stroke-width="1.2" />
      <path d="M14 70h16l-3 8H17z" fill="#C98F3A" />
      <path d="M12 78h20c3 0 5 3 5 7v32c0 6-6 12-15 12S7 123 7 117V85c0-4 2-7 5-7z" fill="#E9B45F" opacity=".95" />
      <path d="M13 86h18v28c0 4-4 8-9 8s-9-4-9-8z" fill="#FFE7B3" />
      <path d="M15 129h14l-3 7h-8z" fill="#C98F3A" />
    </svg>
  );
}

/** Pluie d'étoiles dorées (au moment de « Bismillah, je commence »). */
export function StarBurst() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext('2d')!;
    const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1;
    cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    const parts = Array.from({ length: 120 }, () => {
      const a = Math.random() * 6.28, v = Math.random() * 6 + 2;
      return { x: r.width / 2, y: r.height * 0.75, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, life: 1, s: Math.random() * 3 + 1.5, c: Math.random() < 0.7 ? '#E9B45F' : '#F7F0E1' };
    });
    let raf = 0;
    const frame = () => {
      ctx.clearRect(0, 0, r.width, r.height);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.012;
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = i * 1.2566 - 1.5708;
          ctx.lineTo(p.x + Math.cos(ang) * p.s * 2, p.y + Math.sin(ang) * p.s * 2);
          ctx.lineTo(p.x + Math.cos(ang + 0.628) * p.s * 0.8, p.y + Math.sin(ang + 0.628) * p.s * 0.8);
        }
        ctx.fill();
      }
      if (parts.some((p) => p.life > 0)) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas class="rw-burst" ref={ref} aria-hidden="true" />;
}
