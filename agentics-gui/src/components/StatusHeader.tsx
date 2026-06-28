import type { HealthResult, ServiceSummary } from '../types/agentics';

interface StatusHeaderProps {
  health: HealthResult | null;
  services: ServiceSummary[];
  loading: boolean;
  onRefresh: () => void;
}

const countByStatus = (services: ServiceSummary[], status: ServiceSummary['status']) =>
  services.filter((service) => service.status === status).length;

export function StatusHeader({ health, services, loading, onRefresh }: StatusHeaderProps) {
  const online = countByStatus(services, 'online');
  const degraded = countByStatus(services, 'degraded');
  const offline = countByStatus(services, 'offline');
  const unknown = countByStatus(services, 'unknown');
  const lastChecked = health?.checkedAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(health.checkedAt))
    : 'Not checked yet';

  return (
    <header className="status-header">
      <div className="status-hero">
        <span className="eyebrow">Agentics Docker Stack</span>
        <h1>Control Center</h1>
        <p>
          Operational dashboard for local services, health checks, and admin consoles.
        </p>
      </div>

      <div className="health-card">
        <div className="health-card-top">
          <span className={`status-dot status-${health?.status ?? 'unknown'}`} />
          <div>
            <strong>{health?.ok ? 'Tools API online' : 'Tools API offline'}</strong>
            <span>{health?.message ?? 'Waiting for first health check'}</span>
          </div>
        </div>
        <div className="health-meta">
          <span>Last checked: {lastChecked}</span>
          <button className="button button-primary" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <dl className="metric-grid" aria-label="Service status summary">
        <div className="metric-card">
          <dt>Online</dt>
          <dd>{online}</dd>
        </div>
        <div className="metric-card">
          <dt>Degraded</dt>
          <dd>{degraded}</dd>
        </div>
        <div className="metric-card">
          <dt>Offline</dt>
          <dd>{offline}</dd>
        </div>
        <div className="metric-card">
          <dt>Unknown</dt>
          <dd>{unknown}</dd>
        </div>
      </dl>
    </header>
  );
}
