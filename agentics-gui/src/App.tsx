import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardControls,
  type ExposureFilter,
  type SortMode,
  type StatusFilter,
} from './components/DashboardControls';
import { AgentChat } from './components/AgentChat';
import { ErrorState } from './components/ErrorState';
import { QuickLinks } from './components/QuickLinks';
import { ServiceDetail } from './components/ServiceDetail';
import { ServiceGrid } from './components/ServiceGrid';
import { StatusHeader } from './components/StatusHeader';
import { getHealth, getServices } from './lib/toolsApi';
import type { HealthResult, ServiceSummary } from './types/agentics';

export default function App() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [exposureFilter, setExposureFilter] = useState<ExposureFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('grouped');
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);

  const filteredServices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const statusPriority: Record<ServiceSummary['status'], number> = {
      offline: 0,
      degraded: 1,
      unknown: 2,
      online: 3,
    };

    return services
      .filter((service) => {
        if (showIssuesOnly && service.status === 'online') return false;
        if (statusFilter !== 'all' && service.status !== statusFilter) return false;
        if (exposureFilter !== 'all' && service.exposure !== exposureFilter) return false;
        if (!normalizedQuery) return true;

        const searchable = [
          service.name,
          service.displayName,
          service.status,
          service.exposure,
          service.description,
          service.url,
          service.port,
          service.host,
          service.image,
          service.version,
          ...service.tags,
        ]
          .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (sortMode === 'name') return a.displayName.localeCompare(b.displayName);
        if (sortMode === 'status') {
          return statusPriority[a.status] - statusPriority[b.status] || a.displayName.localeCompare(b.displayName);
        }

        return 0;
      });
  }, [exposureFilter, query, services, showIssuesOnly, sortMode, statusFilter]);

  const selectedService = useMemo(
    () => services.find((service) => service.name === selectedName) ?? null,
    [selectedName, services],
  );

  const refresh = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setErrorMessage('');

    try {
      const [healthResult, servicesResult] = await Promise.all([
        getHealth(controller.signal),
        getServices(controller.signal),
      ]);

      setHealth(healthResult);
      setServices(servicesResult);

      setSelectedName((current) => {
        if (current && servicesResult.some((service) => service.name === current)) {
          return current;
        }

        return servicesResult[0]?.name;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load services.');
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const interval = window.setInterval(() => {
      void refresh();
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [autoRefresh, refresh]);

  useEffect(() => {
    setSelectedName((current) => {
      if (current && filteredServices.some((service) => service.name === current)) return current;
      return filteredServices[0]?.name;
    });
  }, [filteredServices]);

  const clearFilters = useCallback(() => {
    setQuery('');
    setStatusFilter('all');
    setExposureFilter('all');
    setSortMode('grouped');
    setShowIssuesOnly(false);
  }, []);

  const copySummary = useCallback(async () => {
    const lines = [
      `Agentics stack summary (${new Date().toLocaleString()})`,
      `Tools API: ${health?.message ?? 'Not checked yet'}`,
      '',
      ...services.map((service) => {
        const endpoint = service.url || service.port || 'no endpoint reported';
        return `- ${service.displayName}: ${service.status} (${service.exposure}) — ${endpoint}`;
      }),
    ];

    const summary = lines.join('\n');

    try {
      await navigator.clipboard.writeText(summary);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = summary;
      textArea.setAttribute('readonly', 'true');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [health?.message, services]);

  return (
    <main className="app-shell">
      <StatusHeader health={health} services={services} loading={loading} onRefresh={refresh} />

      <DashboardControls
        query={query}
        statusFilter={statusFilter}
        exposureFilter={exposureFilter}
        sortMode={sortMode}
        showIssuesOnly={showIssuesOnly}
        autoRefresh={autoRefresh}
        totalCount={services.length}
        filteredCount={filteredServices.length}
        copied={copied}
        services={services}
        onQueryChange={setQuery}
        onStatusFilterChange={setStatusFilter}
        onExposureFilterChange={setExposureFilter}
        onSortModeChange={setSortMode}
        onShowIssuesOnlyChange={setShowIssuesOnly}
        onAutoRefreshChange={setAutoRefresh}
        onClearFilters={clearFilters}
        onCopySummary={copySummary}
      />

      <AgentChat />

      {errorMessage ? (
        <ErrorState
          title="Could not load stack services"
          message={errorMessage}
          onRetry={refresh}
        />
      ) : null}

      <div className="dashboard-layout">
        <section className="dashboard-main">
          {loading && services.length === 0 ? (
            <section className="loading-card" aria-label="Loading services">
              <span className="eyebrow">Loading</span>
              <h2>Reading Agentics services...</h2>
              <div className="skeleton-grid" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            </section>
          ) : filteredServices.length === 0 && services.length > 0 ? (
            <section className="empty-state">
              <span className="eyebrow">No matches</span>
              <h2>No services match the current filters.</h2>
              <p>Clear filters or broaden your search to bring services back into view.</p>
              <button className="button button-secondary" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </section>
          ) : (
            <ServiceGrid
              services={filteredServices}
              selectedName={selectedName}
              onSelect={setSelectedName}
            />
          )}
        </section>

        <ServiceDetail service={selectedService} />
      </div>

      <QuickLinks />
    </main>
  );
}
