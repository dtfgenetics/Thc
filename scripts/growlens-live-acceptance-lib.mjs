import { createHmac, randomBytes } from 'node:crypto';

export const ACCEPTANCE_CONFIRMATION = 'RUN-DESTRUCTIVE-ACCEPTANCE';
export const SESSION_COOKIE_NAME = 'growlens_session';

export function normalizeBaseUrl(value, allowHttpLocal = false) {
  const raw = String(value ?? '').trim();
  if (!raw) throw new Error('GROWLENS_BASE_URL is required.');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('GROWLENS_BASE_URL must be a valid absolute URL.');
  }
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowHttpLocal && localHost && url.protocol === 'http:')) {
    throw new Error('GrowLens live acceptance requires HTTPS. HTTP is allowed only for an explicitly enabled localhost run.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('GROWLENS_BASE_URL must not contain credentials, a query string, or a fragment.');
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  if (!url.pathname.endsWith('/growlens')) throw new Error('GROWLENS_BASE_URL must end in /growlens.');
  return url;
}

export function createRunId(now = new Date(), random = randomBytes(6).toString('hex')) {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const safeRandom = String(random).replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  if (!safeRandom) throw new Error('Acceptance run identifier needs a random suffix.');
  return `${stamp}-${safeRandom}`.toLowerCase();
}

export function validatePasswordSeed(value) {
  const seed = String(value ?? '');
  if (seed.length < 32 || seed.length > 1000) {
    throw new Error('GROWLENS_ACCEPTANCE_PASSWORD_SEED must contain 32 to 1000 characters.');
  }
  return seed;
}

export function createDisposableCredentials(runId, label, domain = 'example.com', passwordSeed) {
  const safeRunId = String(runId).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48);
  const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12);
  const safeDomain = String(domain).toLowerCase().trim();
  if (!safeRunId || !safeLabel || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(safeDomain)) {
    throw new Error('Disposable credential inputs are invalid.');
  }
  const seed = validatePasswordSeed(passwordSeed);
  const digest = createHmac('sha256', seed)
    .update(`growlens-live-acceptance:${safeRunId}:${safeLabel}`)
    .digest('base64url');
  return {
    email: `growlens-accept-${safeLabel}-${safeRunId}@${safeDomain}`,
    password: `Acceptance-${digest}!9`,
  };
}

export function extractSessionCookie(setCookieHeaders) {
  const values = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const match = value.match(new RegExp(`(?:^|,\\s*)${SESSION_COOKIE_NAME}=([^;,\\s]*)`));
    if (match) return match[1] || null;
  }
  return undefined;
}

export function emptyGrowLensState() {
  return {
    schemaVersion: 2,
    spaces: [],
    cycles: [],
    plants: [],
    diary: [],
    tasks: [],
    readings: [],
    calibrationProfiles: [],
    observations: [],
    irrigationRecords: [],
    feedingRecords: [],
    reservoirRecords: [],
    harvestRecords: [],
    observationOutcomes: [],
  };
}

export function buildDeviceOneState(runId, photoId) {
  const createdAt = new Date().toISOString();
  const date = createdAt.slice(0, 10);
  const spaceId = `space-accept-${runId}`;
  const cycleId = `cycle-accept-${runId}`;
  const plantId = `plant-accept-${runId}`;
  const observationId = `observation-accept-${runId}`;
  const reservoirId = `reservoir-accept-${runId}`;
  return {
    ...emptyGrowLensState(),
    spaces: [{ id: spaceId, name: `Acceptance space ${runId}`, environment: 'indoor', lightHours: 18, createdAt }],
    cycles: [{ id: cycleId, name: `Acceptance cycle ${runId}`, spaceId, startDate: date, stage: 'vegetative', status: 'active' }],
    plants: [{
      id: plantId,
      name: `Acceptance plant ${runId}`,
      strain: 'Acceptance cultivar',
      stage: 'vegetative',
      status: 'active',
      spaceId,
      cycleId,
      startDate: date,
      notes: 'Disposable live acceptance record.',
      createdAt,
    }],
    diary: [{ id: `entry-device-one-${runId}`, plantId, cycleId, type: 'note', title: 'Device one marker', notes: `Acceptance run ${runId}`, createdAt }],
    tasks: [{
      id: `task-accept-${runId}`,
      title: 'Acceptance recurring task',
      dueDate: date,
      plantId,
      completed: false,
      recurrence: 'weekly',
      recurrenceAnchorDay: null,
      lastCompletedAt: null,
      completionCount: 0,
      createdAt,
    }],
    readings: [{ id: `reading-accept-${runId}`, spaceId, temperatureC: 24, humidity: 58, ppfd: 450, createdAt }],
    calibrationProfiles: [{
      id: `calibration-accept-${runId}`,
      name: 'Acceptance calibration',
      luxToPpfdFactor: 0.015,
      fixture: 'Acceptance fixture',
      notes: 'Disposable acceptance profile.',
      createdAt,
    }],
    observations: [{
      id: observationId,
      plantId,
      symptoms: ['acceptance-marker'],
      notes: 'Disposable private-image acceptance observation.',
      possibleCauses: ['Acceptance test only'],
      photoIds: [photoId],
      createdAt,
    }],
    reservoirRecords: [{
      id: reservoirId,
      spaceId,
      name: 'Acceptance reservoir',
      sourceWater: 'Acceptance source',
      capacityLiters: 20,
      currentVolumeLiters: 15,
      ph: 6.1,
      ecMsCm: 1.7,
      temperatureC: 20,
      mixedAt: createdAt,
      notes: 'Disposable reservoir record.',
      createdAt,
      updatedAt: createdAt,
    }],
    feedingRecords: [{
      id: `feeding-accept-${runId}`,
      plantId,
      cycleId,
      reservoirId,
      waterVolumeMl: 4000,
      sourceWater: 'Acceptance source',
      startingEcMsCm: 0.4,
      finalEcMsCm: 1.7,
      finalPh: 6.1,
      ppm: 850,
      ppmScale: 500,
      products: [{ name: 'Acceptance nutrient', amount: 8, unit: 'mL' }],
      additives: [],
      mixingNotes: 'Disposable feed record.',
      createdAt,
      updatedAt: createdAt,
    }],
    irrigationRecords: [{
      id: `irrigation-accept-${runId}`,
      plantId,
      cycleId,
      spaceId,
      sourceWater: 'Acceptance source',
      volumeAppliedMl: 1500,
      runoffVolumeMl: 225,
      inputPh: 6.1,
      inputEcMsCm: 1.7,
      runoffPh: 6.3,
      runoffEcMsCm: 1.9,
      substrateMoisturePercent: 55,
      drybackPercent: 18,
      irrigationTimeMinutes: 3,
      reservoirId,
      recipeNotes: 'Disposable irrigation record.',
      productsUsed: ['Acceptance nutrient'],
      createdAt,
      updatedAt: createdAt,
    }],
    harvestRecords: [{
      id: `harvest-accept-${runId}`,
      plantId,
      cycleId,
      lotId: `acceptance-lot-${runId}`,
      harvestDate: date,
      wetWeightG: 1000,
      dryWeightG: 240,
      trimmedWeightG: 210,
      wasteWeightG: 30,
      dryingTemperatureC: 18,
      dryingHumidity: 60,
      dryingDays: 10,
      cureStartedAt: createdAt,
      cureCheckpoints: ['Acceptance checkpoint'],
      finalPhotoIds: [photoId],
      notes: 'Disposable harvest record.',
      createdAt,
      updatedAt: createdAt,
    }],
    observationOutcomes: [{
      id: `outcome-accept-${runId}`,
      observationId,
      plantId,
      status: 'monitoring',
      verifiedCause: 'Acceptance verification only',
      actionTaken: 'No production action.',
      outcomeNotes: 'Disposable outcome record.',
      resolvedAt: null,
      createdAt,
      updatedAt: createdAt,
    }],
  };
}

export function buildDeviceTwoState(deviceOneState, runId) {
  const createdAt = new Date().toISOString();
  return {
    ...structuredClone(deviceOneState),
    diary: [
      ...deviceOneState.diary,
      {
        id: `entry-device-two-${runId}`,
        plantId: deviceOneState.plants[0]?.id ?? null,
        cycleId: deviceOneState.cycles[0]?.id ?? null,
        type: 'pest-check',
        title: 'Device two marker',
        notes: `Second-device acceptance update ${runId}`,
        createdAt,
      },
    ],
  };
}

export function hasRecord(state, collection, id) {
  return Array.isArray(state?.[collection]) && state[collection].some((record) => record?.id === id);
}

export function redactPayload(value) {
  if (Array.isArray(value)) return value.map(redactPayload);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/password|csrf|token|cookie/i.test(key)) return [key, '[REDACTED]'];
    return [key, redactPayload(entry)];
  }));
}

export class GrowLensApiClient {
  constructor(baseUrl, label = 'client') {
    this.baseUrl = baseUrl instanceof URL ? baseUrl : normalizeBaseUrl(baseUrl);
    this.label = label;
    this.sessionCookie = null;
    this.csrfToken = null;
  }

  endpoint(path) {
    return new URL(`api/${String(path).replace(/^\/+/, '')}`, `${this.baseUrl.href}/`);
  }

  captureCookie(headers) {
    const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie')];
    const cookie = extractSessionCookie(values);
    if (cookie !== undefined) this.sessionCookie = cookie;
  }

  async request(path, options = {}) {
    const {
      method = 'GET', json, body, csrf = false, origin = this.baseUrl.origin,
      expectedStatuses = [200], parse = 'auto', timeoutMs = 30_000,
    } = options;
    const headers = new Headers({
      Accept: parse === 'bytes' ? '*/*' : 'application/json',
      'X-GrowLens-Acceptance': this.label,
    });
    if (this.sessionCookie) headers.set('Cookie', `${SESSION_COOKIE_NAME}=${this.sessionCookie}`);
    if (method !== 'GET' && method !== 'HEAD' && origin) headers.set('Origin', origin);
    if (csrf) {
      if (!this.csrfToken) throw new Error(`${this.label} has no CSRF token.`);
      headers.set('X-CSRF-Token', this.csrfToken);
    }
    let requestBody = body;
    if (json !== undefined) {
      headers.set('Content-Type', 'application/json');
      requestBody = JSON.stringify(json);
    }
    const response = await fetch(this.endpoint(path), {
      method, headers, body: requestBody, redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs),
    });
    this.captureCookie(response.headers);
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`${this.label} ${method} ${path} unexpectedly redirected with HTTP ${response.status}.`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    let payload;
    if (parse === 'bytes') payload = new Uint8Array(await response.arrayBuffer());
    else if (parse === 'text') payload = await response.text();
    else if (contentType.includes('application/json')) {
      const text = await response.text();
      try { payload = text ? JSON.parse(text) : null; }
      catch { throw new Error(`${this.label} ${method} ${path} returned malformed JSON.`); }
    } else payload = await response.text();
    if (!expectedStatuses.includes(response.status)) {
      const safePayload = JSON.stringify(redactPayload(payload));
      throw new Error(`${this.label} ${method} ${path} returned HTTP ${response.status}; expected ${expectedStatuses.join(', ')}. Payload: ${safePayload.slice(0, 1000)}`);
    }
    return { response, payload };
  }

  async register(credentials) {
    const result = await this.request('register.php', { method: 'POST', json: credentials, expectedStatuses: [201] });
    this.csrfToken = result.payload?.csrfToken ?? null;
    return result;
  }

  async login(credentials, expectedStatuses = [200]) {
    const result = await this.request('login.php', { method: 'POST', json: credentials, expectedStatuses });
    if (result.response.status === 200) this.csrfToken = result.payload?.csrfToken ?? null;
    return result;
  }

  async deleteAccount(password, expectedStatuses = [200]) {
    const result = await this.request('delete-account.php', {
      method: 'POST', json: { password }, csrf: true, expectedStatuses,
    });
    if (result.response.status === 200) {
      this.sessionCookie = null;
      this.csrfToken = null;
    }
    return result;
  }
}

export function assertApiSecurityHeaders(response, context, { privateCache = false } = {}) {
  const cacheControl = response.headers.get('cache-control') ?? '';
  if (!/no-store/i.test(cacheControl)) throw new Error(`${context} did not return Cache-Control: no-store.`);
  if (privateCache && !/private/i.test(cacheControl)) throw new Error(`${context} did not mark the response private.`);
  if ((response.headers.get('x-content-type-options') ?? '').toLowerCase() !== 'nosniff') {
    throw new Error(`${context} did not return X-Content-Type-Options: nosniff.`);
  }
}

export function assertJsonSuccess(payload, context) {
  if (!payload || payload.ok !== true) throw new Error(`${context} did not return ok: true.`);
}

export function tinyPngBytes() {
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
}
