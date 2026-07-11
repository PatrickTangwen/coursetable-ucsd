import NotFoundImage from '../images/page_not_found.png';
import styles from './NotFound.module.css';

function NotFound() {
  return (
    <div className={styles.container}>
      <img
        alt="A paper plane flying out of an open folder"
        className={styles.illustration}
        src={NotFoundImage}
      />
      <h3 className={styles.title}>Page not found</h3>
      <p className={styles.message}>
        The page you&rsquo;re looking for doesn&rsquo;t exist or may have been
        moved.
      </p>
    </div>
  );
}

export default NotFound;
