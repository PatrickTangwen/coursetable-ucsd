import clsx from 'clsx';
import styles from './Logo.module.css';

function Logo({ className }: { readonly className?: string }) {
  return (
    <span className={clsx(styles.logo, className)}>
      <span className={styles.sun}>Sun</span>
      <span className={styles.grid}>Grid</span>
    </span>
  );
}

export default Logo;
