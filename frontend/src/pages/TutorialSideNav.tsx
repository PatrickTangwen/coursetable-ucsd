import { useEffect, useState } from 'react';
import styles from './TutorialSideNav.module.css';

// Floating "On this page" navigation for the tutorial. Tracks the heading
// currently in view and highlights its link, GraphQL-docs style. Hidden on
// viewports too narrow to fit it beside the 900px content column.
export default function TutorialSideNav({
  sections,
}: {
  readonly sections: readonly { id: string; label: string }[];
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // Active section = last heading that has scrolled past the top band.
      let current = sections[0]?.id;
      for (const { id } of sections) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 150) current = id;
        else break;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  return (
    <nav className={styles.sideNav} aria-label="Tutorial steps">
      <p className={styles.label}>On this page</p>
      <ul className={styles.list}>
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={activeId === id ? styles.active : undefined}
              aria-current={activeId === id ? 'true' : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
