type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Attrs = {}, ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c == null) continue;
    el.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return el;
}

export function clear(el: HTMLElement): HTMLElement {
  el.replaceChildren();
  return el;
}

export function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60e3) return 'teď';
  if (d < 3600e3) return `před ${Math.floor(d / 60e3)} min`;
  if (d < 24 * 3600e3) return `před ${Math.floor(d / 3600e3)} h`;
  const days = Math.floor(d / 86400e3);
  return days === 1 ? 'včera' : `před ${days} dny`;
}
