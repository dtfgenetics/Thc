function defaultNavigator() {
  return typeof navigator !== 'undefined' ? navigator : null;
}

function defaultDocument() {
  return typeof document !== 'undefined' ? document : null;
}

export async function copyText(text, {
  navigatorObject = defaultNavigator(),
  documentObject = defaultDocument(),
} = {}) {
  const value = String(text ?? '');
  if (!value) return { ok: false, method: 'none' };

  try {
    if (navigatorObject?.clipboard?.writeText) {
      await navigatorObject.clipboard.writeText(value);
      return { ok: true, method: 'clipboard' };
    }
  } catch {}

  if (!documentObject?.createElement || !documentObject?.body) {
    return { ok: false, method: 'none' };
  }

  const field = documentObject.createElement('textarea');
  field.value = value;
  field.setAttribute?.('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  documentObject.body.appendChild(field);

  try {
    field.focus?.();
    field.select?.();
    const ok = Boolean(documentObject.execCommand?.('copy'));
    return { ok, method: ok ? 'legacy-copy' : 'none' };
  } catch {
    return { ok: false, method: 'none' };
  } finally {
    field.remove?.();
  }
}

export async function shareGameLink({
  title = '',
  text = '',
  url = '',
} = {}, {
  navigatorObject = defaultNavigator(),
  documentObject = defaultDocument(),
} = {}) {
  const shareData = {
    ...(title ? { title: String(title) } : {}),
    ...(text ? { text: String(text) } : {}),
    ...(url ? { url: String(url) } : {}),
  };

  if (navigatorObject?.share) {
    try {
      await navigatorObject.share(shareData);
      return { ok: true, method: 'share' };
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, method: 'cancelled' };
    }
  }

  const fallback = [text, url].filter(Boolean).join('\n');
  const copied = await copyText(fallback, { navigatorObject, documentObject });
  return copied.ok
    ? { ok: true, method: copied.method }
    : { ok: false, method: 'none' };
}

export async function toggleFullscreen({
  documentObject = defaultDocument(),
  element = null,
} = {}) {
  if (!documentObject) return { ok: false, active: false };

  try {
    if (documentObject.fullscreenElement) {
      await documentObject.exitFullscreen?.();
      return { ok: true, active: false };
    }

    const target = element || documentObject.documentElement;
    if (!target?.requestFullscreen) return { ok: false, active: false };
    await target.requestFullscreen();
    return { ok: true, active: true };
  } catch {
    return { ok: false, active: Boolean(documentObject.fullscreenElement) };
  }
}

export function vibrateGame(pattern = 18, {
  navigatorObject = defaultNavigator(),
  enabled = true,
} = {}) {
  if (!enabled || typeof navigatorObject?.vibrate !== 'function') return false;
  try {
    return Boolean(navigatorObject.vibrate(pattern));
  } catch {
    return false;
  }
}

export function createWakeLockController({
  navigatorObject = defaultNavigator(),
  documentObject = defaultDocument(),
} = {}) {
  let sentinel = null;
  let desired = false;
  let attached = false;

  const supported = () => Boolean(navigatorObject?.wakeLock?.request);

  async function acquire() {
    desired = true;
    if (!supported()) return false;
    if (documentObject?.visibilityState === 'hidden') return false;
    if (sentinel && !sentinel.released) return true;

    try {
      sentinel = await navigatorObject.wakeLock.request('screen');
      sentinel?.addEventListener?.('release', () => {
        sentinel = null;
      });
      return true;
    } catch {
      sentinel = null;
      return false;
    }
  }

  async function release() {
    desired = false;
    const current = sentinel;
    sentinel = null;
    if (!current?.release) return true;
    try {
      await current.release();
      return true;
    } catch {
      return false;
    }
  }

  async function onVisibilityChange() {
    if (desired && documentObject?.visibilityState === 'visible') {
      await acquire();
    }
  }

  function attach() {
    if (attached || !documentObject?.addEventListener) return false;
    documentObject.addEventListener('visibilitychange', onVisibilityChange);
    attached = true;
    return true;
  }

  function detach() {
    if (!attached || !documentObject?.removeEventListener) return false;
    documentObject.removeEventListener('visibilitychange', onVisibilityChange);
    attached = false;
    return true;
  }

  return {
    supported,
    acquire,
    release,
    attach,
    detach,
    active: () => Boolean(sentinel && !sentinel.released),
    desired: () => desired,
  };
}
