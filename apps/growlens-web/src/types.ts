export type PlantStage = 'seedling' | 'vegetative' | 'flowering' | 'drying' | 'curing' | 'complete';
export type PlantStatus = 'active' | 'paused' | 'harvested' | 'archived';
export type EntryType = 'note' | 'watering' | 'feeding' | 'training' | 'transplant' | 'pest-check' | 'photo' | 'harvest';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type PpmScale = 500 | 700 | null;
export type ObservationOutcomeStatus = 'monitoring' | 'confirmed' | 'ruled-out' | 'resolved';

export type GrowSpace = {
  id: string;
  name: string;
  environment: 'indoor' | 'greenhouse' | 'outdoor';
  lightHours: number;
  createdAt: string;
};

export type GrowCycle = {
  id: string;
  name: string;
  spaceId: string;
  startDate: string;
  stage: PlantStage;
  status: 'active' | 'complete' | 'archived';
};

export type Plant = {
  id: string;
  name: string;
  strain: string;
  stage: PlantStage;
  status: PlantStatus;
  spaceId: string;
  cycleId: string;
  startDate: string;
  notes: string;
  createdAt: string;
};

export type DiaryEntry = {
  id: string;
  plantId: string | null;
  cycleId: string | null;
  type: EntryType;
  title: string;
  notes: string;
  createdAt: string;
};

export type GrowTask = {
  id: string;
  title: string;
  dueDate: string;
  plantId: string | null;
  completed: boolean;
  recurrence?: TaskRecurrence;
  recurrenceAnchorDay?: number | null;
  lastCompletedAt?: string | null;
  completionCount?: number;
  createdAt: string;
};

export type EnvironmentReading = {
  id: string;
  spaceId: string | null;
  temperatureC: number;
  humidity: number;
  ppfd: number | null;
  createdAt: string;
};

export type CalibrationProfile = {
  id: string;
  name: string;
  luxToPpfdFactor: number;
  fixture: string;
  notes: string;
  createdAt: string;
};

export type Observation = {
  id: string;
  plantId: string | null;
  symptoms: string[];
  notes: string;
  possibleCauses: string[];
  photoIds?: string[];
  createdAt: string;
};

export type NutrientProduct = {
  name: string;
  amount: number | null;
  unit: string;
};

export type IrrigationRecord = {
  id: string;
  plantId: string | null;
  cycleId: string | null;
  spaceId: string | null;
  sourceWater: string;
  volumeAppliedMl: number;
  runoffVolumeMl: number | null;
  inputPh: number | null;
  inputEcMsCm: number | null;
  runoffPh: number | null;
  runoffEcMsCm: number | null;
  substrateMoisturePercent: number | null;
  drybackPercent: number | null;
  irrigationTimeMinutes: number | null;
  reservoirId: string | null;
  recipeNotes: string;
  productsUsed: string[];
  createdAt: string;
  updatedAt: string;
};

export type FeedingRecord = {
  id: string;
  plantId: string | null;
  cycleId: string | null;
  reservoirId: string | null;
  waterVolumeMl: number;
  sourceWater: string;
  startingEcMsCm: number | null;
  finalEcMsCm: number | null;
  finalPh: number | null;
  ppm: number | null;
  ppmScale: PpmScale;
  products: NutrientProduct[];
  additives: string[];
  mixingNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type ReservoirRecord = {
  id: string;
  spaceId: string | null;
  name: string;
  sourceWater: string;
  capacityLiters: number | null;
  currentVolumeLiters: number | null;
  ph: number | null;
  ecMsCm: number | null;
  temperatureC: number | null;
  mixedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type HarvestRecord = {
  id: string;
  plantId: string;
  cycleId: string | null;
  lotId: string;
  harvestDate: string;
  wetWeightG: number | null;
  dryWeightG: number | null;
  trimmedWeightG: number | null;
  wasteWeightG: number | null;
  dryingTemperatureC: number | null;
  dryingHumidity: number | null;
  dryingDays: number | null;
  cureStartedAt: string | null;
  cureCheckpoints: string[];
  finalPhotoIds: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ObservationOutcome = {
  id: string;
  observationId: string;
  plantId: string | null;
  status: ObservationOutcomeStatus;
  verifiedCause: string;
  actionTaken: string;
  outcomeNotes: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GrowLensState = {
  schemaVersion: 2;
  spaces: GrowSpace[];
  cycles: GrowCycle[];
  plants: Plant[];
  diary: DiaryEntry[];
  tasks: GrowTask[];
  readings: EnvironmentReading[];
  calibrationProfiles: CalibrationProfile[];
  observations: Observation[];
  irrigationRecords: IrrigationRecord[];
  feedingRecords: FeedingRecord[];
  reservoirRecords: ReservoirRecord[];
  harvestRecords: HarvestRecord[];
  observationOutcomes: ObservationOutcome[];
};
