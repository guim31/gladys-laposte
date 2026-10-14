// -----------------------------------------------------------------------------
// The tracker against the simulated API: pace of the readings, automatic
// removals, scene triggers on transitions only, refused key, quota and
// outages, persistence across a restart, device states, and the container's
// own timer (the 5.2.0 core never polls a device created without should_poll).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PARCELS } from '../src/device.js';
import { CONNECTION } from '../src/texts.js';
import { KEY_CHECK_NUMBER, TICK_MS } from '../src/tracker.js';
import {
  addParcel,
  after,
  createApi,
  createClock,
  createDevice,
  createWorld,
  featureId,
  fixture,
  KEY,
  NUMBERS,
} from './helpers/world.js';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

async function world(t, options) {
  const w = await createWorld(options);
  t.after(() => w.app.stop());
  return w;
}

test('a parcel is read when added, then once per interval', async (t) => {
  const w = await world(t);
  await addParcel(w, NUMBERS.inTransit, 'Shoes');
  assert.equal(w.api.readsOf(NUMBERS.inTransit), 1);
  for (let minute = 1; minute < 30; minute += 1) {
    await after(w, MIN);
  }
  assert.equal(w.api.readsOf(NUMBERS.inTransit), 1, 'not before 30 minutes');
  await after(w, MIN);
  assert.equal(w.api.readsOf(NUMBERS.inTransit), 2);
});

test('the interval of the configuration applies (15 minutes)', async (t) => {
  const w = await world(t, { config: { check_interval: '15' } });
  await addParcel(w, NUMBERS.inTransit);
  await after(w, 15 * MIN);
  assert.equal(w.api.readsOf(NUMBERS.inTransit), 2);
});

test('the requests of a cycle are spaced, and use the language of the configuration', async (t) => {
  const w = await world(t, { config: { language: 'es' } });
  await addParcel(w, NUMBERS.inTransit);
  await addParcel(w, NUMBERS.outForDelivery);
  const before = w.clock.now();
  await after(w, 30 * MIN);
  assert.ok(w.clock.now() - before >= 30 * MIN + 1000, 'one second between two requests');
  assert.ok(w.api.requests.every((request) => request.lang === 'es_ES'));
});

test('a delivered parcel is no longer read, and leaves the list after the days kept', async (t) => {
  const w = await world(t, { config: { keep_delivered: '3' } });
  w.api.answers[NUMBERS.inTransit] = 'out-for-delivery';
  await addParcel(w, NUMBERS.inTransit, 'Shoes');
  w.api.answers[NUMBERS.inTransit] = 'delivered';
  await after(w, 30 * MIN);
  assert.equal(w.tracker.parcels.get(NUMBERS.inTransit).status, 'delivered');
  const reads = w.api.readsOf(NUMBERS.inTransit);
  await after(w, 2 * DAY);
  assert.equal(w.api.readsOf(NUMBERS.inTransit), reads, 'never read again');
  assert.ok(w.tracker.parcels.has(NUMBERS.inTransit));
  await after(w, DAY);
  assert.equal(w.tracker.parcels.has(NUMBERS.inTransit), false, 'removed after 3 days');
});

test('a number La Poste does not know is kept, read, then dropped after 30 days', async (t) => {
  const w = await world(t);
  const ack = await addParcel(w, '6A99999999999', 'Gift');
  assert.match(ack.data.message.fr, /Pas encore connu/);
  assert.equal(w.tracker.parcels.get('6A99999999999').status, 'unknown');
  w.api.answers['6A99999999999'] = 'in-transit';
  await after(w, 30 * MIN);
  assert.equal(w.tracker.parcels.get('6A99999999999').status, 'in_transit');
  w.api.answers['6A88888888888'] = undefined;
  await addParcel(w, '6A88888888888');
  await after(w, 30 * DAY);
  assert.equal(w.tracker.parcels.has('6A88888888888'), false);
  assert.equal(w.tracker.parcels.has('6A99999999999'), true);
});

test('the triggers fire on a change of status only', async (t) => {
  const w = await world(t);
  await addParcel(w, NUMBERS.inTransit, 'Shoes');
  assert.deepEqual(w.fake.sceneEvents, []);
  w.api.answers[NUMBERS.inTransit] = 'out-for-delivery';
  await after(w, 30 * MIN);
  await after(w, 30 * MIN);
  w.api.answers[NUMBERS.inTransit] = 'delivered';
  await after(w, 30 * MIN);
  assert.deepEqual(
    w.fake.sceneEvents.map((event) => event.key),
    ['parcel_out_for_delivery', 'parcel_delivered'],
  );
  const [event] = w.fake.sceneEvents;
  assert.deepEqual(event.data, {
    name: 'Shoes',
    number: NUMBERS.inTransit,
    status: 'En livraison',
    event: 'Votre colis est en cours de livraison.',
    carrier: 'Colissimo',
    pickup_point: '',
    url: `https://www.laposte.fr/outils/suivre-vos-envois?code=${NUMBERS.outForDelivery}`,
  });
});

test('a parcel added once delivered fires nothing; a return fires one problem', async (t) => {
  const w = await world(t);
  await addParcel(w, NUMBERS.delivered);
  assert.deepEqual(w.fake.sceneEvents, []);
  const returned = structuredClone(fixture('problem'));
  returned.shipment.event[0].code = 'RE1';
  w.api.answers[NUMBERS.problem] = { status: 200, body: returned };
  await addParcel(w, NUMBERS.problem);
  const back = structuredClone(returned);
  back.shipment.event.unshift({
    code: 'DI2',
    label: 'Retourné',
    date: '2026-10-16T10:00:00+02:00',
  });
  back.shipment.isFinal = true;
  w.api.answers[NUMBERS.problem] = { status: 200, body: back };
  await after(w, 30 * MIN);
  assert.equal(w.tracker.parcels.get(NUMBERS.problem).status, 'returned');
  assert.deepEqual(
    w.fake.sceneEvents.map((event) => event.key),
    ['parcel_problem'],
  );
});

test('without a key: nothing is read, and the configuration says so', async (t) => {
  const w = await world(t, { config: { api_key: '' } });
  assert.deepEqual(w.fake.connectionStatus, { connected: false, message: CONNECTION.noKey });
  const ack = await addParcel(w, NUMBERS.inTransit);
  assert.match(ack.data.message.en, /now tracked \(Not read yet\)\. Enter your La Poste API key/);
  await after(w, DAY);
  assert.equal(w.api.requests.length, 0);
  const refresh = await w.fake.action('refresh');
  assert.match(refresh.data.message.en, /Enter your La Poste API key/);
});

test('the key is checked at start when no parcel is due', async (t) => {
  const w = await world(t);
  assert.deepEqual(
    w.api.requests.map((request) => request.number),
    [KEY_CHECK_NUMBER],
  );
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
});

test('a refused key stops the readings until the key changes', async (t) => {
  const w = await world(t, { config: { api_key: 'wrong' } });
  assert.deepEqual(w.fake.connectionStatus, { connected: false, message: CONNECTION.invalidKey });
  await addParcel(w, NUMBERS.inTransit);
  const requests = w.api.requests.length;
  await after(w, DAY);
  assert.equal(w.api.requests.length, requests, 'no request with a refused key');
  await w.fake.configUpdated({ api_key: KEY });
  assert.deepEqual(w.fake.connectionStatus, { connected: true });
  assert.equal(w.tracker.parcels.get(NUMBERS.inTransit).status, 'in_transit');
});

test('a quota reached pauses the readings for its Retry-After, an outage for 10 minutes', async (t) => {
  const w = await world(t);
  await addParcel(w, NUMBERS.inTransit);
  w.api.failAll = { status: 429, body: fixture('error-429'), headers: { 'Retry-After': '3600' } };
  await after(w, 30 * MIN);
  const requests = w.api.requests.length;
  w.api.failAll = null;
  await after(w, 30 * MIN);
  assert.equal(w.api.requests.length, requests, 'paused');
  await after(w, 30 * MIN);
  assert.equal(w.api.requests.length, requests + 1, 'read again after the pause');

  w.api.failAll = { status: 503, body: fixture('error-503') };
  await after(w, 30 * MIN);
  w.api.failAll = null;
  await after(w, 5 * MIN);
  assert.equal(w.api.requests.length, requests + 2, 'paused');
  await after(w, 5 * MIN);
  assert.equal(w.api.requests.length, requests + 3, 'read again 10 minutes later');
});

test('a restart keeps the parcels, their pace and their triggers', async (t) => {
  const first = await world(t);
  await addParcel(first, NUMBERS.outForDelivery, 'Shoes');
  await first.app.stop();
  const api = createApi();
  const clock = createClock(first.clock.now() + 10 * MIN);
  const second = await world(t, { dataDir: first.dataDir, api, clock });
  const parcel = second.tracker.parcels.get(NUMBERS.outForDelivery);
  assert.equal(parcel.name, 'Shoes');
  assert.equal(parcel.status, 'out_for_delivery');
  assert.equal(api.readsOf(NUMBERS.outForDelivery), 0, 'read 10 minutes ago: not due');
  await after(second, 20 * MIN);
  assert.equal(api.readsOf(NUMBERS.outForDelivery), 1);
  assert.deepEqual(second.fake.sceneEvents, [], 'same status: no trigger again');
});

test('the device states: counts and summary, all again when the device is created', async (t) => {
  const w = await world(t);
  for (const number of Object.values(NUMBERS)) {
    await addParcel(w, number);
  }
  assert.equal(w.fake.states.length, 0, 'nothing before the device exists');
  const device = await createDevice(w);
  const state = (key) => w.fake.lastState(featureId(device, key));
  assert.equal(state('in_progress'), 4);
  assert.equal(state('out_for_delivery'), 1);
  assert.equal(state('awaiting_pickup'), 1);
  assert.equal(state('problems'), 1);
  assert.equal(state('delivered'), 2);
  assert.match(
    state('summary'),
    /^Vous avez 4 colis en cours : 6A12345678902, en cours de livraison ; /,
  );
  assert.ok(w.fake.widgetRefreshes.includes('parcels'));
  const count = w.fake.states.length;
  await after(w, MIN);
  assert.equal(w.fake.states.length, count, 'nothing changed, nothing published');
});

test('the container reads the parcels on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const w = await world(t, { timers: true });
  await addParcel(w, NUMBERS.inTransit);
  const poll = t.mock.method(w.tracker, 'runCycle');
  w.clock.advance(30 * MIN);
  t.mock.timers.tick(TICK_MS);
  await poll.mock.calls[0].result;
  assert.equal(poll.mock.callCount(), 1);
  assert.equal(w.api.readsOf(NUMBERS.inTransit), 2);
});

test('remove by name or number; the actions answer the mistakes', async (t) => {
  const w = await world(t);
  await addParcel(w, NUMBERS.inTransit, 'Running shoes');
  await addParcel(w, NUMBERS.problem, 'Letter');
  const renamed = await addParcel(w, NUMBERS.inTransit, 'Shoes');
  assert.equal(renamed.data.message.en, 'Already tracked: its name is now Shoes.');
  assert.equal(
    (await w.fake.action('remove_parcel', { parcel: 'shoes' })).data.message.fr,
    "Shoes n'est plus suivi.",
  );
  assert.equal(
    (await w.fake.action('remove_parcel', { parcel: 'la 123 456 789 fr' })).data.message.en,
    'Letter is no longer tracked.',
  );
  assert.match(
    (await w.fake.action('remove_parcel', { parcel: 'Shoes' })).data.message.en,
    /No tracked parcel is named "Shoes"/,
  );
  assert.match((await addParcel(w, 'hello')).data.message.de, /„hello“ ist keine Sendungsnummer/);
  assert.equal(w.tracker.parcels.size, 0);
});

test('"Read the parcels now" reads every parcel on the way at once', async (t) => {
  const w = await world(t);
  await addParcel(w, NUMBERS.inTransit);
  await addParcel(w, NUMBERS.delivered);
  const ack = await w.fake.action('refresh');
  assert.equal(ack.data.message.en, '1 parcel read again.');
  assert.equal(w.api.readsOf(NUMBERS.inTransit), 2);
  assert.equal(w.api.readsOf(NUMBERS.delivered), 1, 'a delivered parcel is not read again');
  w.api.failAll = { status: 401, body: fixture('error-401-okapi') };
  assert.match((await w.fake.action('refresh')).data.message.en, /refuses the API key/);
});

test(`${MAX_PARCELS} parcels at most`, async (t) => {
  const w = await world(t);
  for (let i = 0; i < MAX_PARCELS; i += 1) {
    await addParcel(w, `6A${String(i).padStart(11, '0')}`);
  }
  assert.match((await addParcel(w, NUMBERS.inTransit)).data.message.en, /50 parcels are tracked/);
});
