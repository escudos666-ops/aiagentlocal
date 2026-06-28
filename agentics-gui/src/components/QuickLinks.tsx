import { quickLinks } from '../config/services';
import type { ServiceExposure } from '../types/agentics';

const exposureLabels: Record<ServiceExposure, string> = {
  'user-facing': 'User-facing apps',
  ops: 'Operations consoles',
  internal: 'Internal admin tools',
};

const exposureDescriptions: Record<ServiceExposure, string> = {
  'user-facing': 'Apps you are most likely to use during agent workflows.',
  ops: 'Monitoring and service-operation tools.',
  internal: 'Admin-only tools. Keep these local and protected.',
};

export function QuickLinks() {
  const groups = (Object.keys(exposureLabels) as ServiceExposure[]).map((exposure) => ({
    exposure,
    links: quickLinks.filter((link) => link.exposure === exposure),
  }));

  return (
    <aside className="quick-links" aria-label="Quick launch links">
      <div className="section-heading">
        <span className="eyebrow">Launchpad</span>
        <h2>Quick links</h2>
      </div>

      {groups.map(({ exposure, links }) => (
        <section className={`quick-group quick-group-${exposure}`} key={exposure}>
          <div className="quick-group-heading">
            <h3>{exposureLabels[exposure]}</h3>
            <p>{exposureDescriptions[exposure]}</p>
          </div>

          <div className="quick-link-list">
            {links.map((link) => (
              <a
                className="quick-link"
                href={link.url}
                target="_blank"
                rel="noreferrer"
                key={link.key}
              >
                <span>
                  <strong>{link.label}</strong>
                  <small>{link.description}</small>
                </span>
                <em>{link.badge}</em>
              </a>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
