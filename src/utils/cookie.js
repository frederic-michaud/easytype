const COOKIE = 'space_typing_v3';

export function saveCookie(d) {
  const e = new Date();
  e.setDate(e.getDate() + 90);
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(d))};expires=${e.toUTCString()};path=/`;
}

export function loadCookie() {
  for (const c of document.cookie.split(';')) {
    const [k, ...vs] = c.trim().split('=');
    if (k === COOKIE) {
      try { return JSON.parse(decodeURIComponent(vs.join('='))); } catch { return null; }
    }
  }
  return null;
}

export function clearCookie() {
  document.cookie = `${COOKIE}=;expires=Thu,01 Jan 1970 00:00:00 UTC;path=/`;
}
