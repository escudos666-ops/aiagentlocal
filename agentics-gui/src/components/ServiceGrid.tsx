import { ServiceCard } from './ServiceCard';
import type { ServiceExposure, ServiceSummary } from '../types/agentics';

interface ServiceGridProps {
  services: ServiceSummary[];
  selectedName?: string;
  onSelect: (name: string) => void;
}

const groupLabels: Record<ServiceExposure, string> = {
  'user-facing': 'User-facing services',
  ops: 'Operations services',
  internal: 'Internal-only services',
};

export function ServiceGrid({ services, selectedName, onSelect }: ServiceGridProps) {
  if (services.length === 0) {
    return (
      <section className="empty-state">
        <span className="eyebrow">No services</span>
        <h2>The tools API returned an empty service list.</h2>
        <p>
          Check the output of the PowerShell `/services` command and confirm the
          Docker stack is exposing service metadata.
        </p>
      </section>
    );
  }

  const exposures: ServiceExposure[] = ['user-facing', 'ops', 'internal'];

  return (
    <section className="service-grid-wrap" aria-label="Services">
      {exposures.map((exposure) => {
        const group = services.filter((service) => service.exposure === exposure);
        if (group.length === 0) return null;

        return (
          <div className="service-group" key={exposure}>
            <div className="section-heading compact">
              <span className="eyebrow">{group.length} detected</span>
              <h2>{groupLabels[exposure]}</h2>
            </div>

            <div className="service-grid">
              {group.map((service) => (
                <ServiceCard
                  key={`${service.exposure}-${service.name}`}
                  service={service}
                  selected={selectedName === service.name}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
