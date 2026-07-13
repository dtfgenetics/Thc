import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { calculateVpdKpa, round } from './calculations';
import {
  buildPlantTimeline,
  calculateCalibration,
  createGrowLensCsvExports,
  createPrintableReport,
  environmentStats,
  summarizeReport,
  type CalibrationSample,
  type NumericStats,
} from './reporting';
import {
  createId,
  loadState,
  saveState,
  STATE_SAVED_EVENT,
} from './storage';
import type { GrowLensState } from './types';

type ReportTab = 'overview' | 'environment' | 'timeline' | 'calibration' | 'exports';

const tabs: Array<{ id: ReportTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'environment', label: 'Environment' },
  { id: 'timeline', label: 'Plant timeline' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'exports', label: 'Exports' },
];

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function downloadText(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function StatsCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <article className="reports-stat"><span>{label}</span><strong>{value}</strong>{detail ? <small>{detail}</small> : null}</article>;
}

function statsText(stats: NumericStats | null, suffix: string): string {
  if (!stats) return 'No readings';
  return `${round(stats.minimum, 1)}–${round(stats.maximum, 1)}${suffix}`;
}

function TrendChart({ values, label, suffix }: { values: number[]; label: string; suffix: string }) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length < 2) {
    return <div className="reports-chart-empty">Record at least two readings to chart {label.toLowerCase()}.</div>;
  }

  const minimum = Math.min(...valid);
  const maximum = Math.max(...valid);
  const range = maximum - minimum || 1;
  const points = valid.map((value, index) => {
    const x = (index / (valid.length - 1)) * 100;
    const y = 90 - (((value - minimum) / range) * 72);
    return `${x},${y}`;
  }).join(' ');

  return (
    <figure className="reports-chart">
      <figcaption><strong>{label}</strong><span>{round(minimum, 1)}–{round(maximum, 1)}{suffix}</span></figcaption>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${label} trend`}>
        <line x1="0" y1="18" x2="100" y2="18" />
        <line x1="0" y1="54" x2="100" y2="54" />
        <line x1="0" y1="90" x2="100" y2="90" />
        <polyline points={points} />
      </svg>
    </figure>
  );
}

function PanelSection({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  return <section className="reports-section"><div className="reports-section-heading"><div><h3>{title}</h3>{detail ? <p>{detail}</p> : null}</div></div>{children}</section>;
}

export default function ReportsHistoryWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<ReportTab>('overview');
  const [state, setState] = useState<GrowLensState>(() => loadState());
  const [spaceId, setSpaceId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [calibrationName, setCalibrationName] = useState('');
  const [fixture, setFixture] = useState('');
  const [samples, setSamples] = useState<CalibrationSample[]>([
    { lux: 40_000, ppfd: 600 },
    { lux: 40_000, ppfd: 600 },
    { lux: 40_000, ppfd: 600 },
  ]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) setState(loadState());
  }, [open]);

  useEffect(() => {
    const refresh = () => setState(loadState());
    window.addEventListener(STATE_SAVED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STATE_SAVED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const summary = useMemo(() => summarizeReport(state), [state]);
  const filteredReadings = useMemo(
    () => [...state.readings]
      .filter((reading) => !spaceId || reading.spaceId === spaceId)
      .sort((first, second) => first.createdAt.localeCompare(second.createdAt)),
    [spaceId, state.readings],
  );
  const environment = useMemo(() => environmentStats(filteredReadings), [filteredReadings]);
  const selectedPlantId = plantId || state.plants[0]?.id || '';
  const timeline = useMemo(
    () => selectedPlantId ? buildPlantTimeline(state, selectedPlantId) : [],
    [selectedPlantId, state],
  );
  const calibration = useMemo(() => calculateCalibration(samples), [samples]);

  function updateSample(index: number, field: keyof CalibrationSample, value: number): void {
    setSamples((current) => current.map((sample, sampleIndex) => sampleIndex === index
      ? { ...sample, [field]: value }
      : sample));
  }

  function saveCalibration(): void {
    const name = calibrationName.trim();
    if (!name || !calibration) {
      setMessage('Enter a profile name and at least one valid lux/PPFD reference pair.');
      return;
    }
    const next = {
      ...state,
      calibrationProfiles: [...state.calibrationProfiles, {
        id: createId('calibration'),
        name,
        luxToPpfdFactor: calibration.factor,
        fixture: fixture.trim(),
        notes: `Reference samples: ${calibration.count}; mean factor: ${calibration.meanFactor}; variability: ${calibration.variabilityPercent}%`,
        createdAt: new Date().toISOString(),
      }],
    };
    saveState(next, window.localStorage, 'external');
    setState(next);
    setMessage(`Calibration “${name}” saved with factor ${calibration.factor}. GrowLens will refresh with the new profile.`);
  }

  function printReport(): void {
    const html = createPrintableReport(state);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const reportWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!reportWindow) {
      setMessage('The browser blocked the report window. Allow pop-ups and try again.');
      URL.revokeObjectURL(url);
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setMessage('Printable report opened in a new tab.');
  }

  function renderOverview() {
    const recentDiary = [...state.diary].sort((first, second) => second.createdAt.localeCompare(first.createdAt)).slice(0, 6);
    return <>
      <div className="reports-stat-grid">
        <StatsCard label="Active plants" value={summary.activePlants} detail={`${summary.spaces} spaces`} />
        <StatsCard label="Active cycles" value={summary.activeCycles} detail={`${summary.readings} readings`} />
        <StatsCard label="Open tasks" value={summary.openTasks} detail={`${summary.diaryEntries} diary entries`} />
        <StatsCard label="Observations" value={summary.observations} detail={`${state.calibrationProfiles.length} calibrations`} />
      </div>
      <div className="reports-two-column">
        <PanelSection title="Environment snapshot" detail="All recorded spaces">
          <dl className="reports-definition-list">
            <div><dt>Temperature</dt><dd>{environment.temperatureC ? `${round(environment.temperatureC.average, 1)}°C average` : 'No readings'}</dd></div>
            <div><dt>Humidity</dt><dd>{environment.humidity ? `${round(environment.humidity.average, 1)}% average` : 'No readings'}</dd></div>
            <div><dt>PPFD</dt><dd>{environment.ppfd ? `${round(environment.ppfd.average, 0)} average` : 'No readings'}</dd></div>
            <div><dt>VPD</dt><dd>{environment.vpdKpa ? `${round(environment.vpdKpa.average, 2)} kPa average` : 'No readings'}</dd></div>
          </dl>
        </PanelSection>
        <PanelSection title="Recent grow history">
          {recentDiary.length ? <div className="reports-history-list">{recentDiary.map((entry) => <article key={entry.id}><span>{entry.type}</span><div><strong>{entry.title}</strong><small>{formatDateTime(entry.createdAt)}</small></div></article>)}</div> : <div className="empty-state"><strong>No diary history</strong><span>New records will appear here.</span></div>}
        </PanelSection>
      </div>
    </>;
  }

  function renderEnvironment() {
    return <>
      <div className="reports-filter-row">
        <label>Grow space<select value={spaceId} onChange={(event) => setSpaceId(event.target.value)}><option value="">All spaces</option>{state.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
        <span>{filteredReadings.length} reading{filteredReadings.length === 1 ? '' : 's'}</span>
      </div>
      <div className="reports-stat-grid compact">
        <StatsCard label="Temperature" value={environment.temperatureC ? `${round(environment.temperatureC.average, 1)}°C` : '—'} detail={statsText(environment.temperatureC, '°C')} />
        <StatsCard label="Humidity" value={environment.humidity ? `${round(environment.humidity.average, 1)}%` : '—'} detail={statsText(environment.humidity, '%')} />
        <StatsCard label="PPFD" value={environment.ppfd ? round(environment.ppfd.average, 0) : '—'} detail={statsText(environment.ppfd, '')} />
        <StatsCard label="VPD" value={environment.vpdKpa ? `${round(environment.vpdKpa.average, 2)} kPa` : '—'} detail={statsText(environment.vpdKpa, ' kPa')} />
      </div>
      <div className="reports-chart-grid">
        <TrendChart label="Temperature" suffix="°C" values={filteredReadings.map((reading) => reading.temperatureC)} />
        <TrendChart label="Humidity" suffix="%" values={filteredReadings.map((reading) => reading.humidity)} />
        <TrendChart label="PPFD" suffix="" values={filteredReadings.flatMap((reading) => reading.ppfd === null ? [] : [reading.ppfd])} />
        <TrendChart label="VPD" suffix=" kPa" values={filteredReadings.map((reading) => calculateVpdKpa(reading.temperatureC, reading.humidity))} />
      </div>
      <PanelSection title="Reading history">
        {filteredReadings.length ? <div className="reports-table-wrap"><table><thead><tr><th>Date</th><th>Temp</th><th>RH</th><th>PPFD</th><th>VPD</th></tr></thead><tbody>{[...filteredReadings].reverse().map((reading) => <tr key={reading.id}><td>{formatDateTime(reading.createdAt)}</td><td>{reading.temperatureC}°C</td><td>{reading.humidity}%</td><td>{reading.ppfd ?? '—'}</td><td>{round(calculateVpdKpa(reading.temperatureC, reading.humidity), 2)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>No environment readings</strong><span>Record temperature and humidity from the dashboard.</span></div>}
      </PanelSection>
    </>;
  }

  function renderTimeline() {
    const selectedPlant = state.plants.find((plant) => plant.id === selectedPlantId);
    return <>
      <div className="reports-filter-row"><label>Plant<select value={selectedPlantId} onChange={(event) => setPlantId(event.target.value)}><option value="">Choose a plant</option>{state.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</select></label>{selectedPlant ? <span>{selectedPlant.stage} · {selectedPlant.status}</span> : null}</div>
      {timeline.length ? <div className="reports-timeline">{timeline.map((event) => <article key={`${event.kind}-${event.id}`}><span className={`reports-event-kind ${event.kind}`}>{event.kind}</span><div><strong>{event.title}</strong><p>{event.detail || 'No additional detail'}</p><small>{formatDateTime(event.timestamp)}</small></div></article>)}</div> : <div className="empty-state"><strong>No timeline events</strong><span>Diary entries, observations, and assigned tasks will appear together here.</span></div>}
    </>;
  }

  function renderCalibration() {
    return <div className="reports-two-column calibration-layout">
      <PanelSection title="Reference-meter samples" detail="Measure lux and PPFD at the same point, height, angle, fixture output, and diffuser setup.">
        <div className="calibration-samples">{samples.map((sample, index) => <div className="calibration-row" key={index}><span>#{index + 1}</span><label>Lux<input type="number" min="1" value={sample.lux} onChange={(event) => updateSample(index, 'lux', Number(event.target.value))} /></label><label>Reference PPFD<input type="number" min="1" value={sample.ppfd} onChange={(event) => updateSample(index, 'ppfd', Number(event.target.value))} /></label><button type="button" className="text-button danger-text" onClick={() => setSamples((current) => current.filter((_, sampleIndex) => sampleIndex !== index))} disabled={samples.length <= 1}>Remove</button></div>)}</div>
        <button className="secondary-button" type="button" onClick={() => setSamples((current) => [...current, { lux: 40_000, ppfd: 600 }])}>Add sample</button>
      </PanelSection>
      <PanelSection title="Calibration result" detail="The saved factor is the median of valid samples, reducing the impact of one bad reading.">
        {calibration ? <div className="calibration-result"><div><span>Recommended factor</span><strong>{calibration.factor}</strong></div><dl><div><dt>Valid samples</dt><dd>{calibration.count}</dd></div><div><dt>Mean factor</dt><dd>{calibration.meanFactor}</dd></div><div><dt>Variability</dt><dd>{calibration.variabilityPercent}%</dd></div></dl>{calibration.variabilityPercent > 10 ? <div className="warning-note"><strong>High variability</strong><span>Repeat measurements before trusting this profile. Check diffuser placement, phone angle, fixture warm-up, and reference-meter consistency.</span></div> : <div className="account-message success">Sample agreement is within 10% variability.</div>}<div className="stack-form"><label>Profile name<input value={calibrationName} onChange={(event) => setCalibrationName(event.target.value)} placeholder="Tent A · 24 inch height" /></label><label>Fixture or spectrum<input value={fixture} onChange={(event) => setFixture(event.target.value)} placeholder="Fixture model and dimmer setting" /></label><button className="primary-button" type="button" onClick={saveCalibration}>Save calibration profile</button></div></div> : <div className="empty-state"><strong>No valid sample pairs</strong><span>Both lux and reference PPFD must be greater than zero.</span></div>}
      </PanelSection>
    </div>;
  }

  function renderExports() {
    const exports = createGrowLensCsvExports(state);
    const date = new Date().toISOString().slice(0, 10);
    return <>
      <PanelSection title="Printable grow report" detail="Creates a clean local HTML report with summary, environment statistics, plant roster, and recent diary history.">
        <button className="primary-button" type="button" onClick={printReport}>Open printable report</button>
      </PanelSection>
      <PanelSection title="CSV datasets" detail="Download only the records needed for analysis, spreadsheets, or long-term archives.">
        <div className="reports-export-grid">{Object.entries(exports).map(([name, csv]) => <button className="secondary-button" type="button" key={name} onClick={() => downloadText(`growlens-${name}-${date}.csv`, csv, 'text/csv;charset=utf-8')}>Download {name}.csv</button>)}</div>
      </PanelSection>
      <div className="warning-note"><strong>Photo backup boundary</strong><span>CSV and printable reports include photo IDs, not private image bytes. Back up the server image directory and use the local photo export feature once it is added.</span></div>
    </>;
  }

  let content: ReactNode;
  switch (tab) {
    case 'environment': content = renderEnvironment(); break;
    case 'timeline': content = renderTimeline(); break;
    case 'calibration': content = renderCalibration(); break;
    case 'exports': content = renderExports(); break;
    default: content = renderOverview();
  }

  return <>
    <button className="reports-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open GrowLens reports and history"><span aria-hidden="true">▥</span><strong>Reports</strong></button>
    {open ? <div className="reports-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}><section className="reports-panel" role="dialog" aria-modal="true" aria-labelledby="reports-title"><header className="reports-header"><div><span className="eyebrow">Evidence, history, and export</span><h2 id="reports-title">Reports & calibration</h2></div><button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close reports and history">×</button></header>{message ? <div className="account-message success" role="status">{message}</div> : null}<nav className="reports-tabs" aria-label="Report sections">{tabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav><div className="reports-content">{content}</div></section></div> : null}
  </>;
}
