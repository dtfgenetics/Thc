import { describe, expect, it, vi } from 'vitest';
import { createScreenWakeLockController, shareOrCopyInvite } from './browserExperience';

describe('High Land browser experience adapter', () => {
  it('uses native sharing when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const navigatorObject = { share } as unknown as Navigator;
    await expect(shareOrCopyInvite('https://example.test/?game=ABC123', { navigatorObject })).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.test/?game=ABC123' }));
  });

  it('falls back to clipboard copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const navigatorObject = { clipboard: { writeText } } as unknown as Navigator;
    await expect(shareOrCopyInvite('https://example.test/?game=ABC123', { navigatorObject })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://example.test/?game=ABC123');
  });

  it('reacquires wake lock when a desired session becomes visible again', async () => {
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const release = vi.fn().mockResolvedValue(undefined);
    const sentinel = { released: false, release, addEventListener: vi.fn() };
    const request = vi.fn().mockResolvedValue(sentinel);
    const documentObject = {
      visibilityState: 'visible',
      addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type) => listeners.delete(type))
    } as unknown as Document;
    const navigatorObject = { wakeLock: { request } } as unknown as Navigator;

    const controller = createScreenWakeLockController({ navigatorObject, documentObject });
    controller.attach();
    await expect(controller.acquire()).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(1);

    sentinel.released = true;
    Object.defineProperty(documentObject, 'visibilityState', { value: 'visible', configurable: true });
    const listener = listeners.get('visibilitychange') as EventListener;
    await listener(new Event('visibilitychange'));
    expect(request).toHaveBeenCalledTimes(2);

    await controller.release();
    controller.detach();
  });
});
