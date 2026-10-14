// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a simulated La Poste API
// (fixtures by tracking number), a manual clock, a temporary /data, and the
// integration wired on top through registerHandlers. Nothing touches the
// network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
// Dates of the widget and of the messages are formatted in the time zone of Gladys.
process.env.TZ = 'Europe/Paris';

export const KEY = 'k'.repeat(64);

/** A fixture of test/fixtures/laposte, parsed. */
export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/laposte/${name}.json`, import.meta.url), 'utf8'));

/** Tracking numbers of the shipment fixtures. */
export const NUMBERS = {
  inTransit: '6A12345678901',
  outForDelivery: '6A12345678902',
  awaitingPickup: '6A12345678903',
  delivered: '6A12345678904',
  problem: 'LA123456789FR',
  chronopost: 'XY123456789FR',
};

const SHIPMENTS = {
  [NUMBERS.inTransit]: 'in-transit',
  [NUMBERS.outForDelivery]: 'out-for-delivery',
  [NUMBERS.awaitingPickup]: 'awaiting-pickup',
  [NUMBERS.delivered]: 'delivered',
  [NUMBERS.problem]: 'problem',
  [NUMBERS.chronopost]: 'chronopost-delivered',
};

/**
 * Simulated API. `answers[number]` is a fixture name, or `{ status, body,
 * headers }`; an unknown number gets the documented 404. `failAll` answers
 * every request with that response; `throwAll` makes fetch reject.
 */
export function createApi({ key = KEY } = {}) {
  const api = {
    answers: { ...SHIPMENTS },
    failAll: null,
    throwAll: null,
    requests: [],
    async fetch(url, options = {}) {
      const parsed = new URL(url);
      const number = decodeURIComponent(parsed.pathname.split('/').pop());
      api.requests.push({
        url,
        number,
        lang: parsed.searchParams.get('lang'),
        headers: options.headers,
      });
      if (api.throwAll) {
        throw api.throwAll;
      }
      let answer = api.failAll;
      if (!answer && options.headers?.['X-Okapi-Key'] !== key) {
        answer = { status: 401, body: fixture('error-401-okapi') };
      }
      if (!answer) {
        const entry = api.answers[number];
        answer =
          entry === undefined
            ? { status: 404, body: fixture('error-404') }
            : typeof entry === 'string'
              ? { status: 200, body: fixture(entry) }
              : entry;
      }
      return {
        ok: answer.status >= 200 && answer.status < 300,
        status: answer.status,
        headers: new Headers(answer.headers ?? {}),
        json: async () => {
          if (answer.body === undefined) {
            throw new SyntaxError('Unexpected end of JSON input');
          }
          return structuredClone(answer.body);
        },
      };
    },
    /** Requests for a number (the key check excluded). */
    readsOf: (number) => api.requests.filter((request) => request.number === number).length,
  };
  return api;
}

/** A manual clock; `sleep` moves it forward instead of waiting. */
export function createClock(start = Date.parse('2026-10-14T08:00:00Z')) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
    async sleep(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config (the key by default)
 * @param {object} [options.api] from createApi
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {object} [options.saved] content of /data/parcels.json before the start
 * @param {boolean} [options.connect]
 */
export async function createWorld({
  config = {},
  api = createApi(),
  devices = [],
  saved,
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-laposte-')),
} = {}) {
  const gladys = createFakeGladys({ config: { api_key: KEY, ...config }, devices });
  const store = new Store(dataDir);
  if (saved) {
    await store.save(saved);
    await store.flush();
  }
  const app = registerHandlers(gladys, {
    store,
    fetch: api.fetch,
    timers,
    now: clock.now,
    sleep: clock.sleep,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.tracker.running;
  }
  return { gladys, fake: gladys.fake, app, tracker: app.tracker, api, clock, store, dataDir };
}

/** Run the "Add a parcel" action; resolves with the ack. */
export const addParcel = (world, number, name) =>
  world.fake.action('add_parcel', name === undefined ? { number } : { number, name });

/** Create the device in Gladys, as the user would from the Discover tab. */
export async function createDevice(world) {
  const [device] = world.fake.discoveredDevices;
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of the device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`)).external_id;

/** One cycle after `ms` of time. */
export async function after(world, ms) {
  world.clock.advance(ms);
  return world.tracker.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
