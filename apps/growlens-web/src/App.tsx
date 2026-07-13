import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  calculateDliMol,
  calculateVpdKpa,
  canopyUniformityPercent,
  luxToPpfd,
  round,
} from './calculations';
import { diagnoseSymptoms, symptomOptions } from './diagnostics';
import {
  createId,
  emptyState,
  loadState,
  parseBackup,
  saveState,
  serializeBackup,
} from './storage';
import type {
  EntryType,
  GrowLensState,
  PlantStage,
} from './types';

type Route = 'dashboard' | 'grow' | 'diary' | 'tasks' | 'tools' | 'observe' | 'settings';

const routes: Route[] = ['dashboard', 'grow', 'diary', 'tasks', 'tools', 'observe', 'settings'];
const navItems: Array<{ route: Route; label: string; icon: string }> = [
  { route: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { route: 'grow', label: 'Grow', icon: '♧' },
  { route: 'diary', label: 'Diary', icon: '▤' },
  { route: 'tasks', label: 'Tasks', icon: '✓' },
  { route: 'tools', label: 'Tools', icon: '◫' },
  { route: 'observe', label: 'Observe', icon: '◎' },
  { route: 'settings', label: 'Settings', icon: '⚙' },
];

const stageOptions: PlantStage[] = ['seedling', 'vegetative', 'flowering', 'drying', 'curing', 'complete'];
const entryTypes: EntryType[] = ['note', 'watering', 'feeding', 'training', 'transplant', 'pest-check', 'photo', 'harvest'];

function routeFromHash(): Route {
  const route = window.location.hash.replace(/^#\/?/, '') as Route;
  return routes.includes(route) ? route : 'dashboard';
}

function formatDate(value: string): string {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function Section({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeFromHash());
  const [data, setData] = useState<GrowLensState>(() => loadState());
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState('');

  const [spaceName, setSpaceName] = useState('');
  const [spaceEnvironment, setSpaceEnvironment] = useState<'indoor' | 'greenhouse' | 'outdoor'>('indoor');
  const [cycleName, setCycleName] = useState('');
  const [cycleSpaceId, setCycleSpaceId] = useState('');
  const [cycleStage, setCycleStage] = useState<PlantStage>('vegetative');
  const [plantName, setPlantName] = useState('');
  const [plantStrain, setPlantStrain] = useState('');
  const [plantSpaceId, setPlantSpaceId] = useState('');
  const [plantCycleId, setPlantCycleId] = useState('');
  const [plantStage, setPlantStage] = useState<PlantStage>('vegetative');
  const [plantNotes, setPlantNotes] = useState('');

  const [diaryTitle, setDiaryTitle] = useState('');
  const [diaryNotes, setDiaryNotes] = useState('');
  const [diaryType, setDiaryType] = useState<EntryType>('note');
  const [diaryPlantId, setDiaryPlantId] = useState('');
  const [diarySearch, setDiarySearch] = useState('');

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(todayInput());
  const [taskPlantId, setTaskPlantId] = useState('');

  const [readingSpaceId, setReadingSpaceId] = useState('');
  const [readingTemp, setReadingTemp] = useState(26);
  const [readingHumidity, setReadingHumidity] = useState(60);
  const [readingPpfd, setReadingPpfd] = useState(500);

  const [vpdTemp, setVpdTemp] = useState(26);
  const [vpdHumidity, setVpdHumidity] = useState(60);
  const [leafOffset, setLeafOffset] = useState(-1);
  const [dliPpfd, setDliPpfd] = useState(500);
  const [dliHours, setDliHours] = useState(18);
  const [luxValue, setLuxValue] = useState(40_000);
  const [luxFactor, setLuxFactor] = useState(0.015);
  const [canopyValues, setCanopyValues] = useState<number[]>(Array.from({ length: 9 }, () => 0));

  const [calibrationName, setCalibrationName] = useState('');
  const [calibrationFixture, setCalibrationFixture] = useState('');
  const [calibrationFactor, setCalibrationFactor] = useState(0.015);

  const [observationPlantId, setObservationPlantId] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [observationNotes, setObservationNotes] = useState('');
  const [photoPreview, setPhotoPreview] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (!window.location.hash) window.location.hash = '#/dashboard';
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    try {
      saveState(data);
    } catch {
      setNotice('This browser blocked local storage. Export a backup before leaving this page.');
    }
  }, [data]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview.url);
  }, [photoPreview]);

  const activePlants = data.plants.filter((plant) => plant.status === 'active');
  const openTasks = data.tasks.filter((task) => !task.completed);
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < todayInput());
  const recentDiary = [...data.diary].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filteredDiary = recentDiary.filter((entry) => {
    const query = diarySearch.trim().toLowerCase();
    if (!query) return true;
    const plant = data.plants.find((candidate) => candidate.id === entry.plantId);
    return `${entry.title} ${entry.notes} ${entry.type} ${plant?.name ?? ''}`.toLowerCase().includes(query);
  });
  const diagnosisResults = useMemo(() => diagnoseSymptoms(selectedSymptoms), [selectedSymptoms]);

  function navigate(nextRoute: Route) {
    setRoute(nextRoute);
    window.location.hash = `#/${nextRoute}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function addSpace(event: FormEvent) {
    event.preventDefault();
    const name = spaceName.trim();
    if (!name) return;
    const id = createId('space');
    setData((current) => ({
      ...current,
      spaces: [...current.spaces, { id, name, environment: spaceEnvironment, lightHours: 18, createdAt: new Date().toISOString() }],
    }));
    if (!cycleSpaceId) setCycleSpaceId(id);
    if (!plantSpaceId) setPlantSpaceId(id);
    if (!readingSpaceId) setReadingSpaceId(id);
    setSpaceName('');
    setNotice(`Grow space “${name}” created.`);
  }

  function addCycle(event: FormEvent) {
    event.preventDefault();
    const name = cycleName.trim();
    const spaceId = cycleSpaceId || data.spaces[0]?.id;
    if (!name || !spaceId) return;
    const id = createId('cycle');
    setData((current) => ({
      ...current,
      cycles: [...current.cycles, { id, name, spaceId, startDate: todayInput(), stage: cycleStage, status: 'active' }],
    }));
    if (!plantCycleId) setPlantCycleId(id);
    setCycleName('');
    setNotice(`Cycle “${name}” started.`);
  }

  function addPlant(event: FormEvent) {
    event.preventDefault();
    const name = plantName.trim();
    const spaceId = plantSpaceId || data.spaces[0]?.id;
    const cycleId = plantCycleId || data.cycles.find((cycle) => cycle.spaceId === spaceId)?.id || '';
    if (!name || !spaceId) return;
    setData((current) => ({
      ...current,
      plants: [...current.plants, {
        id: createId('plant'),
        name,
        strain: plantStrain.trim() || 'Unknown cultivar',
        stage: plantStage,
        status: 'active',
        spaceId,
        cycleId,
        startDate: todayInput(),
        notes: plantNotes.trim(),
        createdAt: new Date().toISOString(),
      }],
    }));
    setPlantName('');
    setPlantStrain('');
    setPlantNotes('');
    setNotice(`Plant “${name}” added.`);
  }

  function updatePlantStage(plantId: string, stage: PlantStage) {
    setData((current) => ({
      ...current,
      plants: current.plants.map((plant) => plant.id === plantId ? { ...plant, stage } : plant),
    }));
  }

  function archivePlant(plantId: string) {
    setData((current) => ({
      ...current,
      plants: current.plants.map((plant) => plant.id === plantId ? { ...plant, status: 'archived' } : plant),
    }));
  }

  function addDiaryEntry(event: FormEvent) {
    event.preventDefault();
    const title = diaryTitle.trim();
    if (!title) return;
    const selectedPlant = data.plants.find((plant) => plant.id === diaryPlantId);
    setData((current) => ({
      ...current,
      diary: [...current.diary, {
        id: createId('entry'),
        plantId: diaryPlantId || null,
        cycleId: selectedPlant?.cycleId || null,
        type: diaryType,
        title,
        notes: diaryNotes.trim(),
        createdAt: new Date().toISOString(),
      }],
    }));
    setDiaryTitle('');
    setDiaryNotes('');
    setNotice('Diary entry saved locally.');
  }

  function addTask(event: FormEvent) {
    event.preventDefault();
    const title = taskTitle.trim();
    if (!title) return;
    setData((current) => ({
      ...current,
      tasks: [...current.tasks, {
        id: createId('task'),
        title,
        dueDate: taskDueDate,
        plantId: taskPlantId || null,
        completed: false,
        createdAt: new Date().toISOString(),
      }],
    }));
    setTaskTitle('');
    setNotice('Task added.');
  }

  function toggleTask(taskId: string) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task),
    }));
  }

  function addReading(event: FormEvent) {
    event.preventDefault();
    setData((current) => ({
      ...current,
      readings: [...current.readings, {
        id: createId('reading'),
        spaceId: readingSpaceId || null,
        temperatureC: readingTemp,
        humidity: readingHumidity,
        ppfd: readingPpfd > 0 ? readingPpfd : null,
        createdAt: new Date().toISOString(),
      }],
    }));
    setNotice('Environment reading recorded.');
  }

  function addCalibration(event: FormEvent) {
    event.preventDefault();
    const name = calibrationName.trim();
    if (!name || calibrationFactor <= 0) return;
    setData((current) => ({
      ...current,
      calibrationProfiles: [...current.calibrationProfiles, {
        id: createId('calibration'),
        name,
        luxToPpfdFactor: calibrationFactor,
        fixture: calibrationFixture.trim(),
        notes: '',
        createdAt: new Date().toISOString(),
      }],
    }));
    setCalibrationName('');
    setCalibrationFixture('');
    setNotice('Calibration profile saved.');
  }

  function saveObservation(event: FormEvent) {
    event.preventDefault();
    if (selectedSymptoms.length === 0 && !observationNotes.trim()) return;
    setData((current) => ({
      ...current,
      observations: [...current.observations, {
        id: createId('observation'),
        plantId: observationPlantId || null,
        symptoms: selectedSymptoms,
        notes: observationNotes.trim(),
        possibleCauses: diagnosisResults.map((result) => result.cause),
        createdAt: new Date().toISOString(),
      }],
    }));
    setObservationNotes('');
    setNotice('Observation and current diagnostic possibilities saved.');
  }

  function toggleSymptom(code: string) {
    setSelectedSymptoms((current) => current.includes(code)
      ? current.filter((symptom) => symptom !== code)
      : [...current, code]);
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview.url);
    setPhotoPreview({ name: file.name, url: URL.createObjectURL(file) });
  }

  function downloadBackup() {
    const blob = new Blob([serializeBackup(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `growlens-backup-${todayInput()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Backup downloaded.');
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = parseBackup(await file.text());
      setData(imported);
      setNotice('Backup imported successfully.');
    } catch {
      setNotice('That file is not a valid GrowLens backup.');
    } finally {
      event.target.value = '';
    }
  }

  function resetData() {
    if (!window.confirm('Delete all GrowLens data stored in this browser? Export a backup first if you need it.')) return;
    setData(structuredClone(emptyState));
    setNotice('Local GrowLens data cleared.');
  }

  function renderDashboard() {
    const lastReading = [...data.readings].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return (
      <>
        <div className="page-intro">
          <div>
            <span className="eyebrow">Local-first grow command center</span>
            <h1>Know what changed. Record what matters.</h1>
            <p>Track plants, environment, light, tasks, and observations without depending on a paid third-party platform.</p>
          </div>
          <button className="primary-button" onClick={() => navigate('diary')}>Add diary entry</button>
        </div>

        <div className="metric-grid">
          <article className="metric-card"><span>Active plants</span><strong>{activePlants.length}</strong><small>{data.spaces.length} grow space{data.spaces.length === 1 ? '' : 's'}</small></article>
          <article className="metric-card"><span>Open tasks</span><strong>{openTasks.length}</strong><small>{overdueTasks.length} overdue</small></article>
          <article className="metric-card"><span>Diary records</span><strong>{data.diary.length}</strong><small>{data.observations.length} observations</small></article>
          <article className="metric-card"><span>Latest VPD</span><strong>{lastReading ? `${round(calculateVpdKpa(lastReading.temperatureC, lastReading.humidity), 2)} kPa` : '—'}</strong><small>{lastReading ? `${lastReading.temperatureC}°C · ${lastReading.humidity}% RH` : 'Record an environment reading'}</small></article>
        </div>

        <div className="two-column">
          <Section title="Next actions" description="Tasks remain on-device and work offline.">
            {openTasks.length ? (
              <div className="list-stack">
                {[...openTasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5).map((task) => {
                  const plant = data.plants.find((candidate) => candidate.id === task.plantId);
                  return (
                    <label className="task-row" key={task.id}>
                      <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} />
                      <span><strong>{task.title}</strong><small className={task.dueDate < todayInput() ? 'danger-text' : ''}>{formatDate(task.dueDate)}{plant ? ` · ${plant.name}` : ''}</small></span>
                    </label>
                  );
                })}
              </div>
            ) : <Empty title="No open tasks" detail="Create the next grow-room check before it becomes a forgotten problem." />}
          </Section>

          <Section title="Recent grow log" description="Your latest documented changes.">
            {recentDiary.length ? (
              <div className="list-stack">
                {recentDiary.slice(0, 5).map((entry) => {
                  const plant = data.plants.find((candidate) => candidate.id === entry.plantId);
                  return <article className="timeline-row" key={entry.id}><span className="type-chip">{entry.type}</span><div><strong>{entry.title}</strong><small>{formatDateTime(entry.createdAt)}{plant ? ` · ${plant.name}` : ''}</small></div></article>;
                })}
              </div>
            ) : <Empty title="No diary entries yet" detail="Start with what changed today, even if the answer is “nothing.”" />}
          </Section>
        </div>

        <Section title="Quick environment reading" description="These measurements feed dashboard history and VPD context.">
          <form className="form-grid compact-form" onSubmit={addReading}>
            <label>Grow space<select value={readingSpaceId} onChange={(event) => setReadingSpaceId(event.target.value)}><option value="">Unassigned</option>{data.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
            <label>Temperature °C<input type="number" step="0.1" value={readingTemp} onChange={(event) => setReadingTemp(Number(event.target.value))} /></label>
            <label>Relative humidity %<input type="number" min="0" max="100" step="0.1" value={readingHumidity} onChange={(event) => setReadingHumidity(Number(event.target.value))} /></label>
            <label>PPFD µmol/m²/s<input type="number" min="0" value={readingPpfd} onChange={(event) => setReadingPpfd(Number(event.target.value))} /></label>
            <button className="secondary-button" type="submit">Record reading</button>
          </form>
        </Section>
      </>
    );
  }

  function renderGrow() {
    return (
      <>
        <div className="page-intro"><div><span className="eyebrow">Grow structure</span><h1>Spaces, cycles, and plants</h1><p>Keep the physical room, the grow cycle, and each plant separate so records remain useful later.</p></div></div>
        <div className="three-column forms-row">
          <Section title="1. Add a space">
            <form className="stack-form" onSubmit={addSpace}>
              <label>Space name<input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} placeholder="Flower Tent A" required /></label>
              <label>Environment<select value={spaceEnvironment} onChange={(event) => setSpaceEnvironment(event.target.value as typeof spaceEnvironment)}><option value="indoor">Indoor</option><option value="greenhouse">Greenhouse</option><option value="outdoor">Outdoor</option></select></label>
              <button className="secondary-button" type="submit">Create space</button>
            </form>
          </Section>
          <Section title="2. Start a cycle">
            <form className="stack-form" onSubmit={addCycle}>
              <label>Cycle name<input value={cycleName} onChange={(event) => setCycleName(event.target.value)} placeholder="Summer Blue Mango run" required /></label>
              <label>Grow space<select value={cycleSpaceId} onChange={(event) => setCycleSpaceId(event.target.value)} required><option value="">Choose a space</option>{data.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
              <label>Starting stage<select value={cycleStage} onChange={(event) => setCycleStage(event.target.value as PlantStage)}>{stageOptions.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
              <button className="secondary-button" type="submit" disabled={!data.spaces.length}>Start cycle</button>
            </form>
          </Section>
          <Section title="3. Add a plant">
            <form className="stack-form" onSubmit={addPlant}>
              <label>Plant name or ID<input value={plantName} onChange={(event) => setPlantName(event.target.value)} placeholder="BM-F3-01" required /></label>
              <label>Cultivar<input value={plantStrain} onChange={(event) => setPlantStrain(event.target.value)} placeholder="Blue Mango F3" /></label>
              <label>Grow space<select value={plantSpaceId} onChange={(event) => setPlantSpaceId(event.target.value)} required><option value="">Choose a space</option>{data.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
              <label>Cycle<select value={plantCycleId} onChange={(event) => setPlantCycleId(event.target.value)}><option value="">No cycle</option>{data.cycles.filter((cycle) => !plantSpaceId || cycle.spaceId === plantSpaceId).map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label>
              <label>Stage<select value={plantStage} onChange={(event) => setPlantStage(event.target.value as PlantStage)}>{stageOptions.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
              <label>Notes<textarea value={plantNotes} onChange={(event) => setPlantNotes(event.target.value)} placeholder="Source, phenotype, container, medium…" /></label>
              <button className="primary-button" type="submit" disabled={!data.spaces.length}>Add plant</button>
            </form>
          </Section>
        </div>

        <Section title="Plant roster" description="Update stage as the grow progresses; archive records instead of deleting history.">
          {data.plants.length ? (
            <div className="plant-grid">
              {data.plants.map((plant) => {
                const space = data.spaces.find((candidate) => candidate.id === plant.spaceId);
                const cycle = data.cycles.find((candidate) => candidate.id === plant.cycleId);
                return (
                  <article className={`plant-card ${plant.status === 'archived' ? 'muted-card' : ''}`} key={plant.id}>
                    <div className="plant-card-top"><div><span className="status-dot" /><h3>{plant.name}</h3></div><span className="type-chip">{plant.status}</span></div>
                    <p>{plant.strain}</p>
                    <dl><div><dt>Space</dt><dd>{space?.name ?? 'Unassigned'}</dd></div><div><dt>Cycle</dt><dd>{cycle?.name ?? 'None'}</dd></div><div><dt>Started</dt><dd>{formatDate(plant.startDate)}</dd></div></dl>
                    <label>Stage<select value={plant.stage} onChange={(event) => updatePlantStage(plant.id, event.target.value as PlantStage)} disabled={plant.status === 'archived'}>{stageOptions.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
                    {plant.notes ? <small className="plant-notes">{plant.notes}</small> : null}
                    {plant.status !== 'archived' ? <button className="text-button danger-text" onClick={() => archivePlant(plant.id)}>Archive plant</button> : null}
                  </article>
                );
              })}
            </div>
          ) : <Empty title="No plants recorded" detail="Create a grow space first, then add each plant with a stable name or ID." />}
        </Section>
      </>
    );
  }

  function renderDiary() {
    return (
      <>
        <div className="page-intro"><div><span className="eyebrow">Searchable history</span><h1>Grow diary</h1><p>Record actions, observations, and changes while the details are still fresh.</p></div></div>
        <div className="two-column align-start">
          <Section title="New entry">
            <form className="stack-form" onSubmit={addDiaryEntry}>
              <label>Entry type<select value={diaryType} onChange={(event) => setDiaryType(event.target.value as EntryType)}>{entryTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label>Plant<select value={diaryPlantId} onChange={(event) => setDiaryPlantId(event.target.value)}><option value="">General grow note</option>{data.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</select></label>
              <label>Title<input value={diaryTitle} onChange={(event) => setDiaryTitle(event.target.value)} placeholder="What changed?" required /></label>
              <label>Details<textarea value={diaryNotes} onChange={(event) => setDiaryNotes(event.target.value)} placeholder="Amounts, measurements, response, and anything to compare later." rows={6} /></label>
              <button className="primary-button" type="submit">Save entry</button>
            </form>
          </Section>
          <Section title="Timeline" action={<input className="search-input" type="search" value={diarySearch} onChange={(event) => setDiarySearch(event.target.value)} placeholder="Search diary" aria-label="Search diary" />}>
            {filteredDiary.length ? <div className="diary-list">{filteredDiary.map((entry) => {
              const plant = data.plants.find((candidate) => candidate.id === entry.plantId);
              return <article className="diary-card" key={entry.id}><div><span className="type-chip">{entry.type}</span><small>{formatDateTime(entry.createdAt)}</small></div><h3>{entry.title}</h3>{plant ? <strong>{plant.name} · {plant.strain}</strong> : null}{entry.notes ? <p>{entry.notes}</p> : null}</article>;
            })}</div> : <Empty title="No matching entries" detail="Save a diary entry or change the search terms." />}
          </Section>
        </div>
      </>
    );
  }

  function renderTasks() {
    return (
      <>
        <div className="page-intro"><div><span className="eyebrow">Action tracking</span><h1>Tasks and reminders</h1><p>Build a repeatable routine around plant checks, irrigation, scouting, and measurements.</p></div></div>
        <div className="two-column align-start">
          <Section title="Add a task">
            <form className="stack-form" onSubmit={addTask}>
              <label>Task<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Inspect leaf undersides" required /></label>
              <label>Due date<input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} /></label>
              <label>Plant<select value={taskPlantId} onChange={(event) => setTaskPlantId(event.target.value)}><option value="">Whole grow</option>{data.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}</select></label>
              <button className="primary-button" type="submit">Add task</button>
            </form>
          </Section>
          <Section title="Task list" description={`${openTasks.length} open · ${overdueTasks.length} overdue`}>
            {data.tasks.length ? <div className="list-stack">{[...data.tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate)).map((task) => {
              const plant = data.plants.find((candidate) => candidate.id === task.plantId);
              return <label className={`task-row ${task.completed ? 'completed-row' : ''}`} key={task.id}><input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} /><span><strong>{task.title}</strong><small className={!task.completed && task.dueDate < todayInput() ? 'danger-text' : ''}>{formatDate(task.dueDate)}{plant ? ` · ${plant.name}` : ''}</small></span></label>;
            })}</div> : <Empty title="No tasks yet" detail="Add the next action that keeps the grow moving forward." />}
          </Section>
        </div>
      </>
    );
  }

  function renderTools() {
    const vpd = calculateVpdKpa(vpdTemp, vpdHumidity, leafOffset);
    const dli = calculateDliMol(dliPpfd, dliHours);
    const estimatedPpfd = luxToPpfd(luxValue, luxFactor);
    const canopyAverage = canopyValues.length ? canopyValues.reduce((sum, value) => sum + value, 0) / canopyValues.length : 0;
    const uniformity = canopyUniformityPercent(canopyValues);
    return (
      <>
        <div className="page-intro"><div><span className="eyebrow">Cultivation utilities</span><h1>Light and environment tools</h1><p>Use measurements as decision support. Phone-camera light estimates require calibration and are not laboratory instruments.</p></div></div>
        <div className="tool-grid">
          <Section title="VPD calculator" description="Uses air RH and an adjustable leaf-temperature offset.">
            <div className="stack-form">
              <label>Air temperature °C<input type="number" step="0.1" value={vpdTemp} onChange={(event) => setVpdTemp(Number(event.target.value))} /></label>
              <label>Relative humidity %<input type="number" min="0" max="100" step="0.1" value={vpdHumidity} onChange={(event) => setVpdHumidity(Number(event.target.value))} /></label>
              <label>Leaf offset °C<input type="number" step="0.1" value={leafOffset} onChange={(event) => setLeafOffset(Number(event.target.value))} /></label>
              <div className="result-box"><span>Estimated VPD</span><strong>{round(vpd, 2)} kPa</strong><small>Confirm leaf temperature and cultivar response before changing the room.</small></div>
            </div>
          </Section>
          <Section title="DLI calculator" description="Daily light integral from average PPFD and photoperiod.">
            <div className="stack-form">
              <label>Average PPFD<input type="number" min="0" value={dliPpfd} onChange={(event) => setDliPpfd(Number(event.target.value))} /></label>
              <label>Light hours<input type="number" min="0" max="24" step="0.5" value={dliHours} onChange={(event) => setDliHours(Number(event.target.value))} /></label>
              <div className="result-box"><span>Estimated DLI</span><strong>{round(dli, 1)} mol/m²/day</strong><small>A single center reading can overstate whole-canopy delivery.</small></div>
            </div>
          </Section>
          <Section title="Lux → PPFD estimate" description="Use a fixture-specific factor whenever possible.">
            <div className="stack-form">
              <label>Lux<input type="number" min="0" value={luxValue} onChange={(event) => setLuxValue(Number(event.target.value))} /></label>
              <label>Conversion factor<input type="number" min="0.001" step="0.001" value={luxFactor} onChange={(event) => setLuxFactor(Number(event.target.value))} /></label>
              <div className="result-box"><span>Estimated PPFD</span><strong>{round(estimatedPpfd, 0)} µmol/m²/s</strong><small>Spectrum, sensor response, diffuser, and phone model can materially change this estimate.</small></div>
            </div>
          </Section>
        </div>

        <Section title="3 × 3 canopy map" description="Enter nine readings at the same canopy height and spacing.">
          <div className="canopy-layout">
            <div className="canopy-grid">{canopyValues.map((value, index) => <label key={index}><span>Point {index + 1}</span><input type="number" min="0" value={value} onChange={(event) => setCanopyValues((current) => current.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item))} /></label>)}</div>
            <div className="result-stack"><div className="result-box"><span>Average PPFD</span><strong>{round(canopyAverage, 0)}</strong></div><div className="result-box"><span>Uniformity</span><strong>{round(uniformity, 0)}%</strong><small>Calculated as minimum ÷ average.</small></div></div>
          </div>
        </Section>

        <div className="two-column align-start">
          <Section title="Calibration profiles" description="Store factors by fixture and measurement setup.">
            <form className="stack-form" onSubmit={addCalibration}>
              <label>Profile name<input value={calibrationName} onChange={(event) => setCalibrationName(event.target.value)} placeholder="Tent A · fixture at 24 in" required /></label>
              <label>Fixture<input value={calibrationFixture} onChange={(event) => setCalibrationFixture(event.target.value)} placeholder="Fixture model or spectrum" /></label>
              <label>Lux → PPFD factor<input type="number" min="0.001" step="0.001" value={calibrationFactor} onChange={(event) => setCalibrationFactor(Number(event.target.value))} /></label>
              <button className="secondary-button" type="submit">Save profile</button>
            </form>
          </Section>
          <Section title="Saved profiles">
            {data.calibrationProfiles.length ? <div className="list-stack">{data.calibrationProfiles.map((profile) => <button className="profile-row" key={profile.id} onClick={() => setLuxFactor(profile.luxToPpfdFactor)}><span><strong>{profile.name}</strong><small>{profile.fixture || 'Fixture not specified'}</small></span><b>{profile.luxToPpfdFactor}</b></button>)}</div> : <Empty title="No calibration profiles" detail="Save the factor you establish against a trusted meter or manufacturer data." />}
          </Section>
        </div>
      </>
    );
  }

  function renderObserve() {
    return (
      <>
        <div className="page-intro"><div><span className="eyebrow">Structured observation</span><h1>Observe before treating</h1><p>Select what is actually visible. GrowLens returns possibilities and verification steps—not a confirmed diagnosis.</p></div></div>
        <div className="two-column align-start observe-columns">
          <Section title="Capture evidence">
            <form className="stack-form" onSubmit={saveObservation}>
              <label>Plant<select value={observationPlantId} onChange={(event) => setObservationPlantId(event.target.value)}><option value="">Unassigned observation</option>{data.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</select></label>
              <label className="photo-input">Photo<input type="file" accept="image/*" capture="environment" onChange={handlePhoto} /><span>Use camera or choose an image</span></label>
              {photoPreview ? <figure className="photo-preview"><img src={photoPreview.url} alt="Selected plant observation" /><figcaption>{photoPreview.name} · preview only in this foundation build</figcaption></figure> : null}
              <fieldset className="symptom-grid"><legend>Visible symptoms</legend>{symptomOptions.map(([code, label]) => <label className={selectedSymptoms.includes(code) ? 'symptom-option selected' : 'symptom-option'} key={code}><input type="checkbox" checked={selectedSymptoms.includes(code)} onChange={() => toggleSymptom(code)} /><span>{label}</span></label>)}</fieldset>
              <label>Context notes<textarea rows={5} value={observationNotes} onChange={(event) => setObservationNotes(event.target.value)} placeholder="Location on plant, progression, pH/EC, irrigation, recent changes, pests seen…" /></label>
              <button className="primary-button" type="submit">Save observation</button>
            </form>
          </Section>
          <Section title="Possible causes" description="Ranked by current supporting and conflicting evidence.">
            {diagnosisResults.length ? <div className="diagnosis-list">{diagnosisResults.map((result) => <article className="diagnosis-card" key={result.cause}><div><h3>{result.cause}</h3><span className={`confidence ${result.confidence}`}>{result.confidence} confidence</span></div><p><strong>Supporting evidence:</strong> {result.evidence.length ? result.evidence.join(', ') : 'Limited'}</p>{result.conflicts.length ? <p><strong>Conflicting evidence:</strong> {result.conflicts.join(', ')}</p> : null}<strong>Verify next</strong><ol>{result.verifyNext.map((step) => <li key={step}>{step}</li>)}</ol></article>)}</div> : <Empty title="Select symptoms to compare possibilities" detail="Direct measurements and close inspection are more useful than guessing from leaf color alone." />}
            <div className="warning-note"><strong>Safety rule</strong><span>Do not stack treatments based on a guess. Verify root-zone conditions, environment, pest evidence, and symptom location first.</span></div>
          </Section>
        </div>
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <div className="page-intro"><div><span className="eyebrow">Data ownership</span><h1>Backup, restore, and privacy</h1><p>This foundation stores records in this browser. Export backups regularly until account sync is connected.</p></div></div>
        <div className="settings-grid">
          <Section title="Export all data" description="Creates a human-readable JSON backup containing every GrowLens record."><button className="primary-button" onClick={downloadBackup}>Download backup</button></Section>
          <Section title="Import a backup" description="Import replaces the current in-browser dataset after validation."><label className="file-button">Choose backup<input type="file" accept="application/json,.json" onChange={importBackup} /></label></Section>
          <Section title="Local storage status"><dl className="data-summary"><div><dt>Spaces</dt><dd>{data.spaces.length}</dd></div><div><dt>Plants</dt><dd>{data.plants.length}</dd></div><div><dt>Diary</dt><dd>{data.diary.length}</dd></div><div><dt>Readings</dt><dd>{data.readings.length}</dd></div></dl></Section>
          <Section title="Delete local data" description="This cannot be undone unless you exported a backup."><button className="danger-button" onClick={resetData}>Delete browser data</button></Section>
        </div>
        <Section title="Current privacy boundary"><div className="privacy-copy"><p><strong>Stored now:</strong> Grow records are stored locally in this browser using a versioned schema.</p><p><strong>Not stored now:</strong> The selected observation photo is previewed in memory but is not persisted in this foundation release.</p><p><strong>Next backend gate:</strong> Hostinger account authentication, private image storage, user-isolated records, synchronization, export, and account deletion must pass a separate security review before activation.</p></div></Section>
      </>
    );
  }

  let content: ReactNode;
  switch (route) {
    case 'grow': content = renderGrow(); break;
    case 'diary': content = renderDiary(); break;
    case 'tasks': content = renderTasks(); break;
    case 'tools': content = renderTools(); break;
    case 'observe': content = renderObserve(); break;
    case 'settings': content = renderSettings(); break;
    default: content = renderDashboard();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('dashboard')} aria-label="Open GrowLens dashboard"><span className="brand-mark">GL</span><span><strong>GrowLens</strong><small>Teaching Healthy Cultivation</small></span></button>
        <nav aria-label="Primary navigation">{navItems.map((item) => <button key={item.route} className={route === item.route ? 'nav-button active' : 'nav-button'} onClick={() => navigate(item.route)}><span>{item.icon}</span>{item.label}</button>)}</nav>
        <div className="sidebar-footer"><span className={online ? 'connection-dot online' : 'connection-dot'} />{online ? 'Online' : 'Offline · local mode'}</div>
      </aside>
      <header className="mobile-header"><button className="brand" onClick={() => navigate('dashboard')}><span className="brand-mark">GL</span><span><strong>GrowLens</strong><small>{online ? 'Online' : 'Offline mode'}</small></span></button></header>
      <main className="main-content">
        {notice ? <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div> : null}
        {content}
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">{navItems.slice(0, 6).map((item) => <button key={item.route} className={route === item.route ? 'active' : ''} onClick={() => navigate(item.route)}><span>{item.icon}</span><small>{item.label}</small></button>)}</nav>
    </div>
  );
}
