import logo from '../../images/brand/bluebook.svg';
import styles from './Logo.module.css';

function Logo({
  icon = false,
  wordmark = true,
}: {
  readonly icon?: boolean;
  readonly wordmark?: boolean;
}) {
  return (
    <span className={styles.ucsdLogo}>
      {icon && <img src={logo} alt="" className={styles.ucsdLogoImg} />}{' '}
      {wordmark && (
        <span className={styles.ucsdLogoWordmark}>UCSD Course Planner</span>
      )}
    </span>
  );
}

export default Logo;
