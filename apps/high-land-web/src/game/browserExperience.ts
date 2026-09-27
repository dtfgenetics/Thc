export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'manual';

type NavigatorLike = Navigator & {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

type WakeLockSentinelLike = {
  released?: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
};

export async function shareOrCopyInvite(
  inviteUrl: string,
  {
    title = 'High Land: The Sweet Escape',
    text = 'Join my High Land room.',
    navigatorObject = navigator as NavigatorLike
  }: {
    title?: string;
    text?: string;
    navigatorObject?: NavigatorLike;
  } = {}
): Promise<ShareResult> {
  if (navigatorObject.share) {
    try {
      await navigatorObject.share({ title, text, url: inviteUrl });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      if ((error as { name?: string })?.name === 'AbortError') return 'cancelled';
    }
  }

  try {
    if (!navigatorObject.clipboard?.writeText) return 'manual';
    await navigatorObject.clipboard.writeText(inviteUrl);
    return 'copied';
  } catch {
    return 'manual';
  }
}

export function createScreenWakeLockController({
  navigatorObject = navigator as NavigatorLike,
  documentObject = document
}: {
  navigatorObject?: NavigatorLike;
  documentObject?: Document;
} = {}) {
  let sentinel: WakeLockSentinelLike | null = null;
  let desired = false;
  let attached = false;

  async function acquire(): Promise<boolean> {
    desired = true;
    if (!navigatorObject.wakeLock?.request || documentObject.visibilityState === 'hidden') return false;
    if (sentinel && !sentinel.released) return true;

    try {
      sentinel = await navigatorObject.wakeLock.request('screen');
      sentinel.addEventListener?.('release', () => {
        sentinel = null;
      });
      return true;
    } catch {
      sentinel = null;
      return false;
    }
  }

  async function release(): Promise<boolean> {
    desired = false;
    const current = sentinel;
    sentinel = null;
    if (!current) return true;
    try {
      await current.release();
      return true;
    } catch {
      return false;
    }
  }

  async function onVisibilityChange(): Promise<void> {
    if (desired && documentObject.visibilityState === 'visible') await acquire();
  }

  function attach(): void {
    if (attached) return;
    documentObject.addEventListener('visibilitychange', onVisibilityChange);
    attached = true;
  }

  function detach(): void {
    if (!attached) return;
    documentObject.removeEventListener('visibilitychange', onVisibilityChange);
    attached = false;
  }

  return {
    acquire,
    release,
    attach,
    detach,
    supported: () => Boolean(navigatorObject.wakeLock?.request)
  };
}
