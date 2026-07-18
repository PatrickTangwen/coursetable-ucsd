import { useLayoutEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './FitFigure.module.css';

// Demo figures are fixed-intrinsic-size "screenshots" of the desktop UI. Each
// one is scaled to exactly fill its column so it behaves like an image instead
// of reflowing or truncating like a responsive layout. Use a transform instead
// of CSS zoom: Safari applies zoom during layout and can round the demo's small
// fixed columns and fonts differently, which makes their contents overlap.
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
      fig.style.setProperty('--figure-scale', String(scale));
      wrap.style.height = `${fig.offsetHeight * scale}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    observer.observe(fig);
    document.fonts.ready.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={wrapRef} className={clsx(styles.wrap, className)}>
      <div ref={figRef} className={styles.fig} style={{ width }}>
        {children}
      </div>
    </div>
  );
}
