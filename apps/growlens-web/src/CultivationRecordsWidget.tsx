import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  harvestDryLossPercent,
  irrigationRunoffPercent,
  validateHarvestInput,
  validateIrrigationInput,
} from './cultivationRecords';
import { createId, loadState, saveState, STATE_SAVED_EVENT } from './storage';
import type {
  FeedingRecord,
  GrowLensState,
  HarvestRecord,
  IrrigationRecord,
  NutrientProduct,
  ObservationOutcome,
  ObservationOutcomeStatus,
  ReservoirRecord,
} from './types';

type Tab = 'irrigation' | 'feeding' | 'reservoirs' | 'harvest' | 'outcomes';

type IrrigationDraft = {
  id: string;
  plantId: string;
  sourceWater: string;
  volumeAppliedMl: string;
  runoffVolumeMl: string;
  inputPh: string;
  inputEcMsCm: string;
  runoffPh: string;
  runoffEcMsCm: string;
  substrateMoisturePercent: string;
  drybackPercent: string;
  irrigationTimeMinutes: string;
  reservoirId: string;
  productsUsed: string;
  recipeNotes: string;
};

type FeedingDraft = {
  id: string;
  plantId: string;
  reservoirId: string;
  waterVolumeMl: string;
  sourceWater: string;
  startingEcMsCm: string;
  finalEcMsCm: string;
  finalPh: string;
  ppm: string;
  ppmScale: '' | '500' | '700';
  products: string;
  additives: string;
  mixingNotes: string;
};

type ReservoirDraft = {
  id: string;
  spaceId: string;
  name: string;
  sourceWater: string;
  capacityLiters: string;
  currentVolumeLiters: string;
  ph: string;
  ecMsCm: string;
  temperatureC: string;
  mixedAt: string;
  notes: string;
};

type HarvestDraft = {
  id: string;
  plantId: string;
  lotId: string;
  harvestDate: string;
  wetWeightG: string;
  dryWeightG: string;
  trimmedWeightG: string;
  wasteWeightG: string;
  dryingTemperatureC: string;
  dryingHumidity: string;
  dryingDays: string;
  cureStartedAt: string;
  cureCheckpoints: string;
  finalPhotoIds: string;
  notes: string;
};

type OutcomeDraft = {
  id: string;
  observationId: string;
  status: ObservationOutcomeStatus;
  verifiedCause: string;
  actionTaken: string;
  outcomeNotes: string;
  resolvedAt: string;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'irrigation', label: 'Irrigation' },
  { id: 'feeding', label: 'Feeding' },
  { id: 'reservoirs', label: 'Reservoirs' },
  { id: 'harvest', label: 'Harvest' },
  { id: 'outcomes', label: 'Outcomes' },
];

const today = () => new Date().toISOString().slice(0, 10);
const nowLocal = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const emptyIrrigation = (): IrrigationDraft => ({ id: '', plantId: '', sourceWater: '', volumeAppliedMl: '', runoffVolumeMl: '', inputPh: '', inputEcMsCm: '', runoffPh: '', runoffEcMsCm: '', substrateMoisturePercent: '', drybackPercent: '', irrigationTimeMinutes: '', reservoirId: '', productsUsed: '', recipeNotes: '' });
const emptyFeeding = (): FeedingDraft => ({ id: '', plantId: '', reservoirId: '', waterVolumeMl: '', sourceWater: '', startingEcMsCm: '', finalEcMsCm: '', finalPh: '', ppm: '', ppmScale: '', products: '', additives: '', mixingNotes: '' });
const emptyReservoir = (): ReservoirDraft => ({ id: '', spaceId: '', name: '', sourceWater: '', capacityLiters: '', currentVolumeLiters: '', ph: '', ecMsCm: '', temperatureC: '', mixedAt: nowLocal(), notes: '' });
const emptyHarvest = (): HarvestDraft => ({ id: '', plantId: '', lotId: '', harvestDate: today(), wetWeightG: '', dryWeightG: '', trimmedWeightG: '', wasteWeightG: '', dryingTemperatureC: '', dryingHumidity: '', dryingDays: '', cureStartedAt: '', cureCheckpoints: '', finalPhotoIds: '', notes: '' });
const emptyOutcome = (): OutcomeDraft => ({ id: '', observationId: '', status: 'monitoring', verifiedCause: '', actionTaken: '', outcomeNotes: '', resolvedAt: '' });

function optionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredNumber(value: string): number {
  return Number(value);
}

function list(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function parseProducts(value: string): NutrientProduct[] {
  return value.split('\n').flatMap((line) => {
    const [nameValue, amountValue = '', unitValue = ''] = line.split('|').map((part) => part.trim());
    if (!nameValue) return [];
    return [{ name: nameValue, amount: optionalNumber(amountValue), unit: unitValue }];
  });
}

function formatProducts(products: NutrientProduct[]): string {
  return products.map((product) => [product.name, product.amount ?? '', product.unit].join(' | ')).join('\n');
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Section({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return <section className="cultivation-card"><header><h3>{title}</h3><p>{detail}</p></header>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="cultivation-field"><span>{label}</span>{children}</label>;
}

function RecordActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="cultivation-record-actions"><button type="button" className="text-button" onClick={onEdit}>Edit</button><button type="button" className="text-button danger-text" onClick={onDelete}>Delete</button></div>;
}

function upsert<T extends { id: string }>(records: T[], record: T): T[] {
  return records.some((candidate) => candidate.id === record.id)
    ? records.map((candidate) => candidate.id === record.id ? record : candidate)
    : [...records, record];
}

export default function CultivationRecordsWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('irrigation');
  const [state, setState] = useState<GrowLensState>(() => loadState());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [irrigation, setIrrigation] = useState<IrrigationDraft>(() => emptyIrrigation());
  const [feeding, setFeeding] = useState<FeedingDraft>(() => emptyFeeding());
  const [reservoir, setReservoir] = useState<ReservoirDraft>(() => emptyReservoir());
  const [harvest, setHarvest] = useState<HarvestDraft>(() => emptyHarvest());
  const [outcome, setOutcome] = useState<OutcomeDraft>(() => emptyOutcome());

  const sortedIrrigation = useMemo(() => [...state.irrigationRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.irrigationRecords]);
  const sortedFeeding = useMemo(() => [...state.feedingRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.feedingRecords]);
  const sortedReservoirs = useMemo(() => [...state.reservoirRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [state.reservoirRecords]);
  const sortedHarvests = useMemo(() => [...state.harvestRecords].sort((a, b) => b.harvestDate.localeCompare(a.harvestDate)), [state.harvestRecords]);
  const sortedOutcomes = useMemo(() => [...state.observationOutcomes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [state.observationOutcomes]);

  useEffect(() => {
    const refresh = () => setState(loadState());
    window.addEventListener(STATE_SAVED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STATE_SAVED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  function commit(next: GrowLensState, success: string): void {
    saveState(next, window.localStorage, 'external');
    setState(next);
    setError('');
    setMessage(success);
  }

  function plantContext(plantId: string): { cycleId: string | null; spaceId: string | null } {
    const plant = state.plants.find((candidate) => candidate.id === plantId);
    return { cycleId: plant?.cycleId || null, spaceId: plant?.spaceId || null };
  }

  function submitIrrigation(event: FormEvent): void {
    event.preventDefault();
    const timestamp = new Date().toISOString();
    const context = plantContext(irrigation.plantId);
    const record: IrrigationRecord = {
      id: irrigation.id || createId('irrigation'),
      plantId: irrigation.plantId || null,
      cycleId: context.cycleId,
      spaceId: context.spaceId,
      sourceWater: irrigation.sourceWater.trim(),
      volumeAppliedMl: requiredNumber(irrigation.volumeAppliedMl),
      runoffVolumeMl: optionalNumber(irrigation.runoffVolumeMl),
      inputPh: optionalNumber(irrigation.inputPh),
      inputEcMsCm: optionalNumber(irrigation.inputEcMsCm),
      runoffPh: optionalNumber(irrigation.runoffPh),
      runoffEcMsCm: optionalNumber(irrigation.runoffEcMsCm),
      substrateMoisturePercent: optionalNumber(irrigation.substrateMoisturePercent),
      drybackPercent: optionalNumber(irrigation.drybackPercent),
      irrigationTimeMinutes: optionalNumber(irrigation.irrigationTimeMinutes),
      reservoirId: irrigation.reservoirId || null,
      recipeNotes: irrigation.recipeNotes.trim(),
      productsUsed: list(irrigation.productsUsed),
      createdAt: state.irrigationRecords.find((candidate) => candidate.id === irrigation.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const errors = validateIrrigationInput(record);
    if (errors.length) { setError(errors.join(' ')); return; }
    commit({ ...state, irrigationRecords: upsert(state.irrigationRecords, record) }, irrigation.id ? 'Irrigation record updated.' : 'Irrigation record saved.');
    setIrrigation(emptyIrrigation());
  }

  function submitFeeding(event: FormEvent): void {
    event.preventDefault();
    const volume = requiredNumber(feeding.waterVolumeMl);
    if (!Number.isFinite(volume) || volume <= 0) { setError('Water volume must be greater than zero.'); return; }
    const timestamp = new Date().toISOString();
    const context = plantContext(feeding.plantId);
    const record: FeedingRecord = {
      id: feeding.id || createId('feeding'),
      plantId: feeding.plantId || null,
      cycleId: context.cycleId,
      reservoirId: feeding.reservoirId || null,
      waterVolumeMl: volume,
      sourceWater: feeding.sourceWater.trim(),
      startingEcMsCm: optionalNumber(feeding.startingEcMsCm),
      finalEcMsCm: optionalNumber(feeding.finalEcMsCm),
      finalPh: optionalNumber(feeding.finalPh),
      ppm: optionalNumber(feeding.ppm),
      ppmScale: feeding.ppmScale ? Number(feeding.ppmScale) as 500 | 700 : null,
      products: parseProducts(feeding.products),
      additives: list(feeding.additives),
      mixingNotes: feeding.mixingNotes.trim(),
      createdAt: state.feedingRecords.find((candidate) => candidate.id === feeding.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    if (record.finalPh !== null && (record.finalPh < 0 || record.finalPh > 14)) { setError('Final pH must be between 0 and 14.'); return; }
    if (record.finalEcMsCm !== null && (record.finalEcMsCm < 0 || record.finalEcMsCm > 20)) { setError('Final EC must be between 0 and 20 mS/cm.'); return; }
    commit({ ...state, feedingRecords: upsert(state.feedingRecords, record) }, feeding.id ? 'Feeding record updated.' : 'Feeding record saved.');
    setFeeding(emptyFeeding());
  }

  function submitReservoir(event: FormEvent): void {
    event.preventDefault();
    if (!reservoir.name.trim()) { setError('Reservoir name is required.'); return; }
    const timestamp = new Date().toISOString();
    const record: ReservoirRecord = {
      id: reservoir.id || createId('reservoir'),
      spaceId: reservoir.spaceId || null,
      name: reservoir.name.trim(),
      sourceWater: reservoir.sourceWater.trim(),
      capacityLiters: optionalNumber(reservoir.capacityLiters),
      currentVolumeLiters: optionalNumber(reservoir.currentVolumeLiters),
      ph: optionalNumber(reservoir.ph),
      ecMsCm: optionalNumber(reservoir.ecMsCm),
      temperatureC: optionalNumber(reservoir.temperatureC),
      mixedAt: toIso(reservoir.mixedAt),
      notes: reservoir.notes.trim(),
      createdAt: state.reservoirRecords.find((candidate) => candidate.id === reservoir.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    if (record.ph !== null && (record.ph < 0 || record.ph > 14)) { setError('Reservoir pH must be between 0 and 14.'); return; }
    if (record.ecMsCm !== null && (record.ecMsCm < 0 || record.ecMsCm > 20)) { setError('Reservoir EC must be between 0 and 20 mS/cm.'); return; }
    commit({ ...state, reservoirRecords: upsert(state.reservoirRecords, record) }, reservoir.id ? 'Reservoir record updated.' : 'Reservoir record saved.');
    setReservoir(emptyReservoir());
  }

  function submitHarvest(event: FormEvent): void {
    event.preventDefault();
    const timestamp = new Date().toISOString();
    const context = plantContext(harvest.plantId);
    const record: HarvestRecord = {
      id: harvest.id || createId('harvest'),
      plantId: harvest.plantId,
      cycleId: context.cycleId,
      lotId: harvest.lotId.trim(),
      harvestDate: harvest.harvestDate,
      wetWeightG: optionalNumber(harvest.wetWeightG),
      dryWeightG: optionalNumber(harvest.dryWeightG),
      trimmedWeightG: optionalNumber(harvest.trimmedWeightG),
      wasteWeightG: optionalNumber(harvest.wasteWeightG),
      dryingTemperatureC: optionalNumber(harvest.dryingTemperatureC),
      dryingHumidity: optionalNumber(harvest.dryingHumidity),
      dryingDays: optionalNumber(harvest.dryingDays),
      cureStartedAt: harvest.cureStartedAt ? `${harvest.cureStartedAt}T00:00:00.000Z` : null,
      cureCheckpoints: list(harvest.cureCheckpoints),
      finalPhotoIds: list(harvest.finalPhotoIds).filter((id) => id.startsWith('photo-')),
      notes: harvest.notes.trim(),
      createdAt: state.harvestRecords.find((candidate) => candidate.id === harvest.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const errors = validateHarvestInput(record);
    if (errors.length) { setError(errors.join(' ')); return; }
    const nextPlants = state.plants.map((plant) => plant.id === record.plantId ? { ...plant, status: 'harvested' as const } : plant);
    commit({ ...state, plants: nextPlants, harvestRecords: upsert(state.harvestRecords, record) }, harvest.id ? 'Harvest record updated.' : 'Harvest record saved and plant marked harvested.');
    setHarvest(emptyHarvest());
  }

  function submitOutcome(event: FormEvent): void {
    event.preventDefault();
    const observation = state.observations.find((candidate) => candidate.id === outcome.observationId);
    if (!observation) { setError('Choose an observation.'); return; }
    const timestamp = new Date().toISOString();
    const record: ObservationOutcome = {
      id: outcome.id || createId('outcome'),
      observationId: observation.id,
      plantId: observation.plantId,
      status: outcome.status,
      verifiedCause: outcome.verifiedCause.trim(),
      actionTaken: outcome.actionTaken.trim(),
      outcomeNotes: outcome.outcomeNotes.trim(),
      resolvedAt: outcome.status === 'resolved' ? (toIso(outcome.resolvedAt) ?? timestamp) : null,
      createdAt: state.observationOutcomes.find((candidate) => candidate.id === outcome.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    commit({ ...state, observationOutcomes: upsert(state.observationOutcomes, record) }, outcome.id ? 'Observation outcome updated.' : 'Observation outcome saved.');
    setOutcome(emptyOutcome());
  }

  function remove(collection: keyof Pick<GrowLensState, 'irrigationRecords' | 'feedingRecords' | 'reservoirRecords' | 'harvestRecords' | 'observationOutcomes'>, id: string, label: string): void {
    if (!window.confirm(`Delete this ${label}?`)) return;
    commit({ ...state, [collection]: state[collection].filter((record) => record.id !== id) }, `${label[0].toUpperCase()}${label.slice(1)} deleted.`);
  }

  function editIrrigation(record: IrrigationRecord): void {
    setIrrigation({ id: record.id, plantId: record.plantId ?? '', sourceWater: record.sourceWater, volumeAppliedMl: String(record.volumeAppliedMl), runoffVolumeMl: record.runoffVolumeMl?.toString() ?? '', inputPh: record.inputPh?.toString() ?? '', inputEcMsCm: record.inputEcMsCm?.toString() ?? '', runoffPh: record.runoffPh?.toString() ?? '', runoffEcMsCm: record.runoffEcMsCm?.toString() ?? '', substrateMoisturePercent: record.substrateMoisturePercent?.toString() ?? '', drybackPercent: record.drybackPercent?.toString() ?? '', irrigationTimeMinutes: record.irrigationTimeMinutes?.toString() ?? '', reservoirId: record.reservoirId ?? '', productsUsed: record.productsUsed.join(', '), recipeNotes: record.recipeNotes });
  }

  function editFeeding(record: FeedingRecord): void {
    setFeeding({ id: record.id, plantId: record.plantId ?? '', reservoirId: record.reservoirId ?? '', waterVolumeMl: String(record.waterVolumeMl), sourceWater: record.sourceWater, startingEcMsCm: record.startingEcMsCm?.toString() ?? '', finalEcMsCm: record.finalEcMsCm?.toString() ?? '', finalPh: record.finalPh?.toString() ?? '', ppm: record.ppm?.toString() ?? '', ppmScale: record.ppmScale ? String(record.ppmScale) as '500' | '700' : '', products: formatProducts(record.products), additives: record.additives.join(', '), mixingNotes: record.mixingNotes });
  }

  function editReservoir(record: ReservoirRecord): void {
    setReservoir({ id: record.id, spaceId: record.spaceId ?? '', name: record.name, sourceWater: record.sourceWater, capacityLiters: record.capacityLiters?.toString() ?? '', currentVolumeLiters: record.currentVolumeLiters?.toString() ?? '', ph: record.ph?.toString() ?? '', ecMsCm: record.ecMsCm?.toString() ?? '', temperatureC: record.temperatureC?.toString() ?? '', mixedAt: record.mixedAt ? record.mixedAt.slice(0, 16) : '', notes: record.notes });
  }

  function editHarvest(record: HarvestRecord): void {
    setHarvest({ id: record.id, plantId: record.plantId, lotId: record.lotId, harvestDate: record.harvestDate, wetWeightG: record.wetWeightG?.toString() ?? '', dryWeightG: record.dryWeightG?.toString() ?? '', trimmedWeightG: record.trimmedWeightG?.toString() ?? '', wasteWeightG: record.wasteWeightG?.toString() ?? '', dryingTemperatureC: record.dryingTemperatureC?.toString() ?? '', dryingHumidity: record.dryingHumidity?.toString() ?? '', dryingDays: record.dryingDays?.toString() ?? '', cureStartedAt: record.cureStartedAt?.slice(0, 10) ?? '', cureCheckpoints: record.cureCheckpoints.join('\n'), finalPhotoIds: record.finalPhotoIds.join(', '), notes: record.notes });
  }

  function editOutcome(record: ObservationOutcome): void {
    setOutcome({ id: record.id, observationId: record.observationId, status: record.status, verifiedCause: record.verifiedCause, actionTaken: record.actionTaken, outcomeNotes: record.outcomeNotes, resolvedAt: record.resolvedAt?.slice(0, 16) ?? '' });
  }

  const plantOptions = <><option value="">Whole grow / unassigned</option>{state.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</>;
  const reservoirOptions = <><option value="">No reservoir link</option>{state.reservoirRecords.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</>;

  function renderIrrigation() {
    return <div className="cultivation-layout"><Section title={irrigation.id ? 'Edit irrigation record' : 'Record irrigation'} detail="Measure what was applied and, when available, runoff, pH, EC, moisture, and dryback."><form className="cultivation-form" onSubmit={submitIrrigation}><Field label="Plant"><select value={irrigation.plantId} onChange={(event) => setIrrigation({ ...irrigation, plantId: event.target.value })}>{plantOptions}</select></Field><Field label="Source water"><input value={irrigation.sourceWater} onChange={(event) => setIrrigation({ ...irrigation, sourceWater: event.target.value })} placeholder="Filtered tap, RO, well" /></Field><Field label="Volume applied (mL)"><input type="number" min="1" required value={irrigation.volumeAppliedMl} onChange={(event) => setIrrigation({ ...irrigation, volumeAppliedMl: event.target.value })} /></Field><Field label="Runoff volume (mL)"><input type="number" min="0" value={irrigation.runoffVolumeMl} onChange={(event) => setIrrigation({ ...irrigation, runoffVolumeMl: event.target.value })} /></Field><Field label="Input pH"><input type="number" min="0" max="14" step="0.01" value={irrigation.inputPh} onChange={(event) => setIrrigation({ ...irrigation, inputPh: event.target.value })} /></Field><Field label="Input EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={irrigation.inputEcMsCm} onChange={(event) => setIrrigation({ ...irrigation, inputEcMsCm: event.target.value })} /></Field><Field label="Runoff pH"><input type="number" min="0" max="14" step="0.01" value={irrigation.runoffPh} onChange={(event) => setIrrigation({ ...irrigation, runoffPh: event.target.value })} /></Field><Field label="Runoff EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={irrigation.runoffEcMsCm} onChange={(event) => setIrrigation({ ...irrigation, runoffEcMsCm: event.target.value })} /></Field><Field label="Substrate moisture (%)"><input type="number" min="0" max="100" step="0.1" value={irrigation.substrateMoisturePercent} onChange={(event) => setIrrigation({ ...irrigation, substrateMoisturePercent: event.target.value })} /></Field><Field label="Dryback (%)"><input type="number" min="0" max="100" step="0.1" value={irrigation.drybackPercent} onChange={(event) => setIrrigation({ ...irrigation, drybackPercent: event.target.value })} /></Field><Field label="Irrigation time (minutes)"><input type="number" min="0" step="0.1" value={irrigation.irrigationTimeMinutes} onChange={(event) => setIrrigation({ ...irrigation, irrigationTimeMinutes: event.target.value })} /></Field><Field label="Reservoir"><select value={irrigation.reservoirId} onChange={(event) => setIrrigation({ ...irrigation, reservoirId: event.target.value })}>{reservoirOptions}</select></Field><Field label="Products used"><input value={irrigation.productsUsed} onChange={(event) => setIrrigation({ ...irrigation, productsUsed: event.target.value })} placeholder="Comma-separated" /></Field><Field label="Recipe and context notes"><textarea value={irrigation.recipeNotes} onChange={(event) => setIrrigation({ ...irrigation, recipeNotes: event.target.value })} /></Field><div className="cultivation-form-actions"><button className="primary-button" type="submit">{irrigation.id ? 'Update irrigation' : 'Save irrigation'}</button>{irrigation.id ? <button className="secondary-button" type="button" onClick={() => setIrrigation(emptyIrrigation())}>Cancel edit</button> : null}</div></form></Section><Section title="Irrigation history" detail={`${sortedIrrigation.length} measured irrigation record${sortedIrrigation.length === 1 ? '' : 's'}.`}><div className="cultivation-list">{sortedIrrigation.map((record) => { const plant = state.plants.find((candidate) => candidate.id === record.plantId); const runoff = irrigationRunoffPercent(record); return <article className="cultivation-record" key={record.id}><div><strong>{plant?.name ?? 'Whole grow'} · {record.volumeAppliedMl} mL</strong><span>{formatDateTime(record.createdAt)}{runoff === null ? '' : ` · ${runoff}% runoff`}</span><p>Input {record.inputPh ?? '—'} pH / {record.inputEcMsCm ?? '—'} EC · Runoff {record.runoffPh ?? '—'} pH / {record.runoffEcMsCm ?? '—'} EC</p></div><RecordActions onEdit={() => editIrrigation(record)} onDelete={() => remove('irrigationRecords', record.id, 'irrigation record')} /></article>; })}{sortedIrrigation.length === 0 ? <div className="empty-state"><strong>No irrigation measurements</strong><span>Add measured water, runoff, pH, and EC records.</span></div> : null}</div></Section></div>;
  }

  function renderFeeding() {
    return <div className="cultivation-layout"><Section title={feeding.id ? 'Edit feeding record' : 'Record feed mix'} detail="Keep source water, starting and final strength, products, additives, and mixing notes together."><form className="cultivation-form" onSubmit={submitFeeding}><Field label="Plant"><select value={feeding.plantId} onChange={(event) => setFeeding({ ...feeding, plantId: event.target.value })}>{plantOptions}</select></Field><Field label="Reservoir"><select value={feeding.reservoirId} onChange={(event) => setFeeding({ ...feeding, reservoirId: event.target.value })}>{reservoirOptions}</select></Field><Field label="Water volume (mL)"><input type="number" min="1" required value={feeding.waterVolumeMl} onChange={(event) => setFeeding({ ...feeding, waterVolumeMl: event.target.value })} /></Field><Field label="Source water"><input value={feeding.sourceWater} onChange={(event) => setFeeding({ ...feeding, sourceWater: event.target.value })} /></Field><Field label="Starting EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={feeding.startingEcMsCm} onChange={(event) => setFeeding({ ...feeding, startingEcMsCm: event.target.value })} /></Field><Field label="Final EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={feeding.finalEcMsCm} onChange={(event) => setFeeding({ ...feeding, finalEcMsCm: event.target.value })} /></Field><Field label="Final pH"><input type="number" min="0" max="14" step="0.01" value={feeding.finalPh} onChange={(event) => setFeeding({ ...feeding, finalPh: event.target.value })} /></Field><Field label="PPM"><input type="number" min="0" max="20000" value={feeding.ppm} onChange={(event) => setFeeding({ ...feeding, ppm: event.target.value })} /></Field><Field label="PPM scale"><select value={feeding.ppmScale} onChange={(event) => setFeeding({ ...feeding, ppmScale: event.target.value as FeedingDraft['ppmScale'] })}><option value="">Not recorded</option><option value="500">500 scale</option><option value="700">700 scale</option></select></Field><Field label="Products: name | amount | unit"><textarea value={feeding.products} onChange={(event) => setFeeding({ ...feeding, products: event.target.value })} placeholder={'Base A | 8 | mL\nBase B | 8 | mL'} /></Field><Field label="Additives"><input value={feeding.additives} onChange={(event) => setFeeding({ ...feeding, additives: event.target.value })} placeholder="Comma-separated" /></Field><Field label="Mixing notes"><textarea value={feeding.mixingNotes} onChange={(event) => setFeeding({ ...feeding, mixingNotes: event.target.value })} /></Field><div className="cultivation-form-actions"><button className="primary-button" type="submit">{feeding.id ? 'Update feeding' : 'Save feeding'}</button>{feeding.id ? <button className="secondary-button" type="button" onClick={() => setFeeding(emptyFeeding())}>Cancel edit</button> : null}</div></form></Section><Section title="Feeding history" detail={`${sortedFeeding.length} feed record${sortedFeeding.length === 1 ? '' : 's'}.`}><div className="cultivation-list">{sortedFeeding.map((record) => { const plant = state.plants.find((candidate) => candidate.id === record.plantId); return <article className="cultivation-record" key={record.id}><div><strong>{plant?.name ?? 'Whole grow'} · {record.waterVolumeMl} mL mix</strong><span>{formatDateTime(record.createdAt)} · {record.finalEcMsCm ?? '—'} EC · {record.finalPh ?? '—'} pH</span><p>{record.products.map((product) => `${product.name}${product.amount === null ? '' : ` ${product.amount}${product.unit}`}`).join(', ') || 'No products itemized'}</p></div><RecordActions onEdit={() => editFeeding(record)} onDelete={() => remove('feedingRecords', record.id, 'feeding record')} /></article>; })}{sortedFeeding.length === 0 ? <div className="empty-state"><strong>No feed mixes</strong><span>Record source water, products, pH, EC, and PPM scale.</span></div> : null}</div></Section></div>;
  }

  function renderReservoirs() {
    return <div className="cultivation-layout"><Section title={reservoir.id ? 'Edit reservoir record' : 'Record reservoir or tank'} detail="Track tank identity, volume, source water, solution temperature, pH, EC, and mix time."><form className="cultivation-form" onSubmit={submitReservoir}><Field label="Name"><input required value={reservoir.name} onChange={(event) => setReservoir({ ...reservoir, name: event.target.value })} placeholder="Flower Tent A reservoir" /></Field><Field label="Grow space"><select value={reservoir.spaceId} onChange={(event) => setReservoir({ ...reservoir, spaceId: event.target.value })}><option value="">Unassigned</option>{state.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></Field><Field label="Source water"><input value={reservoir.sourceWater} onChange={(event) => setReservoir({ ...reservoir, sourceWater: event.target.value })} /></Field><Field label="Capacity (L)"><input type="number" min="0" step="0.1" value={reservoir.capacityLiters} onChange={(event) => setReservoir({ ...reservoir, capacityLiters: event.target.value })} /></Field><Field label="Current volume (L)"><input type="number" min="0" step="0.1" value={reservoir.currentVolumeLiters} onChange={(event) => setReservoir({ ...reservoir, currentVolumeLiters: event.target.value })} /></Field><Field label="pH"><input type="number" min="0" max="14" step="0.01" value={reservoir.ph} onChange={(event) => setReservoir({ ...reservoir, ph: event.target.value })} /></Field><Field label="EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={reservoir.ecMsCm} onChange={(event) => setReservoir({ ...reservoir, ecMsCm: event.target.value })} /></Field><Field label="Solution temperature (°C)"><input type="number" min="-20" max="80" step="0.1" value={reservoir.temperatureC} onChange={(event) => setReservoir({ ...reservoir, temperatureC: event.target.value })} /></Field><Field label="Mixed at"><input type="datetime-local" value={reservoir.mixedAt} onChange={(event) => setReservoir({ ...reservoir, mixedAt: event.target.value })} /></Field><Field label="Notes"><textarea value={reservoir.notes} onChange={(event) => setReservoir({ ...reservoir, notes: event.target.value })} /></Field><div className="cultivation-form-actions"><button className="primary-button" type="submit">{reservoir.id ? 'Update reservoir' : 'Save reservoir'}</button>{reservoir.id ? <button className="secondary-button" type="button" onClick={() => setReservoir(emptyReservoir())}>Cancel edit</button> : null}</div></form></Section><Section title="Reservoir history" detail={`${sortedReservoirs.length} tank or reservoir record${sortedReservoirs.length === 1 ? '' : 's'}.`}><div className="cultivation-list">{sortedReservoirs.map((record) => <article className="cultivation-record" key={record.id}><div><strong>{record.name}</strong><span>{record.currentVolumeLiters ?? '—'} L of {record.capacityLiters ?? '—'} L · {record.ph ?? '—'} pH · {record.ecMsCm ?? '—'} EC</span><p>{record.sourceWater || 'Source water not recorded'}{record.temperatureC === null ? '' : ` · ${record.temperatureC}°C`}</p></div><RecordActions onEdit={() => editReservoir(record)} onDelete={() => remove('reservoirRecords', record.id, 'reservoir record')} /></article>)}{sortedReservoirs.length === 0 ? <div className="empty-state"><strong>No reservoir records</strong><span>Add tank volumes, solution strength, temperature, and mix times.</span></div> : null}</div></Section></div>;
  }

  function renderHarvest() {
    return <div className="cultivation-layout"><Section title={harvest.id ? 'Edit harvest record' : 'Record harvest and yield'} detail="Track lot identity, wet, dry, trimmed, and waste weights plus drying and cure checkpoints."><form className="cultivation-form" onSubmit={submitHarvest}><Field label="Plant"><select required value={harvest.plantId} onChange={(event) => setHarvest({ ...harvest, plantId: event.target.value })}><option value="">Choose plant</option>{state.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</select></Field><Field label="Lot ID"><input value={harvest.lotId} onChange={(event) => setHarvest({ ...harvest, lotId: event.target.value })} /></Field><Field label="Harvest date"><input type="date" required value={harvest.harvestDate} onChange={(event) => setHarvest({ ...harvest, harvestDate: event.target.value })} /></Field><Field label="Wet weight (g)"><input type="number" min="0" step="0.1" value={harvest.wetWeightG} onChange={(event) => setHarvest({ ...harvest, wetWeightG: event.target.value })} /></Field><Field label="Dry weight (g)"><input type="number" min="0" step="0.1" value={harvest.dryWeightG} onChange={(event) => setHarvest({ ...harvest, dryWeightG: event.target.value })} /></Field><Field label="Trimmed weight (g)"><input type="number" min="0" step="0.1" value={harvest.trimmedWeightG} onChange={(event) => setHarvest({ ...harvest, trimmedWeightG: event.target.value })} /></Field><Field label="Waste/loss (g)"><input type="number" min="0" step="0.1" value={harvest.wasteWeightG} onChange={(event) => setHarvest({ ...harvest, wasteWeightG: event.target.value })} /></Field><Field label="Drying temperature (°C)"><input type="number" min="-20" max="80" step="0.1" value={harvest.dryingTemperatureC} onChange={(event) => setHarvest({ ...harvest, dryingTemperatureC: event.target.value })} /></Field><Field label="Drying RH (%)"><input type="number" min="0" max="100" step="0.1" value={harvest.dryingHumidity} onChange={(event) => setHarvest({ ...harvest, dryingHumidity: event.target.value })} /></Field><Field label="Drying duration (days)"><input type="number" min="0" max="365" step="0.1" value={harvest.dryingDays} onChange={(event) => setHarvest({ ...harvest, dryingDays: event.target.value })} /></Field><Field label="Cure started"><input type="date" value={harvest.cureStartedAt} onChange={(event) => setHarvest({ ...harvest, cureStartedAt: event.target.value })} /></Field><Field label="Cure checkpoints"><textarea value={harvest.cureCheckpoints} onChange={(event) => setHarvest({ ...harvest, cureCheckpoints: event.target.value })} placeholder="One checkpoint per line" /></Field><Field label="Final photo IDs"><input value={harvest.finalPhotoIds} onChange={(event) => setHarvest({ ...harvest, finalPhotoIds: event.target.value })} placeholder="Optional comma-separated photo IDs" /></Field><Field label="Notes"><textarea value={harvest.notes} onChange={(event) => setHarvest({ ...harvest, notes: event.target.value })} /></Field><div className="cultivation-form-actions"><button className="primary-button" type="submit">{harvest.id ? 'Update harvest' : 'Save harvest'}</button>{harvest.id ? <button className="secondary-button" type="button" onClick={() => setHarvest(emptyHarvest())}>Cancel edit</button> : null}</div></form></Section><Section title="Harvest history" detail={`${sortedHarvests.length} harvest record${sortedHarvests.length === 1 ? '' : 's'}.`}><div className="cultivation-list">{sortedHarvests.map((record) => { const plant = state.plants.find((candidate) => candidate.id === record.plantId); const loss = harvestDryLossPercent(record); return <article className="cultivation-record" key={record.id}><div><strong>{plant?.name ?? 'Unknown plant'} · {record.lotId || record.harvestDate}</strong><span>{record.harvestDate} · Wet {record.wetWeightG ?? '—'} g · Dry {record.dryWeightG ?? '—'} g</span><p>Trimmed {record.trimmedWeightG ?? '—'} g · Waste {record.wasteWeightG ?? '—'} g{loss === null ? '' : ` · ${loss}% wet-to-dry loss`}</p></div><RecordActions onEdit={() => editHarvest(record)} onDelete={() => remove('harvestRecords', record.id, 'harvest record')} /></article>; })}{sortedHarvests.length === 0 ? <div className="empty-state"><strong>No harvest records</strong><span>Track wet, dry, trimmed, waste, drying, cure, and lot details.</span></div> : null}</div></Section></div>;
  }

  function renderOutcomes() {
    return <div className="cultivation-layout"><Section title={outcome.id ? 'Edit observation outcome' : 'Record observation outcome'} detail="Close the loop by recording what evidence verified, ruled out, or resolved an earlier possibility."><form className="cultivation-form" onSubmit={submitOutcome}><Field label="Observation"><select required value={outcome.observationId} onChange={(event) => setOutcome({ ...outcome, observationId: event.target.value })}><option value="">Choose observation</option>{state.observations.map((observation) => { const plant = state.plants.find((candidate) => candidate.id === observation.plantId); return <option key={observation.id} value={observation.id}>{plant?.name ?? 'Unassigned'} · {observation.possibleCauses[0] ?? observation.symptoms.join(', ') || 'Observation'}</option>; })}</select></Field><Field label="Outcome status"><select value={outcome.status} onChange={(event) => setOutcome({ ...outcome, status: event.target.value as ObservationOutcomeStatus })}><option value="monitoring">Monitoring</option><option value="confirmed">Confirmed</option><option value="ruled-out">Ruled out</option><option value="resolved">Resolved</option></select></Field><Field label="Verified cause or conclusion"><input value={outcome.verifiedCause} onChange={(event) => setOutcome({ ...outcome, verifiedCause: event.target.value })} /></Field><Field label="Action taken"><textarea value={outcome.actionTaken} onChange={(event) => setOutcome({ ...outcome, actionTaken: event.target.value })} /></Field><Field label="Outcome notes"><textarea value={outcome.outcomeNotes} onChange={(event) => setOutcome({ ...outcome, outcomeNotes: event.target.value })} /></Field>{outcome.status === 'resolved' ? <Field label="Resolved at"><input type="datetime-local" value={outcome.resolvedAt} onChange={(event) => setOutcome({ ...outcome, resolvedAt: event.target.value })} /></Field> : null}<div className="cultivation-form-actions"><button className="primary-button" type="submit">{outcome.id ? 'Update outcome' : 'Save outcome'}</button>{outcome.id ? <button className="secondary-button" type="button" onClick={() => setOutcome(emptyOutcome())}>Cancel edit</button> : null}</div></form></Section><Section title="Outcome history" detail={`${sortedOutcomes.length} observation outcome${sortedOutcomes.length === 1 ? '' : 's'}.`}><div className="cultivation-list">{sortedOutcomes.map((record) => { const observation = state.observations.find((candidate) => candidate.id === record.observationId); const plant = state.plants.find((candidate) => candidate.id === record.plantId); return <article className="cultivation-record" key={record.id}><div><strong>{plant?.name ?? 'Unassigned'} · {record.status}</strong><span>{formatDateTime(record.updatedAt)} · Original: {observation?.possibleCauses[0] ?? 'Observation'}</span><p>{record.verifiedCause || record.actionTaken || record.outcomeNotes || 'No conclusion recorded yet.'}</p></div><RecordActions onEdit={() => editOutcome(record)} onDelete={() => remove('observationOutcomes', record.id, 'observation outcome')} /></article>; })}{sortedOutcomes.length === 0 ? <div className="empty-state"><strong>No outcomes recorded</strong><span>Use verification evidence to confirm, rule out, monitor, or resolve observations.</span></div> : null}</div></Section></div>;
  }

  let content: ReactNode;
  if (tab === 'feeding') content = renderFeeding();
  else if (tab === 'reservoirs') content = renderReservoirs();
  else if (tab === 'harvest') content = renderHarvest();
  else if (tab === 'outcomes') content = renderOutcomes();
  else content = renderIrrigation();

  return <><button className="cultivation-launcher" type="button" onClick={() => { setState(loadState()); setOpen(true); setMessage(''); setError(''); }} aria-label="Open structured cultivation records"><span aria-hidden="true">▦</span><strong>Records</strong></button>{open ? <div className="cultivation-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}><section className="cultivation-panel" role="dialog" aria-modal="true" aria-labelledby="cultivation-title"><header className="cultivation-header"><div><span className="eyebrow">Measured cultivation history</span><h2 id="cultivation-title">Cultivation records</h2><p>Structured water, feed, reservoir, harvest, yield, and observation-outcome records.</p></div><button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close cultivation records">×</button></header>{error ? <div className="account-message error" role="alert">{error}</div> : null}{message ? <div className="account-message success" role="status">{message}</div> : null}<nav className="cultivation-tabs" aria-label="Cultivation record sections">{tabs.map((item) => <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setError(''); setMessage(''); }}>{item.label}<span>{item.id === 'irrigation' ? state.irrigationRecords.length : item.id === 'feeding' ? state.feedingRecords.length : item.id === 'reservoirs' ? state.reservoirRecords.length : item.id === 'harvest' ? state.harvestRecords.length : state.observationOutcomes.length}</span></button>)}</nav><div className="cultivation-body">{content}</div></section></div> : null}</>;
}
