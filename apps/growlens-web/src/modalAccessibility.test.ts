import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const hook = readFileSync(new URL('./useModalFocusTrap.ts', import.meta.url), 'utf8');
const backup = readFileSync(new URL('./CompleteBackupWidget.tsx', import.meta.url), 'utf8');
const account = readFileSync(new URL('./AccountSyncWidget.tsx', import.meta.url), 'utf8');
const sync = readFileSync(new URL('./SafeAutoSyncWidget.tsx', import.meta.url), 'utf8');
const routines = readFileSync(new URL('./TaskRoutineWidget.tsx', import.meta.url), 'utf8');
const analytics = readFileSync(new URL('./CultivationAnalyticsWidget.tsx', import.meta.url), 'utf8');
const photos = readFileSync(new URL('./PhotoComparisonWidget.tsx', import.meta.url), 'utf8');
const reports = readFileSync(new URL('./ReportsHistoryWidget.tsx', import.meta.url), 'utf8');
const camera = readFileSync(new URL('./CameraObservationWidget.tsx', import.meta.url), 'utf8');
const records = readFileSync(new URL('./CultivationRecordsWidget.tsx', import.meta.url), 'utf8');

describe('GrowLens modal keyboard accessibility', () => {
  it('traps focus, closes on Escape, and restores launcher focus', () => {
    expect(hook).toContain("event.key === 'Escape'");
    expect(hook).toContain("event.key !== 'Tab'");
    expect(hook).toContain('last.focus()');
    expect(hook).toContain('first.focus()');
    expect(hook).toContain('previous?.focus');
  });

  it('uses the shared trap on every GrowLens modal widget', () => {
    for (const source of [backup, account, sync, routines, analytics, photos, reports, camera, records]) {
      expect(source).toContain("useModalFocusTrap");
      expect(source).toContain('ref={modalRef}');
      expect(source).toContain('aria-modal="true"');
    }
  });
});
