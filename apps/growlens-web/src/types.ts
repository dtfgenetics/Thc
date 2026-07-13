export type PlantStage = 'seedling' | 'vegetative' | 'flowering' | 'drying' | 'curing' | 'complete';
export type PlantStatus = 'active' | 'paused' | 'harvested' | 'archived';
export type EntryType = 'note' | 'watering' | 'feeding' | 'training' | 'transplant' | 'pest-check' | 'photo' | 'harvest';
export type TaskRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

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

export type GrowLensState = {
  schemaVersion: 1;
  spaces: GrowSpace[];
  cycles: GrowCycle[];
  plants: Plant[];
  diary: DiaryEntry[];
  tasks: GrowTask[];
  readings: EnvironmentReading[];
  calibrationProfiles: CalibrationProfile[];
  observations: Observation[];
};
