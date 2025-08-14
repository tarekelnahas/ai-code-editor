export async function fetchJson(url:string, opts:any={}, retries=2, timeout=120000) {
  const ctrl = new AbortController(); const id = setTimeout(()=>ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (retries) return fetchJson(url, opts, retries-1, timeout);
    throw e;
  } finally { clearTimeout(id); }
}
export const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";