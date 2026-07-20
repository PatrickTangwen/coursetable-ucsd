import PageStatus from '../components/PageStatus';

function NotFound() {
  return (
    <PageStatus
      title="Page not found"
      message="The page you're looking for doesn't exist or may have been moved."
    />
  );
}

export default NotFound;
