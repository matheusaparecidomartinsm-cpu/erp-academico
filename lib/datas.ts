import { hoje } from './util'
/** Data de hoje + n dias, em ISO (aaaa-mm-dd). */
export function addDiasPublic(n: number) {
  const d = new Date(hoje() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
