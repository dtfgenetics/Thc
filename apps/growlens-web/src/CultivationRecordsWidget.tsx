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
type DraftBase = { id: string };

type IrrigationDraft = DraftBase & {
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

type FeedingDraft = DraftBase & {
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

type ReservoirDraft = DraftBase & {
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

type HarvestDraft = DraftBase & {
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

type OutcomeDraft = DraftBase & {
  observationId: string;
  status: ObservationOutcomeStatus;
  verifiedCause: string;
  actionTaken: string;
  outcomeNotes: string;
  resolvedAt: string;
};

const tabDefinitions: Array<{ id: Tab; label: string }> = [
  { id: 'irrigation', label: 'Irrigation' },
  { id: 'feeding', label: 'Feeding' },
  { id: 'reservoirs', label: 'Reservoirs' },
  { id: 'harvest', label: 'Harvest' },
  { id: 'outcomes', label: 'Outcomes' },
];

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function localDateTimeInput(value = new Date()): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function emptyIrrigation(): IrrigationDraft {
  return {
    id: '', plantId: '', sourceWater: '', volumeAppliedMl: '', runoffVolumeMl: '',
    inputPh: '', inputEcMsCm: '', runoffPh: '', runoffEcMsCm: '',
    substrateMoisturePercent: '', drybackPercent: '', irrigationTimeMinutes: '',
    reservoirId: '', productsUsed: '', recipeNotes: '',
  };
}

function emptyFeeding(): FeedingDraft {
  return {
    id: '', plantId: '', reservoirId: '', waterVolumeMl: '', sourceWater: '',
    startingEcMsCm: '', finalEcMsCm: '', finalPh: '', ppm: '', ppmScale: '',
    products: '', additives: '', mixingNotes: '',
  };
}

function emptyReservoir(): ReservoirDraft {
  return {
    id: '', spaceId: '', name: '', sourceWater: '', capacityLiters: '',
    currentVolumeLiters: '', ph: '', ecMsCm: '', temperatureC: '',
    mixedAt: localDateTimeInput(), notes: '',
  };
}

function emptyHarvest(): HarvestDraft {
  return {
    id: '', plantId: '', lotId: '', harvestDate: todayInput(), wetWeightG: '',
    dryWeightG: '', trimmedWeightG: '', wasteWeightG: '', dryingTemperatureC: '',
    dryingHumidity: '', dryingDays: '', cureStartedAt: '', cureCheckpoints: '',
    finalPhotoIds: '', notes: '',
  };
}

function emptyOutcome(): OutcomeDraft {
  return {
    id: '', observationId: '', status: 'monitoring', verifiedCause: '',
    actionTaken: '', outcomeNotes: '', resolvedAt: '',
  };
}

function optionalNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function parseProducts(value: string): NutrientProduct[] {
  return value.split('\n').flatMap((line) => {
    const [name = '', amount = '', unit = ''] = line.split('|').map((item) => item.trim());
    return name ? [{ name, amount: optionalNumber(amount), unit }] : [];
  });
}

function serializeProducts(products: NutrientProduct[]): string {
  return products.map((product) => `${product.name} | ${product.amount ?? ''} | ${product.unit}`).join('\n');
}

function toIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function upsert<T extends { id: string }>(records: T[], record: T): T[] {
  return records.some((item) => item.id === record.id)
    ? records.map((item) => item.id === record.id ? record : item)
    : [...records, record];
}

function Card({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return <section className="cultivation-card"><header><h3>{title}</h3><p>{detail}</p></header>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="cultivation-field"><span>{label}</span>{children}</label>;
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="cultivation-record-actions">
    <button type="button" className="text-button" onClick={onEdit}>Edit</button>
    <button type="button" className="text-button danger-text" onClick={onDelete}>Delete</button>
  </div>;
}

export default function CultivationRecordsWidget() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('irrigation');
  const [state, setState] = useState<GrowLensState>(() => loadState());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [irrigation, setIrrigation] = useState<IrrigationDraft>(emptyIrrigation);
  const [feeding, setFeeding] = useState<FeedingDraft>(emptyFeeding);
  const [reservoir, setReservoir] = useState<ReservoirDraft>(emptyReservoir);
  const [harvest, setHarvest] = useState<HarvestDraft>(emptyHarvest);
  const [outcome, setOutcome] = useState<OutcomeDraft>(emptyOutcome);

  useEffect(() => {
    const refresh = () => setState(loadState());
    window.addEventListener(STATE_SAVED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(STATE_SAVED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const irrigationHistory = useMemo(
    () => [...state.irrigationRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.irrigationRecords],
  );
  const feedingHistory = useMemo(
    () => [...state.feedingRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.feedingRecords],
  );
  const reservoirHistory = useMemo(
    () => [...state.reservoirRecords].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.reservoirRecords],
  );
  const harvestHistory = useMemo(
    () => [...state.harvestRecords].sort((a, b) => b.harvestDate.localeCompare(a.harvestDate)),
    [state.harvestRecords],
  );
  const outcomeHistory = useMemo(
    () => [...state.observationOutcomes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.observationOutcomes],
  );

  function commit(next: GrowLensState, success: string): void {
    saveState(next, window.localStorage, 'external');
    setState(next);
    setError('');
    setMessage(success);
  }

  function contextForPlant(plantId: string): { cycleId: string | null; spaceId: string | null } {
    const plant = state.plants.find((candidate) => candidate.id === plantId);
    return { cycleId: plant?.cycleId || null, spaceId: plant?.spaceId || null };
  }

  function submitIrrigation(event: FormEvent): void {
    event.preventDefault();
    const timestamp = new Date().toISOString();
    const context = contextForPlant(irrigation.plantId);
    const record: IrrigationRecord = {
      id: irrigation.id || createId('irrigation'),
      plantId: irrigation.plantId || null,
      cycleId: context.cycleId,
      spaceId: context.spaceId,
      sourceWater: irrigation.sourceWater.trim(),
      volumeAppliedMl: Number(irrigation.volumeAppliedMl),
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
      productsUsed: splitList(irrigation.productsUsed),
      createdAt: state.irrigationRecords.find((item) => item.id === irrigation.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const errors = validateIrrigationInput(record);
    if (errors.length) { setError(errors.join(' ')); return; }
    commit(
      { ...state, irrigationRecords: upsert(state.irrigationRecords, record) },
      irrigation.id ? 'Irrigation record updated.' : 'Irrigation record saved.',
    );
    setIrrigation(emptyIrrigation());
  }

  function submitFeeding(event: FormEvent): void {
    event.preventDefault();
    const waterVolumeMl = Number(feeding.waterVolumeMl);
    if (!Number.isFinite(waterVolumeMl) || waterVolumeMl <= 0) {
      setError('Water volume must be greater than zero.');
      return;
    }
    const finalPh = optionalNumber(feeding.finalPh);
    const finalEcMsCm = optionalNumber(feeding.finalEcMsCm);
    if (finalPh !== null && (finalPh < 0 || finalPh > 14)) { setError('Final pH must be between 0 and 14.'); return; }
    if (finalEcMsCm !== null && (finalEcMsCm < 0 || finalEcMsCm > 20)) { setError('Final EC must be between 0 and 20 mS/cm.'); return; }

    const timestamp = new Date().toISOString();
    const context = contextForPlant(feeding.plantId);
    const record: FeedingRecord = {
      id: feeding.id || createId('feeding'),
      plantId: feeding.plantId || null,
      cycleId: context.cycleId,
      reservoirId: feeding.reservoirId || null,
      waterVolumeMl,
      sourceWater: feeding.sourceWater.trim(),
      startingEcMsCm: optionalNumber(feeding.startingEcMsCm),
      finalEcMsCm,
      finalPh,
      ppm: optionalNumber(feeding.ppm),
      ppmScale: feeding.ppmScale ? Number(feeding.ppmScale) as 500 | 700 : null,
      products: parseProducts(feeding.products),
      additives: splitList(feeding.additives),
      mixingNotes: feeding.mixingNotes.trim(),
      createdAt: state.feedingRecords.find((item) => item.id === feeding.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    commit(
      { ...state, feedingRecords: upsert(state.feedingRecords, record) },
      feeding.id ? 'Feeding record updated.' : 'Feeding record saved.',
    );
    setFeeding(emptyFeeding());
  }

  function submitReservoir(event: FormEvent): void {
    event.preventDefault();
    if (!reservoir.name.trim()) { setError('Reservoir name is required.'); return; }
    const ph = optionalNumber(reservoir.ph);
    const ecMsCm = optionalNumber(reservoir.ecMsCm);
    if (ph !== null && (ph < 0 || ph > 14)) { setError('Reservoir pH must be between 0 and 14.'); return; }
    if (ecMsCm !== null && (ecMsCm < 0 || ecMsCm > 20)) { setError('Reservoir EC must be between 0 and 20 mS/cm.'); return; }

    const timestamp = new Date().toISOString();
    const record: ReservoirRecord = {
      id: reservoir.id || createId('reservoir'),
      spaceId: reservoir.spaceId || null,
      name: reservoir.name.trim(),
      sourceWater: reservoir.sourceWater.trim(),
      capacityLiters: optionalNumber(reservoir.capacityLiters),
      currentVolumeLiters: optionalNumber(reservoir.currentVolumeLiters),
      ph,
      ecMsCm,
      temperatureC: optionalNumber(reservoir.temperatureC),
      mixedAt: toIso(reservoir.mixedAt),
      notes: reservoir.notes.trim(),
      createdAt: state.reservoirRecords.find((item) => item.id === reservoir.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    commit(
      { ...state, reservoirRecords: upsert(state.reservoirRecords, record) },
      reservoir.id ? 'Reservoir record updated.' : 'Reservoir record saved.',
    );
    setReservoir(emptyReservoir());
  }

  function submitHarvest(event: FormEvent): void {
    event.preventDefault();
    const timestamp = new Date().toISOString();
    const context = contextForPlant(harvest.plantId);
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
      cureCheckpoints: splitList(harvest.cureCheckpoints),
      finalPhotoIds: splitList(harvest.finalPhotoIds).filter((id) => id.startsWith('photo-')),
      notes: harvest.notes.trim(),
      createdAt: state.harvestRecords.find((item) => item.id === harvest.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const errors = validateHarvestInput(record);
    if (errors.length) { setError(errors.join(' ')); return; }
    commit({
      ...state,
      plants: state.plants.map((plant) => plant.id === record.plantId ? { ...plant, status: 'harvested' } : plant),
      harvestRecords: upsert(state.harvestRecords, record),
    }, harvest.id ? 'Harvest record updated.' : 'Harvest record saved and plant marked harvested.');
    setHarvest(emptyHarvest());
  }

  function submitOutcome(event: FormEvent): void {
    event.preventDefault();
    const observation = state.observations.find((item) => item.id === outcome.observationId);
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
      createdAt: state.observationOutcomes.find((item) => item.id === outcome.id)?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    commit(
      { ...state, observationOutcomes: upsert(state.observationOutcomes, record) },
      outcome.id ? 'Observation outcome updated.' : 'Observation outcome saved.',
    );
    setOutcome(emptyOutcome());
  }

  function deleteRecord(tabName: Tab, id: string, label: string): void {
    if (!window.confirm(`Delete this ${label}?`)) return;
    let next: GrowLensState;
    switch (tabName) {
      case 'irrigation': next = { ...state, irrigationRecords: state.irrigationRecords.filter((item) => item.id !== id) }; break;
      case 'feeding': next = { ...state, feedingRecords: state.feedingRecords.filter((item) => item.id !== id) }; break;
      case 'reservoirs': next = { ...state, reservoirRecords: state.reservoirRecords.filter((item) => item.id !== id) }; break;
      case 'harvest': next = { ...state, harvestRecords: state.harvestRecords.filter((item) => item.id !== id) }; break;
      case 'outcomes': next = { ...state, observationOutcomes: state.observationOutcomes.filter((item) => item.id !== id) }; break;
    }
    commit(next, `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} deleted.`);
  }

  function editIrrigation(record: IrrigationRecord): void {
    setIrrigation({
      id: record.id, plantId: record.plantId ?? '', sourceWater: record.sourceWater,
      volumeAppliedMl: String(record.volumeAppliedMl), runoffVolumeMl: record.runoffVolumeMl?.toString() ?? '',
      inputPh: record.inputPh?.toString() ?? '', inputEcMsCm: record.inputEcMsCm?.toString() ?? '',
      runoffPh: record.runoffPh?.toString() ?? '', runoffEcMsCm: record.runoffEcMsCm?.toString() ?? '',
      substrateMoisturePercent: record.substrateMoisturePercent?.toString() ?? '', drybackPercent: record.drybackPercent?.toString() ?? '',
      irrigationTimeMinutes: record.irrigationTimeMinutes?.toString() ?? '', reservoirId: record.reservoirId ?? '',
      productsUsed: record.productsUsed.join(', '), recipeNotes: record.recipeNotes,
    });
  }

  function editFeeding(record: FeedingRecord): void {
    setFeeding({
      id: record.id, plantId: record.plantId ?? '', reservoirId: record.reservoirId ?? '',
      waterVolumeMl: String(record.waterVolumeMl), sourceWater: record.sourceWater,
      startingEcMsCm: record.startingEcMsCm?.toString() ?? '', finalEcMsCm: record.finalEcMsCm?.toString() ?? '',
      finalPh: record.finalPh?.toString() ?? '', ppm: record.ppm?.toString() ?? '',
      ppmScale: record.ppmScale ? String(record.ppmScale) as '500' | '700' : '',
      products: serializeProducts(record.products), additives: record.additives.join(', '), mixingNotes: record.mixingNotes,
    });
  }

  function editReservoir(record: ReservoirRecord): void {
    setReservoir({
      id: record.id, spaceId: record.spaceId ?? '', name: record.name, sourceWater: record.sourceWater,
      capacityLiters: record.capacityLiters?.toString() ?? '', currentVolumeLiters: record.currentVolumeLiters?.toString() ?? '',
      ph: record.ph?.toString() ?? '', ecMsCm: record.ecMsCm?.toString() ?? '', temperatureC: record.temperatureC?.toString() ?? '',
      mixedAt: record.mixedAt ? localDateTimeInput(new Date(record.mixedAt)) : '', notes: record.notes,
    });
  }

  function editHarvest(record: HarvestRecord): void {
    setHarvest({
      id: record.id, plantId: record.plantId, lotId: record.lotId, harvestDate: record.harvestDate,
      wetWeightG: record.wetWeightG?.toString() ?? '', dryWeightG: record.dryWeightG?.toString() ?? '',
      trimmedWeightG: record.trimmedWeightG?.toString() ?? '', wasteWeightG: record.wasteWeightG?.toString() ?? '',
      dryingTemperatureC: record.dryingTemperatureC?.toString() ?? '', dryingHumidity: record.dryingHumidity?.toString() ?? '',
      dryingDays: record.dryingDays?.toString() ?? '', cureStartedAt: record.cureStartedAt?.slice(0, 10) ?? '',
      cureCheckpoints: record.cureCheckpoints.join('\n'), finalPhotoIds: record.finalPhotoIds.join(', '), notes: record.notes,
    });
  }

  function editOutcome(record: ObservationOutcome): void {
    setOutcome({
      id: record.id, observationId: record.observationId, status: record.status,
      verifiedCause: record.verifiedCause, actionTaken: record.actionTaken,
      outcomeNotes: record.outcomeNotes,
      resolvedAt: record.resolvedAt ? localDateTimeInput(new Date(record.resolvedAt)) : '',
    });
  }

  const plantOptions = <>
    <option value="">Whole grow / unassigned</option>
    {state.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}
  </>;
  const reservoirOptions = <>
    <option value="">No reservoir link</option>
    {state.reservoirRecords.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
  </>;

  function irrigationTab(): ReactNode {
    return <div className="cultivation-layout">
      <Card title={irrigation.id ? 'Edit irrigation record' : 'Record irrigation'} detail="Measure applied water, runoff, pH, EC, moisture, and dryback.">
        <form className="cultivation-form" onSubmit={submitIrrigation}>
          <Field label="Plant"><select value={irrigation.plantId} onChange={(e) => setIrrigation({ ...irrigation, plantId: e.target.value })}>{plantOptions}</select></Field>
          <Field label="Source water"><input value={irrigation.sourceWater} onChange={(e) => setIrrigation({ ...irrigation, sourceWater: e.target.value })} /></Field>
          <Field label="Volume applied (mL)"><input required type="number" min="1" value={irrigation.volumeAppliedMl} onChange={(e) => setIrrigation({ ...irrigation, volumeAppliedMl: e.target.value })} /></Field>
          <Field label="Runoff volume (mL)"><input type="number" min="0" value={irrigation.runoffVolumeMl} onChange={(e) => setIrrigation({ ...irrigation, runoffVolumeMl: e.target.value })} /></Field>
          <Field label="Input pH"><input type="number" min="0" max="14" step="0.01" value={irrigation.inputPh} onChange={(e) => setIrrigation({ ...irrigation, inputPh: e.target.value })} /></Field>
          <Field label="Input EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={irrigation.inputEcMsCm} onChange={(e) => setIrrigation({ ...irrigation, inputEcMsCm: e.target.value })} /></Field>
          <Field label="Runoff pH"><input type="number" min="0" max="14" step="0.01" value={irrigation.runoffPh} onChange={(e) => setIrrigation({ ...irrigation, runoffPh: e.target.value })} /></Field>
          <Field label="Runoff EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={irrigation.runoffEcMsCm} onChange={(e) => setIrrigation({ ...irrigation, runoffEcMsCm: e.target.value })} /></Field>
          <Field label="Substrate moisture (%)"><input type="number" min="0" max="100" step="0.1" value={irrigation.substrateMoisturePercent} onChange={(e) => setIrrigation({ ...irrigation, substrateMoisturePercent: e.target.value })} /></Field>
          <Field label="Dryback (%)"><input type="number" min="0" max="100" step="0.1" value={irrigation.drybackPercent} onChange={(e) => setIrrigation({ ...irrigation, drybackPercent: e.target.value })} /></Field>
          <Field label="Irrigation time (minutes)"><input type="number" min="0" step="0.1" value={irrigation.irrigationTimeMinutes} onChange={(e) => setIrrigation({ ...irrigation, irrigationTimeMinutes: e.target.value })} /></Field>
          <Field label="Reservoir"><select value={irrigation.reservoirId} onChange={(e) => setIrrigation({ ...irrigation, reservoirId: e.target.value })}>{reservoirOptions}</select></Field>
          <Field label="Products used"><input value={irrigation.productsUsed} onChange={(e) => setIrrigation({ ...irrigation, productsUsed: e.target.value })} /></Field>
          <Field label="Recipe and context notes"><textarea value={irrigation.recipeNotes} onChange={(e) => setIrrigation({ ...irrigation, recipeNotes: e.target.value })} /></Field>
          <div className="cultivation-form-actions"><button className="primary-button" type="submit">{irrigation.id ? 'Update irrigation' : 'Save irrigation'}</button>{irrigation.id ? <button type="button" className="secondary-button" onClick={() => setIrrigation(emptyIrrigation())}>Cancel edit</button> : null}</div>
        </form>
      </Card>
      <Card title="Irrigation history" detail={`${irrigationHistory.length} measured record${irrigationHistory.length === 1 ? '' : 's'}.`}>
        <div className="cultivation-list">{irrigationHistory.map((record) => {
          const plant = state.plants.find((item) => item.id === record.plantId);
          const runoff = irrigationRunoffPercent(record);
          return <article className="cultivation-record" key={record.id}><div><strong>{plant?.name ?? 'Whole grow'} · {record.volumeAppliedMl} mL</strong><span>{formatDateTime(record.createdAt)}{runoff === null ? '' : ` · ${runoff}% runoff`}</span><p>Input {record.inputPh ?? '—'} pH / {record.inputEcMsCm ?? '—'} EC · Runoff {record.runoffPh ?? '—'} pH / {record.runoffEcMsCm ?? '—'} EC</p></div><Actions onEdit={() => editIrrigation(record)} onDelete={() => deleteRecord('irrigation', record.id, 'irrigation record')} /></article>;
        })}{irrigationHistory.length === 0 ? <div className="empty-state"><strong>No irrigation measurements</strong><span>Add applied water, runoff, pH, and EC records.</span></div> : null}</div>
      </Card>
    </div>;
  }

  function feedingTab(): ReactNode {
    return <div className="cultivation-layout">
      <Card title={feeding.id ? 'Edit feeding record' : 'Record feed mix'} detail="Track source water, strength, products, additives, and mixing notes.">
        <form className="cultivation-form" onSubmit={submitFeeding}>
          <Field label="Plant"><select value={feeding.plantId} onChange={(e) => setFeeding({ ...feeding, plantId: e.target.value })}>{plantOptions}</select></Field>
          <Field label="Reservoir"><select value={feeding.reservoirId} onChange={(e) => setFeeding({ ...feeding, reservoirId: e.target.value })}>{reservoirOptions}</select></Field>
          <Field label="Water volume (mL)"><input required type="number" min="1" value={feeding.waterVolumeMl} onChange={(e) => setFeeding({ ...feeding, waterVolumeMl: e.target.value })} /></Field>
          <Field label="Source water"><input value={feeding.sourceWater} onChange={(e) => setFeeding({ ...feeding, sourceWater: e.target.value })} /></Field>
          <Field label="Starting EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={feeding.startingEcMsCm} onChange={(e) => setFeeding({ ...feeding, startingEcMsCm: e.target.value })} /></Field>
          <Field label="Final EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={feeding.finalEcMsCm} onChange={(e) => setFeeding({ ...feeding, finalEcMsCm: e.target.value })} /></Field>
          <Field label="Final pH"><input type="number" min="0" max="14" step="0.01" value={feeding.finalPh} onChange={(e) => setFeeding({ ...feeding, finalPh: e.target.value })} /></Field>
          <Field label="PPM"><input type="number" min="0" max="20000" value={feeding.ppm} onChange={(e) => setFeeding({ ...feeding, ppm: e.target.value })} /></Field>
          <Field label="PPM scale"><select value={feeding.ppmScale} onChange={(e) => setFeeding({ ...feeding, ppmScale: e.target.value as FeedingDraft['ppmScale'] })}><option value="">Not recorded</option><option value="500">500 scale</option><option value="700">700 scale</option></select></Field>
          <Field label="Products: name | amount | unit"><textarea value={feeding.products} onChange={(e) => setFeeding({ ...feeding, products: e.target.value })} placeholder={'Bloom A | 8 | mL\nBloom B | 8 | mL'} /></Field>
          <Field label="Additives"><input value={feeding.additives} onChange={(e) => setFeeding({ ...feeding, additives: e.target.value })} /></Field>
          <Field label="Mixing notes"><textarea value={feeding.mixingNotes} onChange={(e) => setFeeding({ ...feeding, mixingNotes: e.target.value })} /></Field>
          <div className="cultivation-form-actions"><button className="primary-button" type="submit">{feeding.id ? 'Update feeding' : 'Save feeding'}</button>{feeding.id ? <button type="button" className="secondary-button" onClick={() => setFeeding(emptyFeeding())}>Cancel edit</button> : null}</div>
        </form>
      </Card>
      <Card title="Feeding history" detail={`${feedingHistory.length} feed record${feedingHistory.length === 1 ? '' : 's'}.`}>
        <div className="cultivation-list">{feedingHistory.map((record) => {
          const plant = state.plants.find((item) => item.id === record.plantId);
          return <article className="cultivation-record" key={record.id}><div><strong>{plant?.name ?? 'Whole grow'} · {record.waterVolumeMl} mL mix</strong><span>{formatDateTime(record.createdAt)} · {record.finalEcMsCm ?? '—'} EC · {record.finalPh ?? '—'} pH</span><p>{record.products.map((product) => `${product.name}${product.amount === null ? '' : ` ${product.amount}${product.unit}`}`).join(', ') || 'No products itemized'}</p></div><Actions onEdit={() => editFeeding(record)} onDelete={() => deleteRecord('feeding', record.id, 'feeding record')} /></article>;
        })}{feedingHistory.length === 0 ? <div className="empty-state"><strong>No feed mixes</strong><span>Record products, pH, EC, and PPM scale.</span></div> : null}</div>
      </Card>
    </div>;
  }

  function reservoirsTab(): ReactNode {
    return <div className="cultivation-layout">
      <Card title={reservoir.id ? 'Edit reservoir record' : 'Record reservoir or tank'} detail="Track tank volume, solution strength, temperature, and mix time.">
        <form className="cultivation-form" onSubmit={submitReservoir}>
          <Field label="Name"><input required value={reservoir.name} onChange={(e) => setReservoir({ ...reservoir, name: e.target.value })} /></Field>
          <Field label="Grow space"><select value={reservoir.spaceId} onChange={(e) => setReservoir({ ...reservoir, spaceId: e.target.value })}><option value="">Unassigned</option>{state.spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></Field>
          <Field label="Source water"><input value={reservoir.sourceWater} onChange={(e) => setReservoir({ ...reservoir, sourceWater: e.target.value })} /></Field>
          <Field label="Capacity (L)"><input type="number" min="0" step="0.1" value={reservoir.capacityLiters} onChange={(e) => setReservoir({ ...reservoir, capacityLiters: e.target.value })} /></Field>
          <Field label="Current volume (L)"><input type="number" min="0" step="0.1" value={reservoir.currentVolumeLiters} onChange={(e) => setReservoir({ ...reservoir, currentVolumeLiters: e.target.value })} /></Field>
          <Field label="pH"><input type="number" min="0" max="14" step="0.01" value={reservoir.ph} onChange={(e) => setReservoir({ ...reservoir, ph: e.target.value })} /></Field>
          <Field label="EC (mS/cm)"><input type="number" min="0" max="20" step="0.01" value={reservoir.ecMsCm} onChange={(e) => setReservoir({ ...reservoir, ecMsCm: e.target.value })} /></Field>
          <Field label="Solution temperature (°C)"><input type="number" min="-20" max="80" step="0.1" value={reservoir.temperatureC} onChange={(e) => setReservoir({ ...reservoir, temperatureC: e.target.value })} /></Field>
          <Field label="Mixed at"><input type="datetime-local" value={reservoir.mixedAt} onChange={(e) => setReservoir({ ...reservoir, mixedAt: e.target.value })} /></Field>
          <Field label="Notes"><textarea value={reservoir.notes} onChange={(e) => setReservoir({ ...reservoir, notes: e.target.value })} /></Field>
          <div className="cultivation-form-actions"><button className="primary-button" type="submit">{reservoir.id ? 'Update reservoir' : 'Save reservoir'}</button>{reservoir.id ? <button type="button" className="secondary-button" onClick={() => setReservoir(emptyReservoir())}>Cancel edit</button> : null}</div>
        </form>
      </Card>
      <Card title="Reservoir history" detail={`${reservoirHistory.length} reservoir record${reservoirHistory.length === 1 ? '' : 's'}.`}>
        <div className="cultivation-list">{reservoirHistory.map((record) => <article className="cultivation-record" key={record.id}><div><strong>{record.name}</strong><span>{record.currentVolumeLiters ?? '—'} L of {record.capacityLiters ?? '—'} L · {record.ph ?? '—'} pH · {record.ecMsCm ?? '—'} EC</span><p>{record.sourceWater || 'Source water not recorded'}{record.temperatureC === null ? '' : ` · ${record.temperatureC}°C`}</p></div><Actions onEdit={() => editReservoir(record)} onDelete={() => deleteRecord('reservoirs', record.id, 'reservoir record')} /></article>)}{reservoirHistory.length === 0 ? <div className="empty-state"><strong>No reservoir records</strong><span>Add tank volumes, solution strength, and mix times.</span></div> : null}</div>
      </Card>
    </div>;
  }

  function harvestTab(): ReactNode {
    return <div className="cultivation-layout">
      <Card title={harvest.id ? 'Edit harvest record' : 'Record harvest and yield'} detail="Track lot identity, weights, drying conditions, cure checkpoints, and final photos.">
        <form className="cultivation-form" onSubmit={submitHarvest}>
          <Field label="Plant"><select required value={harvest.plantId} onChange={(e) => setHarvest({ ...harvest, plantId: e.target.value })}><option value="">Choose plant</option>{state.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</select></Field>
          <Field label="Lot ID"><input value={harvest.lotId} onChange={(e) => setHarvest({ ...harvest, lotId: e.target.value })} /></Field>
          <Field label="Harvest date"><input required type="date" value={harvest.harvestDate} onChange={(e) => setHarvest({ ...harvest, harvestDate: e.target.value })} /></Field>
          <Field label="Wet weight (g)"><input type="number" min="0" step="0.1" value={harvest.wetWeightG} onChange={(e) => setHarvest({ ...harvest, wetWeightG: e.target.value })} /></Field>
          <Field label="Dry weight (g)"><input type="number" min="0" step="0.1" value={harvest.dryWeightG} onChange={(e) => setHarvest({ ...harvest, dryWeightG: e.target.value })} /></Field>
          <Field label="Trimmed weight (g)"><input type="number" min="0" step="0.1" value={harvest.trimmedWeightG} onChange={(e) => setHarvest({ ...harvest, trimmedWeightG: e.target.value })} /></Field>
          <Field label="Waste/loss (g)"><input type="number" min="0" step="0.1" value={harvest.wasteWeightG} onChange={(e) => setHarvest({ ...harvest, wasteWeightG: e.target.value })} /></Field>
          <Field label="Drying temperature (°C)"><input type="number" min="-20" max="80" step="0.1" value={harvest.dryingTemperatureC} onChange={(e) => setHarvest({ ...harvest, dryingTemperatureC: e.target.value })} /></Field>
          <Field label="Drying RH (%)"><input type="number" min="0" max="100" step="0.1" value={harvest.dryingHumidity} onChange={(e) => setHarvest({ ...harvest, dryingHumidity: e.target.value })} /></Field>
          <Field label="Drying duration (days)"><input type="number" min="0" max="365" step="0.1" value={harvest.dryingDays} onChange={(e) => setHarvest({ ...harvest, dryingDays: e.target.value })} /></Field>
          <Field label="Cure started"><input type="date" value={harvest.cureStartedAt} onChange={(e) => setHarvest({ ...harvest, cureStartedAt: e.target.value })} /></Field>
          <Field label="Cure checkpoints"><textarea value={harvest.cureCheckpoints} onChange={(e) => setHarvest({ ...harvest, cureCheckpoints: e.target.value })} /></Field>
          <Field label="Final photo IDs"><input value={harvest.finalPhotoIds} onChange={(e) => setHarvest({ ...harvest, finalPhotoIds: e.target.value })} /></Field>
          <Field label="Notes"><textarea value={harvest.notes} onChange={(e) => setHarvest({ ...harvest, notes: e.target.value })} /></Field>
          <div className="cultivation-form-actions"><button className="primary-button" type="submit">{harvest.id ? 'Update harvest' : 'Save harvest'}</button>{harvest.id ? <button type="button" className="secondary-button" onClick={() => setHarvest(emptyHarvest())}>Cancel edit</button> : null}</div>
        </form>
      </Card>
      <Card title="Harvest history" detail={`${harvestHistory.length} harvest record${harvestHistory.length === 1 ? '' : 's'}.`}>
        <div className="cultivation-list">{harvestHistory.map((record) => {
          const plant = state.plants.find((item) => item.id === record.plantId);
          const loss = harvestDryLossPercent(record);
          return <article className="cultivation-record" key={record.id}><div><strong>{plant?.name ?? 'Unknown plant'} · {record.lotId || record.harvestDate}</strong><span>{record.harvestDate} · Wet {record.wetWeightG ?? '—'} g · Dry {record.dryWeightG ?? '—'} g</span><p>Trimmed {record.trimmedWeightG ?? '—'} g · Waste {record.wasteWeightG ?? '—'} g{loss === null ? '' : ` · ${loss}% wet-to-dry loss`}</p></div><Actions onEdit={() => editHarvest(record)} onDelete={() => deleteRecord('harvest', record.id, 'harvest record')} /></article>;
        })}{harvestHistory.length === 0 ? <div className="empty-state"><strong>No harvest records</strong><span>Track yield, drying, cure, and lot details.</span></div> : null}</div>
      </Card>
    </div>;
  }

  function outcomesTab(): ReactNode {
    return <div className="cultivation-layout">
      <Card title={outcome.id ? 'Edit observation outcome' : 'Record observation outcome'} detail="Record what evidence confirmed, ruled out, monitored, or resolved an earlier possibility.">
        <form className="cultivation-form" onSubmit={submitOutcome}>
          <Field label="Observation"><select required value={outcome.observationId} onChange={(e) => setOutcome({ ...outcome, observationId: e.target.value })}><option value="">Choose observation</option>{state.observations.map((observation) => {
            const plant = state.plants.find((item) => item.id === observation.plantId);
            const observationLabel = observation.possibleCauses[0] ?? (observation.symptoms.join(', ') || 'Observation');
            return <option key={observation.id} value={observation.id}>{plant?.name ?? 'Unassigned'} · {observationLabel}</option>;
          })}</select></Field>
          <Field label="Outcome status"><select value={outcome.status} onChange={(e) => setOutcome({ ...outcome, status: e.target.value as ObservationOutcomeStatus })}><option value="monitoring">Monitoring</option><option value="confirmed">Confirmed</option><option value="ruled-out">Ruled out</option><option value="resolved">Resolved</option></select></Field>
          <Field label="Verified cause or conclusion"><input value={outcome.verifiedCause} onChange={(e) => setOutcome({ ...outcome, verifiedCause: e.target.value })} /></Field>
          <Field label="Action taken"><textarea value={outcome.actionTaken} onChange={(e) => setOutcome({ ...outcome, actionTaken: e.target.value })} /></Field>
          <Field label="Outcome notes"><textarea value={outcome.outcomeNotes} onChange={(e) => setOutcome({ ...outcome, outcomeNotes: e.target.value })} /></Field>
          {outcome.status === 'resolved' ? <Field label="Resolved at"><input type="datetime-local" value={outcome.resolvedAt} onChange={(e) => setOutcome({ ...outcome, resolvedAt: e.target.value })} /></Field> : null}
          <div className="cultivation-form-actions"><button className="primary-button" type="submit">{outcome.id ? 'Update outcome' : 'Save outcome'}</button>{outcome.id ? <button type="button" className="secondary-button" onClick={() => setOutcome(emptyOutcome())}>Cancel edit</button> : null}</div>
        </form>
      </Card>
      <Card title="Outcome history" detail={`${outcomeHistory.length} outcome record${outcomeHistory.length === 1 ? '' : 's'}.`}>
        <div className="cultivation-list">{outcomeHistory.map((record) => {
          const observation = state.observations.find((item) => item.id === record.observationId);
          const plant = state.plants.find((item) => item.id === record.plantId);
          return <article className="cultivation-record" key={record.id}><div><strong>{plant?.name ?? 'Unassigned'} · {record.status}</strong><span>{formatDateTime(record.updatedAt)} · Original: {observation?.possibleCauses[0] ?? 'Observation'}</span><p>{record.verifiedCause || record.actionTaken || record.outcomeNotes || 'No conclusion recorded yet.'}</p></div><Actions onEdit={() => editOutcome(record)} onDelete={() => deleteRecord('outcomes', record.id, 'observation outcome')} /></article>;
        })}{outcomeHistory.length === 0 ? <div className="empty-state"><strong>No outcomes recorded</strong><span>Confirm, rule out, monitor, or resolve observations.</span></div> : null}</div>
      </Card>
    </div>;
  }

  const tabCounts: Record<Tab, number> = {
    irrigation: state.irrigationRecords.length,
    feeding: state.feedingRecords.length,
    reservoirs: state.reservoirRecords.length,
    harvest: state.harvestRecords.length,
    outcomes: state.observationOutcomes.length,
  };

  let content: ReactNode;
  switch (tab) {
    case 'feeding': content = feedingTab(); break;
    case 'reservoirs': content = reservoirsTab(); break;
    case 'harvest': content = harvestTab(); break;
    case 'outcomes': content = outcomesTab(); break;
    default: content = irrigationTab();
  }

  return <>
    <button className="cultivation-launcher" type="button" aria-label="Open structured cultivation records" onClick={() => { setState(loadState()); setMessage(''); setError(''); setOpen(true); }}><span aria-hidden="true">▦</span><strong>Records</strong></button>
    {open ? <div className="cultivation-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section className="cultivation-panel" role="dialog" aria-modal="true" aria-labelledby="cultivation-title">
        <header className="cultivation-header"><div><span className="eyebrow">Measured cultivation history</span><h2 id="cultivation-title">Cultivation records</h2><p>Structured water, feed, reservoir, harvest, yield, and observation-outcome records.</p></div><button type="button" className="account-close" aria-label="Close cultivation records" onClick={() => setOpen(false)}>×</button></header>
        {error ? <div className="account-message error" role="alert">{error}</div> : null}
        {message ? <div className="account-message success" role="status">{message}</div> : null}
        <nav className="cultivation-tabs" aria-label="Cultivation record sections">{tabDefinitions.map((definition) => <button key={definition.id} type="button" className={tab === definition.id ? 'active' : ''} aria-pressed={tab === definition.id} onClick={() => { setTab(definition.id); setError(''); setMessage(''); }}>{definition.label}<span>{tabCounts[definition.id]}</span></button>)}</nav>
        <div className="cultivation-body">{content}</div>
      </section>
    </div> : null}
  </>;
}
