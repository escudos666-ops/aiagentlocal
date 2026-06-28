import { isSensitiveServiceName } from '../config/services';
import type { ServiceSummary } from '../types/agentics';

interface ServiceCardProps {
  service: ServiceSummary;
  selected: boolean;
  onSelect: (name: string) => void;
}

export function ServiceCard({ service, selected, onSelect }: ServiceCardProps) {
  const isSensitive = isSensitiveServiceName(service.name);
  const canLaunch = Boolean(service.url) && !isSensitive;

  return (
    <article className={`service-card ${selected ? 'service-card-selected' : ''}`}>
      <div className="service-card-main">
        <div>
          <div className="service-title-row">
            <span className={`status-dot status-${service.status}`} />
            <h3>{service.displayName}</h3>
          </div>
          <p>{service.description || service.image || 'No description reported by API yet.'}</p>
        </div>

        <span className={`pill pill-${service.exposure}`}>
          {service.exposure === 'user-facing' ? 'User app' : service.exposure}
        </span>
      </div>

      <dl className="service-facts">
        <div>
          <dt>Status</dt>
          <dd>{service.status}</dd>
        </div>
        <div>
          <dt>URL / Port</dt>
          <dd>{service.url || service.port || 'Not reported'}</dd>
        </div>
      </dl>

      {service.tags.length > 0 ? (
        <div className="tag-row">
          {service.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="service-actions">
        <button className="button button-secondary" type="button" onClick={() => onSelect(service.name)}>
          {selected ? 'Selected' : 'Details'}
        </button>

        {canLaunch ? (
          <a className="button button-primary" href={service.url} target="_blank" rel="noreferrer">
            Launch
          </a>
        ) : (
          <span className="muted-action">{isSensitive ? 'Internal only' : 'No URL'}</span>
        )}
      </div>
    </article>
  );
}
