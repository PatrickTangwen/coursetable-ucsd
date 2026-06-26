import styles from './Logo.module.css';

function Logo() {
  return (
    <span className={styles.logo}>
      <span className={styles.sun}>Sun</span>
      <span className={styles.grid}>Grid</span>
    </span>
  );
}

export default Logo;
