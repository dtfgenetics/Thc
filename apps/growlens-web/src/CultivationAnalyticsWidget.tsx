import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildCultivationAnalytics,
  createPlantAnalyticsCsv,
  type CultivationAnalytics,
  type GroupCultivationAnalytics,
  type PlantCultivationAnalytics,
} from './cultivationAnalytics';
import { loadState, STATE_SAVED_EVENT } from './storage';

type Tab = 'overview' | 'plants' | 'cultivars' | 'cycles' | 'spaces';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'plants', label: 'Plants' },
  { id: 'cultivars', label: 'Cultivars' },
  { id: 'cycles', label: 'Cycles' },
  { id: 'spaces', label: 'Spaces' },
];

function formatNumber(value: number | null, suffix = '', decimals = 1): string {
  return value === null ? '—' : `${value.toFixed(decimals).replace(/\.0$/, '')}${suffix}`;
}

function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <article className="analytics-metric"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</article>;
}

function AnalyticsSection({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return <section className="analytics-section"><header><h3>{title}</h3><p>{detail}</p></header>{children}</section>;
}

function GroupTable({ records, emptyLabel }: { records: GroupCultivationAnalytics[]; emptyLabel: string }) {
  const maximumYield = Math.max(1, ...records.map((record) => record.totalTrimmedWeightG));
  if (records.length === 0) return <div className="empty-state"><strong>{emptyLabel}</strong><span>Add plants and structured records to populate this comparison.</span></div>;
  return <div className="analytics-group-list">{records.map((record) => <article className="analytics-group" key={record.id}>
    <div className="analytics-group-heading"><div><strong>{record.label}</strong><span>{record.plants} plant{record.plants === 1 ? '' : 's'} · {record.activePlants} active · {record.harvestedPlants} harvested</span></div><b>{formatNumber(record.totalTrimmedWeightG, ' g')}</b></div>
    <div className="analytics-bar" aria-label={`${record.label} trimmed weight ${record.totalTrimmedWeightG} grams`}><span style={{ width: `${Math.max(2, (record.totalTrimmedWeightG / maximumYield) * 100)}%` }} /></div>
    <dl><div><dt>Applied</dt><dd>{formatNumber(record.appliedLiters, ' L')}</dd></div><div><dt>Irrigations</dt><dd>{record.irrigationEvents}</dd></div><div><dt>Feeds</dt><dd>{record.feedingEvents}</dd></div><div><dt>Avg runoff</dt><dd>{formatNumber(record.averageRunoffPercent, '%')}</dd></div><div><dt>Avg trimmed/harvest</dt><dd>{formatNumber(record.averageTrimmedWeightPerHarvestG, ' g')}</dd></div><div><dt>Outcomes resolved</dt><dd>{formatNumber(record.observationResolutionPercent, '%')}</dd></div></dl>
  </article>)}</div>;
}

function PlantRow({ plant }: { plant: PlantCultivationAnalytics }) {
  return <article className="analytics-plant-row">
    <header><div><strong>{plant.name}</strong><span>{plant.cultivar} · {plant.cycleName} · {plant.spaceName}</span></div><b>{plant.status}</b></header>
    <dl>
      <div><dt>Age</dt><dd>{plant.ageDays === null ? '—' : `${plant.ageDays} days`}</dd></div>
      <div><dt>Applied</dt><dd>{formatNumber(plant.appliedLiters, ' L')}</dd></div>
      <div><dt>Avg runoff</dt><dd>{formatNumber(plant.averageRunoffPercent, '%')}</dd></div>
      <div><dt>Input pH / EC</dt><dd>{formatNumber(plant.inputPh.average, '', 2)} / {formatNumber(plant.inputEcMsCm.average, '', 2)}</dd></div>
      <div><dt>Runoff pH / EC</dt><dd>{formatNumber(plant.runoffPh.average, '', 2)} / {formatNumber(plant.runoffEcMsCm.average, '', 2)}</dd></div>
      <div><dt>Latest feed</dt><dd>{formatNumber(plant.latestFeedPh, ' pH', 2)} · {formatNumber(plant.latestFeedEcMsCm, ' EC', 2)}</dd></div>
      <div><dt>Trimmed yield</dt><dd>{formatNumber(plant.trimmedWeightG, ' g')}</dd></div>
      <div><dt>Yield/day</dt><dd>{formatNumber(plant.yieldPerDayG, ' g')}</dd></div>
      <div><dt>Wet-to-dry loss</dt><dd>{formatNumber(plant.wetToDryLossPercent, '%')}</dd></div>
      <div><dt>Outcomes</dt><dd>{plant.resolvedOutcomes}/{plant.outcomes} resolved</dd></div>
    </dl>
  </article>;
}

export default function CultivationAnalyticsWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [state, setState] = useState(() => loadState());
  const [query, setQuery] = useState('');

  useEffect(() => {
    const refresh = () => setState(loadState());
    window.addEventListener(STATE_SAVED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STATE_SAVED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const analytics: CultivationAnalytics = useMemo(() => buildCultivationAnalytics(state), [state]);
  const filteredPlants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return analytics.plants;
    return analytics.plants.filter((plant) => `${plant.name} ${plant.cultivar} ${plant.cycleName} ${plant.spaceName} ${plant.status}`.toLowerCase().includes(normalized));
  }, [analytics.plants, query]);

  function overview(): ReactNode {
    const overall = analytics.overall;
    return <>
      <div className="analytics-metrics">
        <MetricCard label="Applied water" value={formatNumber(overall.totalAppliedLiters, ' L')} detail={`${overall.totalRunoffLiters} L measured runoff`} />
        <MetricCard label="Average runoff" value={formatNumber(overall.averageRunoffPercent, '%')} detail="Only records with measured runoff" />
        <MetricCard label="Feed mixes" value={String(overall.feedingEvents)} detail="Structured feeding events" />
        <MetricCard label="Trimmed yield" value={formatNumber(overall.totalTrimmedWeightG, ' g')} detail={`${overall.harvestEvents} harvest record${overall.harvestEvents === 1 ? '' : 's'}`} />
        <MetricCard label="Wet / dry" value={`${formatNumber(overall.totalWetWeightG, ' g')} / ${formatNumber(overall.totalDryWeightG, ' g')}`} />
        <MetricCard label="Waste/loss" value={formatNumber(overall.totalWasteWeightG, ' g')} />
        <MetricCard label="Active / harvested" value={`${overall.activePlants} / ${overall.harvestedPlants}`} />
        <MetricCard label="Outcomes resolved" value={formatNumber(overall.observationResolutionPercent, '%')} detail={`${overall.resolvedObservationCount} of ${analytics.overall.observationCount} observations`} />
      </div>
      <AnalyticsSection title="Cultivar comparison" detail="Grouped measured history. Differences may reflect age, phenotype, environment, treatment, or sample size—not cultivar alone.">
        <GroupTable records={analytics.cultivars.slice(0, 8)} emptyLabel="No cultivar analytics yet" />
      </AnalyticsSection>
    </>;
  }

  function plants(): ReactNode {
    return <AnalyticsSection title="Plant analytics" detail="Filter individual measured histories across irrigation, feed, harvest, and observation outcomes.">
      <div className="analytics-toolbar"><label>Search plants<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Plant, cultivar, cycle, space, or status" /></label><button className="secondary-button" type="button" onClick={() => downloadCsv(`growlens-plant-analytics-${new Date().toISOString().slice(0, 10)}.csv`, createPlantAnalyticsCsv(analytics))}>Download analytics CSV</button></div>
      <div className="analytics-plant-list">{filteredPlants.map((plant) => <PlantRow key={plant.plantId} plant={plant} />)}{filteredPlants.length === 0 ? <div className="empty-state"><strong>No matching plants</strong><span>Change the search or add structured records.</span></div> : null}</div>
    </AnalyticsSection>;
  }

  function groupTab(records: GroupCultivationAnalytics[], title: string, detail: string, emptyLabel: string): ReactNode {
    return <AnalyticsSection title={title} detail={detail}><GroupTable records={records} emptyLabel={emptyLabel} /></AnalyticsSection>;
  }

  let content: ReactNode;
  if (tab === 'plants') content = plants();
  else if (tab === 'cultivars') content = groupTab(analytics.cultivars, 'Cultivar analytics', 'Aggregates measured records by the cultivar text saved on each plant.', 'No cultivar analytics yet');
  else if (tab === 'cycles') content = groupTab(analytics.cycles, 'Cycle analytics', 'Compares plant counts, applied water, feed events, harvests, and outcomes by cycle.', 'No cycle analytics yet');
  else if (tab === 'spaces') content = groupTab(analytics.spaces, 'Grow-space analytics', 'Compares records grouped by the plant’s assigned grow space.', 'No grow-space analytics yet');
  else content = overview();

  return <>
    <button className="analytics-launcher" type="button" aria-label="Open cultivation analytics" onClick={() => { setState(loadState()); setOpen(true); }}><span aria-hidden="true">▥</span><strong>Analytics</strong></button>
    {open ? <div className="analytics-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section className="analytics-panel" role="dialog" aria-modal="true" aria-labelledby="analytics-title">
        <header className="analytics-header"><div><span className="eyebrow">Measured history, grouped carefully</span><h2 id="analytics-title">Cultivation analytics</h2><p>Descriptive summaries of saved records. These comparisons do not prove that a treatment, cultivar, or environment caused an outcome.</p></div><button className="account-close" type="button" aria-label="Close cultivation analytics" onClick={() => setOpen(false)}>×</button></header>
        <nav className="analytics-tabs" aria-label="Cultivation analytics sections">{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? 'active' : ''} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
        <div className="analytics-body">{content}</div>
      </section>
    </div> : null}
  </>;
}
