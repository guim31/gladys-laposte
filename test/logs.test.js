// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// and one line per user action, never one line per reading cycle; a failure
// that repeats is logged once, plus one line when it is over; the API key
// never appears.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addParcel,
  after,
  captureLogs,
  createDevice,
  createWorld,
  fixture,
  KEY,
  NUMBERS,
} from './helpers/world.js';

const MIN = 60_000;
const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function busyWorld(t) {
  const w = await createWorld();
  t.after(() => w.app.stop());
  await addParcel(w, NUMBERS.inTransit, 'Shoes');
  await createDevice(w);
  return w;
}

test('normal reading cycles write nothing at info', async (t) => {
  const w = await busyWorld(t);
  const lines = captureLogs(t, 'info');
  w.api.answers[NUMBERS.inTransit] = 'out-for-delivery';
  for (let i = 0; i < 5; i += 1) {
    await after(w, 30 * MIN);
  }
  assert.deepEqual(lines, []);
});

test('LOG_LEVEL=debug shows the cycles', async (t) => {
  const w = await busyWorld(t);
  const lines = captureLogs(t, 'debug');
  await after(w, 30 * MIN);
  assert.ok(lines.some((line) => /Reading cycle: 1 parcel\(s\) read, 1 tracked/.test(line.text)));
});

test('an outage is one warning, then one line when La Poste answers again', async (t) => {
  const w = await busyWorld(t);
  const lines = captureLogs(t, 'info');
  w.api.failAll = { status: 504, body: fixture('error-504') };
  for (let i = 0; i < 4; i += 1) {
    await after(w, 30 * MIN);
  }
  w.api.failAll = null;
  await after(w, 30 * MIN);
  assert.deepEqual(lines.map(strip), [
    '[WARN] [laposte] La Poste API: unavailable (HTTP 504): Gateway Timeout: readings paused for 10 min',
    '[INFO] [laposte] The La Poste API answers again',
  ]);
});

test('states refused at every cycle: one warning, then one line at recovery', async (t) => {
  const w = await busyWorld(t);
  const lines = captureLogs(t, 'info');
  const publish = t.mock.method(w.gladys, 'publishChangedStates', async () => {
    throw new Error('Gladys unreachable');
  });
  for (let i = 0; i < 3; i += 1) {
    await after(w, MIN);
  }
  publish.mock.restore();
  await after(w, MIN);
  assert.deepEqual(lines.map(strip), [
    '[WARN] [laposte] Publishing the states failed: Gladys unreachable',
    '[INFO] [laposte] Publishing the states works again',
  ]);
});

test('a refused key is one warning, and the key is never written', async (t) => {
  const lines = captureLogs(t, 'debug');
  const w = await createWorld({ config: { api_key: 'secret-key-0123456789' } });
  t.after(() => w.app.stop());
  await addParcel(w, NUMBERS.inTransit);
  await after(w, 30 * MIN);
  await w.fake.configUpdated({ api_key: KEY });
  assert.equal(lines.filter((line) => /refuses the API key/.test(line.text)).length, 1);
  assert.ok(lines.every((line) => !line.text.includes('secret-key') && !line.text.includes(KEY)));
});

test('a user action is one info line', async (t) => {
  const w = await busyWorld(t);
  const lines = captureLogs(t, 'info');
  await addParcel(w, NUMBERS.problem, 'Letter');
  await w.fake.action('remove_parcel', { parcel: 'Letter' });
  assert.deepEqual(lines.map(strip), [
    '[INFO] [laposte] Parcel Letter added',
    '[INFO] [laposte] Parcel Letter removed',
  ]);
});
