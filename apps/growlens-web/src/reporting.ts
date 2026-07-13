import { calculateVpdKpa, round } from './calculations';
import { normalizeState } from './storage';
import { normalizeTaskRecurrence, taskRecurrenceLabels } from './taskRecurrence';
import type { EnvironmentReading, GrowLensState } from './types';

export type ReportSummary = {
  spaces: number;
  activeCycles: number;
  activePlants: number;
  diaryEntries: number;
  openTasks: number;
  observations: number;
  readings: number;
};

export type NumericStats = {
  count: number;
  minimum: number;
  maximum: number;
  average: number;
};

export type EnvironmentStats = {
  temperatureC: NumericStats | null;
  humidity: NumericStats | null;
  ppfd: NumericStats | null;
  vpdKpa: NumericStats | null;
};

export type CalibrationSample = {
  lux: number;
  ppfd: number;
};

export type CalibrationResult = {
  count: number;
  factor: number;
  meanFactor: number;
  variabilityPercent: number;
  factors: number[];
};

export type PlantTimelineEvent = {
  id: string;
  kind: 'diary' | 'observation' | 'task';
  title: string;
  detail: string;
  timestamp: string;
};

export function summarizeReport(value: unknown): ReportSummary {
  const state = normalizeState(value);
  return {
    spaces: state.spaces.length,
    activeCycles: state.cycles.filter((cycle) => cycle.status === 'active').length,
    activePlants: state.plants.filter((plant) => plant.status === 'active').length,
    diaryEntries: state.diary.length,
    openTasks: state.tasks.filter((task) => !task.completed).length,
    observations: state.observations.length,
    readings: state.readings.length,
  };
}

export function numericStats(values: number[]): NumericStats | null {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  const sum = valid.reduce((total, value) => total + value, 0);
  return {
    count: valid.length,
    minimum: Math.min(...valid),
    maximum: Math.max(...valid),
    average: sum / valid.length,
  };
}

export function environmentStats(readings: EnvironmentReading[]): EnvironmentStats {
  return {
    temperatureC: numericStats(readings.map((reading) => reading.temperatureC)),
    humidity: numericStats(readings.map((reading) => reading.humidity)),
    ppfd: numericStats(readings.flatMap((reading) => reading.ppfd === null ? [] : [reading.ppfd])),
    vpdKpa: numericStats(readings.map((reading) => calculateVpdKpa(reading.temperatureC, reading.humidity))),
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function calculateCalibration(samples: CalibrationSample[]): CalibrationResult | null {
  const factors = samples
    .filter((sample) => Number.isFinite(sample.lux) && Number.isFinite(sample.ppfd) && sample.lux > 0 && sample.ppfd > 0)
    .map((sample) => sample.ppfd / sample.lux);
  if (factors.length === 0) return null;

  const meanFactor = factors.reduce((sum, factor) => sum + factor, 0) / factors.length;
  const variance = factors.reduce((sum, factor) => sum + ((factor - meanFactor) ** 2), 0) / factors.length;
  const standardDeviation = Math.sqrt(variance);
  return {
    count: factors.length,
    factor: round(median(factors), 6),
    meanFactor: round(meanFactor, 6),
    variabilityPercent: meanFactor > 0 ? round((standardDeviation / meanFactor) * 100, 1) : 0,
    factors: factors.map((factor) => round(factor, 6)),
  };
}

export function buildPlantTimeline(stateValue: unknown, plantId: string): PlantTimelineEvent[] {
  const state = normalizeState(stateValue);
  const events: PlantTimelineEvent[] = [];

  for (const entry of state.diary) {
    if (entry.plantId !== plantId) continue;
    events.push({
      id: entry.id,
      kind: 'diary',
      title: entry.title,
      detail: entry.notes || entry.type,
      timestamp: entry.createdAt,
    });
  }

  for (const observation of state.observations) {
    if (observation.plantId !== plantId) continue;
    events.push({
      id: observation.id,
      kind: 'observation',
      title: observation.possibleCauses[0] ?? 'Plant observation',
      detail: observation.notes || observation.symptoms.join(', '),
      timestamp: observation.createdAt,
    });
  }

  for (const task of state.tasks) {
    if (task.plantId !== plantId) continue;
    const recurrence = normalizeTaskRecurrence(task.recurrence);
    const schedule = recurrence === 'none' ? 'task' : `${taskRecurrenceLabels[recurrence].toLowerCase()} routine`;
    const completionDetail = (task.completionCount ?? 0) > 0
      ? ` · ${task.completionCount} completion${task.completionCount === 1 ? '' : 's'}`
      : '';
    events.push({
      id: task.id,
      kind: 'task',
      title: task.title,
      detail: `${task.completed ? 'Completed' : 'Open'} ${schedule}${completionDetail}`,
      timestamp: task.dueDate || task.createdAt,
    });
  }

  return events.sort((first, second) => second.timestamp.localeCompare(first.timestamp));
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
}

export function createGrowLensCsvExports(stateValue: unknown): Record<string, string> {
  const state = normalizeState(stateValue);
  return {
    plants: createCsv(
      ['id', 'name', 'strain', 'stage', 'status', 'spaceId', 'cycleId', 'startDate', 'notes', 'createdAt'],
      state.plants.map((plant) => [plant.id, plant.name, plant.strain, plant.stage, plant.status, plant.spaceId, plant.cycleId, plant.startDate, plant.notes, plant.createdAt]),
    ),
    diary: createCsv(
      ['id', 'plantId', 'cycleId', 'type', 'title', 'notes', 'createdAt'],
      state.diary.map((entry) => [entry.id, entry.plantId, entry.cycleId, entry.type, entry.title, entry.notes, entry.createdAt]),
    ),
    tasks: createCsv(
      ['id', 'title', 'dueDate', 'plantId', 'completed', 'recurrence', 'completionCount', 'lastCompletedAt', 'createdAt'],
      state.tasks.map((task) => [
        task.id,
        task.title,
        task.dueDate,
        task.plantId,
        task.completed,
        normalizeTaskRecurrence(task.recurrence),
        task.completionCount ?? 0,
        task.lastCompletedAt ?? '',
        task.createdAt,
      ]),
    ),
    readings: createCsv(
      ['id', 'spaceId', 'temperatureC', 'humidity', 'ppfd', 'vpdKpa', 'createdAt'],
      state.readings.map((reading) => [reading.id, reading.spaceId, reading.temperatureC, reading.humidity, reading.ppfd, round(calculateVpdKpa(reading.temperatureC, reading.humidity), 3), reading.createdAt]),
    ),
    observations: createCsv(
      ['id', 'plantId', 'symptoms', 'notes', 'possibleCauses', 'photoIds', 'createdAt'],
      state.observations.map((observation) => [observation.id, observation.plantId, observation.symptoms.join('|'), observation.notes, observation.possibleCauses.join('|'), (observation.photoIds ?? []).join('|'), observation.createdAt]),
    ),
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statText(stats: NumericStats | null, suffix: string): string {
  if (!stats) return 'No readings';
  return `${round(stats.average, 1)}${suffix} average · ${round(stats.minimum, 1)}–${round(stats.maximum, 1)}${suffix}`;
}

function reportDateTime(value: string | null | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function createPrintableReport(stateValue: unknown): string {
  const state: GrowLensState = normalizeState(stateValue);
  const summary = summarizeReport(state);
  const environment = environmentStats(state.readings);
  const generatedAt = new Date().toLocaleString();
  const plants = state.plants.map((plant) => `
    <tr>
      <td>${escapeHtml(plant.name)}</td>
      <td>${escapeHtml(plant.strain)}</td>
      <td>${escapeHtml(plant.stage)}</td>
      <td>${escapeHtml(plant.status)}</td>
      <td>${escapeHtml(plant.startDate)}</td>
    </tr>`).join('');
  const tasks = [...state.tasks]
    .sort((first, second) => Number(first.completed) - Number(second.completed) || first.dueDate.localeCompare(second.dueDate))
    .map((task) => {
      const plant = state.plants.find((candidate) => candidate.id === task.plantId);
      const recurrence = normalizeTaskRecurrence(task.recurrence);
      return `
    <tr>
      <td>${escapeHtml(task.title)}</td>
      <td>${escapeHtml(task.dueDate || 'No date')}</td>
      <td>${escapeHtml(plant?.name ?? 'Whole grow')}</td>
      <td>${escapeHtml(taskRecurrenceLabels[recurrence])}</td>
      <td>${escapeHtml(task.completed ? 'Completed' : 'Open')}</td>
      <td>${escapeHtml(task.completionCount ?? 0)}</td>
      <td>${escapeHtml(reportDateTime(task.lastCompletedAt))}</td>
    </tr>`;
    }).join('');
  const diary = [...state.diary]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 25)
    .map((entry) => `<li><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.type)} · ${escapeHtml(new Date(entry.createdAt).toLocaleString())}</span><p>${escapeHtml(entry.notes)}</p></li>`)
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GrowLens report</title>
<style>
body{font-family:Arial,sans-serif;color:#18352a;margin:36px;line-height:1.45}h1,h2{margin-bottom:6px}.muted{color:#66776e}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:24px 0}.metric{border:1px solid #dbe4dd;border-radius:10px;padding:12px}.metric strong{display:block;font-size:24px}table{width:100%;border-collapse:collapse;margin:12px 0 26px}th,td{text-align:left;border-bottom:1px solid #dbe4dd;padding:8px;font-size:12px}ul{list-style:none;padding:0}li{border-bottom:1px solid #dbe4dd;padding:10px 0}li span{display:block;color:#66776e;font-size:12px}li p{margin:4px 0}@media print{body{margin:18px}.no-print{display:none}}
</style>
</head>
<body>
<button class="no-print" onclick="window.print()">Print report</button>
<h1>THC GrowLens report</h1>
<p class="muted">Generated ${escapeHtml(generatedAt)}</p>
<div class="metrics">
<div class="metric"><span>Active plants</span><strong>${summary.activePlants}</strong></div>
<div class="metric"><span>Open tasks</span><strong>${summary.openTasks}</strong></div>
<div class="metric"><span>Diary entries</span><strong>${summary.diaryEntries}</strong></div>
<div class="metric"><span>Observations</span><strong>${summary.observations}</strong></div>
</div>
<h2>Environment</h2>
<p>${escapeHtml(statText(environment.temperatureC, '°C'))}</p>
<p>${escapeHtml(statText(environment.humidity, '% RH'))}</p>
<p>${escapeHtml(statText(environment.ppfd, ' PPFD'))}</p>
<p>${escapeHtml(statText(environment.vpdKpa, ' kPa VPD'))}</p>
<h2>Plants</h2>
<table><thead><tr><th>Name</th><th>Cultivar</th><th>Stage</th><th>Status</th><th>Start date</th></tr></thead><tbody>${plants}</tbody></table>
<h2>Tasks and routines</h2>
<table><thead><tr><th>Task</th><th>Due</th><th>Plant</th><th>Schedule</th><th>Status</th><th>Completions</th><th>Last completed</th></tr></thead><tbody>${tasks || '<tr><td colspan="7">No tasks recorded.</td></tr>'}</tbody></table>
<h2>Recent diary</h2>
<ul>${diary || '<li>No diary entries recorded.</li>'}</ul>
</body>
</html>`;
}
