import { useEffect, useState } from 'react';
import { getServiceDetail } from '../lib/toolsApi';
import type { ServiceDetailRecord, ServiceSummary } from '../types/agentics';
import { ErrorState } from './ErrorState';

interface ServiceDetailProps {
  service: ServiceSummary | null;
}

const renderRaw = (raw: unknown) => JSON.stringify(raw, null, 2);

export function ServiceDetail({ service }: ServiceDetailProps) {
  const [detail, setDetail] = useState<ServiceDetailRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!service) {
      setDetail(null);
      setErrorMessage('');
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setErrorMessage('');

    getServiceDetail(service.name, controller.signal)
      .then(setDetail)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setDetail(null);
        setErrorMessage(error instanceof Error ? error.message : 'Could not load service detail.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [service]);

  if (!service) {
    return (
      <aside className="detail-panel detail-panel-empty">
        <span className="eyebrow">Details</span>
        <h2>Select a service</h2>
        <p>Choose any card to call GET /services/name and inspect live metadata.</p>
      </aside>
    );
  }

  if (loading) {
    return (
      <aside className="detail-panel">
        <span className="eyebrow">Loading detail</span>
        <h2>{service.displayName}</h2>
        <div className="skeleton-lines" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </aside>
    );
  }

  if (errorMessage) {
    return (
      <aside className="detail-panel">
        <ErrorState title={`Could not load ${service.displayName}`} message={errorMessage} />
      </aside>
    );
  }

  const current = detail || service;
  const optionalDetail = current as Partial<ServiceDetailRecord>;

  const endpoints = Array.isArray(optionalDetail.endpoints) ? optionalDetail.endpoints : [];
  const ports = Array.isArray(optionalDetail.ports) ? optionalDetail.ports : [];
  const dependencies = Array.isArray(optionalDetail.dependencies) ? optionalDetail.dependencies : [];

  return (
    <aside className="detail-panel">
      <div className="detail-title">
        <div>
          <span className="eyebrow">Service detail</span>
          <h2>{current.displayName}</h2>
        </div>
        <span className={`status-dot status-${current.status}`} />
      </div>

      <dl className="detail-list">
        <div>
          <dt>Name</dt>
          <dd>{current.name}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{current.status}</dd>
        </div>
        <div>
          <dt>Exposure</dt>
          <dd>{current.exposure}</dd>
        </div>
        <div>
          <dt>Image</dt>
          <dd>{current.image || 'Not reported'}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{current.version || 'Not reported'}</dd>
        </div>
      </dl>

      {endpoints.length > 0 ? (
        <section className="detail-section">
          <h3>Endpoints</h3>
          <div className="endpoint-list">
            {endpoints.map((endpoint) => (
              <a href={endpoint.url} target="_blank" rel="noreferrer" key={`${endpoint.label}-${endpoint.url}`}>
                <strong>{endpoint.label}</strong>
                <span>{endpoint.url}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {ports.length > 0 ? (
        <section className="detail-section">
          <h3>Ports</h3>
          <div className="tag-row">
            {ports.map((port) => (
              <span className="tag" key={String(port)}>
                {port}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {dependencies.length > 0 ? (
        <section className="detail-section">
          <h3>Dependencies</h3>
          <div className="tag-row">
            {dependencies.map((dependency) => (
              <span className="tag" key={dependency}>
                {dependency}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="detail-section">
        <h3>Raw API payload</h3>
        <pre className="raw-json">{renderRaw(detail?.raw ?? service.raw)}</pre>
      </section>
    </aside>
  );
}
