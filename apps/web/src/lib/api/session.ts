/**
 * The management capability itself is an HttpOnly cookie the page cannot read. The create
 * response only says whether this browser received one, so we remember that per analysis for
 * the tab's lifetime to decide whether to show Cancel and Delete. The server enforces it.
 */
const key = (id: string) => `archmap.manage.${id}`;

export function rememberManage(id: string, canManage: boolean, store?: Storage): void {
  try {
    const s = store ?? sessionStorage;
    if (canManage) s.setItem(key(id), "1");
    else s.removeItem(key(id));
  } catch {
    /* storage unavailable: management buttons simply stay hidden */
  }
}

export function canManage(id: string, store?: Storage): boolean {
  try {
    return (store ?? sessionStorage).getItem(key(id)) === "1";
  } catch {
    return false;
  }
}

export const forgetManage = (id: string, store?: Storage) => rememberManage(id, false, store);
