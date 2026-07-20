import NotFoundImage from '../images/page_not_found.png';
import styles from './PageStatus.module.css';

interface PageStatusProps {
  readonly title: string;
  readonly message: string;
}

function PageStatus({ title, message }: PageStatusProps) {
  return (
    <main className={styles.container}>
      <img
        alt="A paper plane flying out of an open folder"
        className={styles.illustration}
        src={NotFoundImage}
      />
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
    </main>
  );
}

export function DataLoadErrorPage() {
  return (
    <PageStatus
      title="Unable to load this page"
      message="We couldn't load the data for this page. Reload the page to try again."
    />
  );
}

export default PageStatus;
