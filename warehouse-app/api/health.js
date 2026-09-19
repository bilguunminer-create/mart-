import { json } from './_warehouse.js';
export default function handler() {
  return json(200, { ok: true, service: 'usk-warehouse-server', time: new Date().toISOString() });
}