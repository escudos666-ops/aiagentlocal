import type { ServiceExposure, ServiceStatus, ServiceSummary } from '../types/agentics';

export type StatusFilter = 'all' | ServiceStatus;
export type ExposureFilter = 'all' | ServiceExposure;
export type SortMode = 'grouped' | 'name' | 'status';

interface DashboardControlsProps {
  query: string;
  statusFilter: StatusFilter;
  exposureFilter: ExposureFilter;
  sortMode: SortMode;
  showIssuesOnly: boolean;
  autoRefresh: boolean;
  totalCount: number;
  filteredCount: number;
  copied: boolean;
  services: ServiceSummary[];
  onQueryChange: (query: string) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
  onExposureFilterChange: (exposure: ExposureFilter) => void;
  onSortModeChange: (sortMode: SortMode) => void;
  onShowIssuesOnlyChange: (showIssuesOnly: boolean) => void;
  onAutoRefreshChange: (autoRefresh: boolean) => void;
  onClearFilters: () => void;
  onCopySummary: () => void;
}

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'offline', label: 'Offline' },
  { value: 'unknown', label: 'Unknown' },
];

const exposureLabels: Record<ExposureFilter, string> = {
  all: 'All exposures',
  'user-facing': 'User-facing',
  ops: 'Operations',
  internal: 'Internal',
};

const sortLabels: Record<SortMode, string> = {
  grouped: 'Default grouping',
  name: 'Name A-Z',
  status: 'Health priority',
};

const countStatus = (services: ServiceSummary[], status: ServiceStatus) =>
  services.filter((service) => service.status === status).length;

export function DashboardControls({
  query,
  statusFilter,
  exposureFilter,
  sortMode,
  showIssuesOnly,
  autoRefresh,
  totalCount,
  filteredCount,
  copied,
  services,
  onQueryChange,
  onStatusFilterChange,
  onExposureFilterChange,
  onSortModeChange,
  onShowIssuesOnlyChange,
  onAutoRefreshChange,
  onClearFilters,
  onCopySummary,
}: DashboardControlsProps) {
  const offline = countStatus(services, 'offline');
  const degraded = countStatus(services, 'degraded');
  const unknown = countStatus(services, 'unknown');
  const hasActiveFilters =
    Boolean(query.trim()) || statusFilter !== 'all' || exposureFilter !== 'all' || sortMode !== 'grouped' || showIssuesOnly;

  return (
    <section className="control-panel" aria-label="Dashboard controls">
      <div className="control-panel-heading">
        <div>
          <span className="eyebrow">Command bar</span>
          <h2>Filter, focus, and export your stack</h2>
          <p>
            Showing {filteredCount} of {totalCount} services. Issues: {offline} offline, {degraded} degraded, {unknown} unknown.
          </p>
        </div>
        <div className="control-actions">
          <button className="button button-secondary" type="button" onClick={onCopySummary}>
            {copied ? 'Copied summary' : 'Copy summary'}
          </button>
          <button className="button button-secondary" type="button" onClick={onClearFilters} disabled={!hasActiveFilters}>
            Clear filters
          </button>
        </div>
      </div>

      <div className="control-grid">
        <label className="control-field control-search">
          <span>Search services</span>
          <input
            type="search"
            value={query}
            placeholder="Try ollama, minio, graphql, offline..."
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <label className="control-field">
          <span>Exposure</span>
          <select value={exposureFilter} onChange={(event) => onExposureFilterChange(event.target.value as ExposureFilter)}>
            {(Object.keys(exposureLabels) as ExposureFilter[]).map((exposure) => (
              <option value={exposure} key={exposure}>
                {exposureLabels[exposure]}
              </option>
            ))}
          </select>
        </label>

        <label className="control-field">
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => onSortModeChange(event.target.value as SortMode)}>
            {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
              <option value={mode} key={mode}>
                {sortLabels[mode]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="filter-row" aria-label="Status filters">
        {statusFilters.map((filter) => (
          <button
            className={`filter-chip ${statusFilter === filter.value ? 'filter-chip-active' : ''}`}
            type="button"
            onClick={() => onStatusFilterChange(filter.value)}
            key={filter.value}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="toggle-row">
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={showIssuesOnly}
            onChange={(event) => onShowIssuesOnlyChange(event.target.checked)}
          />
          <span>Focus only on non-online services</span>
        </label>
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(event) => onAutoRefreshChange(event.target.checked)}
          />
          <span>Auto-refresh every 30 seconds</span>
        </label>
      </div>
    </section>
  );
}