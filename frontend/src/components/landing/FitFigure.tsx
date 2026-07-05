import { useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './FitFigure.module.css';

// Demo figures are fixed-intrinsic-size "screenshots" of the desktop UI. Each
// one is zoomed to exactly fill its column so it scales like an image instead
// of reflowing or truncating like a responsive layout.
export default function FitFigure({
  width,
  className,
  children,
}: {
  readonly width: number;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const fig = figRef.current;
    if (!wrap || !fig) return undefined;
    const fit = () => {
      const avail = wrap.clientWidth;
      if (!avail) return;
      const scale = Math.max(0.2, Math.min(1.8, avail / width));
      fig.style.setProperty('zoom', String(scale));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    document.fonts.ready.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={wrapRef} className={className}>
      <div ref={figRef} className={styles.fig} style={{ width }}>
        {children}
      </div>
    </div>
  );
}
