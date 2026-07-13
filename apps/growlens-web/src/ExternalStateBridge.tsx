import { useEffect } from 'react';
import {
  STATE_SAVED_EVENT,
  STORAGE_KEY,
  type StateSavedDetail,
} from './storage';

const REFRESH_DELAY_MS = 2500;

export default function ExternalStateBridge() {
  useEffect(() => {
    let timer: number | null = null;

    const scheduleRefresh = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => window.location.reload(), REFRESH_DELAY_MS);
    };

    const handleSaved = (event: Event) => {
      const detail = (event as CustomEvent<StateSavedDetail>).detail;
      if (detail?.source === 'external') scheduleRefresh();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue !== event.oldValue) {
        scheduleRefresh();
      }
    };

    window.addEventListener(STATE_SAVED_EVENT, handleSaved);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(STATE_SAVED_EVENT, handleSaved);
      window.removeEventListener('storage', handleStorage);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
