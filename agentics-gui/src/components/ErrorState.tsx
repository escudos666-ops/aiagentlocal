interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something needs attention',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <section className="error-state" role="alert">
      <div>
        <span className="eyebrow">Error</span>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button className="button button-secondary" type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </section>
  );
}
