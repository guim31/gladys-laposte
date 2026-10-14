// -----------------------------------------------------------------------------
// The tracker: the list of parcels, their reading by the La Poste API, the
// device states, the scene triggers and the answers of the actions.
//
// Pace: the container ticks every minute and reads only the parcels due (one
// request per parcel per configured interval, 30 minutes by default), one
// second apart. A delivered or returned parcel is never read again, and is
// removed after the configured number of days. A refused key stops every
// reading until the key changes; a quota reached (429) or an API down pauses
// them. The device is published with should_poll: false (Gladys polls at most
// every minute, and the 5.2.0 core never polls a device created without
// should_poll): this timer is the only scheduler, onPoll only runs a cycle.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { buildDevice, COUNTERS, deviceIds, MAX_PARCELS, SUMMARY } from './device.js';
import { ERROR_KINDS, fetchShipment as defaultFetchShipment, LaPosteError } from './laposte.js';
import { extractNumber, normalizeNumber } from './numbers.js';
import { carrierOf, DISPLAY_ORDER, FINAL_STATUSES, statusOf, TRIGGERS } from './status.js';
import { CONNECTION, ERRORS, MESSAGES, PHRASES, pick, SENTENCES, STATUS_LABELS } from './texts.js';

const logger = createLogger({ name: 'laposte' });

export const WIDGET_KEY = 'parcels';
export const TICK_MS = 60_000;
export const SPACING_MS = 1_000;
export const FORCED_SPACING_MS = 200;
export const HEARTBEAT_MS = 12 * 3_600_000;
export const QUOTA_PAUSE_MS = 3_600_000;
export const UNAVAILABLE_PAUSE_MS = 10 * 60_000;
// A number La Poste still does not know after this many days is dropped.
export const UNKNOWN_EXPIRY_DAYS = 30;
export const MAX_NAME = 60;
export const MAX_SUMMARY = 250;
export const MAX_EVENTS = 10;
// Read when no parcel is due, to tell a valid key (404 on this number) from a
// refused one (401) in the Configuration screen.
export const KEY_CHECK_NUMBER = 'LA000000000FR';

const DAY_MS = 86_400_000;
const LANGS = ['en', 'fr', 'de', 'es'];

/** The same message in the four languages, each rendered in its own. */
export const inAllLanguages = (render) => Object.fromEntries(LANGS.map((l) => [l, render(l)]));

/** A mistake of the user: answered in the action, not thrown as a failure. */
export class UserError extends Error {
  constructor(messages) {
    super(messages.en);
    this.name = 'UserError';
    this.messages = messages;
  }
}

const cleanName = (value) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '';

const isDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));

/** A parcel read back from /data, with only the fields we know. */
function restore(saved, number) {
  const events = Array.isArray(saved.events) ? saved.events.filter((e) => e?.code) : [];
  return {
    number,
    name: cleanName(saved.name) || number,
    addedAt: Number.isFinite(saved.addedAt) ? saved.addedAt : Date.now(),
    status: typeof saved.status === 'string' ? saved.status : 'pending',
    checkedAt: Number.isFinite(saved.checkedAt) ? saved.checkedAt : null,
    finalAt: Number.isFinite(saved.finalAt) ? saved.finalAt : null,
    holder: Number.isInteger(saved.holder) ? saved.holder : null,
    events: events.slice(0, MAX_EVENTS),
    lastEvent: events[0] ?? null,
    estimatedDate: isDate(saved.estimatedDate) ? saved.estimatedDate : null,
    deliveryDate: isDate(saved.deliveryDate) ? saved.deliveryDate : null,
    url: typeof saved.url === 'string' ? saved.url : null,
    removalPoint: typeof saved.removalPoint === 'string' ? saved.removalPoint : null,
  };
}

const newParcel = (number, name, now) => restore({ name, addedAt: now }, number);

export class Tracker {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] test seam for the HTTP client
   * @param {Function} [options.now]
   * @param {Function} [options.sleep]
   * @param {boolean} [options.timers] false: the tests run the cycles
   */
  constructor({
    gladys,
    store,
    fetch = globalThis.fetch,
    now = Date.now,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    timers = true,
    spacingMs = SPACING_MS,
  }) {
    Object.assign(this, { gladys, store, fetch, now, sleep, timers, spacingMs });
    this.config = normalizeConfig();
    this.parcels = new Map();
    this.timer = null;
    this.cycle = null;
    this.running = Promise.resolve();
    // Read pauses and failures, each logged once (and once at recovery).
    this.keyRejected = false;
    this.pauseUntil = 0;
    this.apiProblem = null;
    this.cycleFailed = false;
    this.publishFailed = false;
    this.connection = null;
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    for (const entry of Array.isArray(saved.parcels) ? saved.parcels : []) {
      const number = normalizeNumber(entry?.number);
      if (number && !this.parcels.has(number) && this.parcels.size < MAX_PARCELS) {
        this.parcels.set(number, restore(entry, number));
      }
    }
    logger.info(`Started, ${this.parcels.size} parcel(s) tracked`);
    await this.publishDevice();
    await this.updateConnection();
    if (this.timers) {
      this.timer = setInterval(() => this.runCycle(), TICK_MS);
    }
    this.running = this.runCycle();
  }

  /** Gladys restarted: publish everything again. */
  async resync(config) {
    this.config = config;
    this.connection = null;
    await this.publishDevice();
    this.gladys.forgetPublishedStates();
    await this.updateConnection();
    await this.publishStates();
  }

  async reconfigure(config) {
    // A cycle in flight reads with the old key: let it end, its answers about
    // the old key are dropped (see `staleKey`), then read with the new one.
    await this.cycle?.catch(() => {});
    const keyChanged = config.apiKey !== this.config.apiKey;
    const languageChanged = config.language !== this.config.language;
    this.config = config;
    if (keyChanged) {
      this.keyRejected = false;
      this.pauseUntil = 0;
      this.connection = null;
      logger.info(config.apiKey ? 'API key changed' : 'API key removed');
      this.refreshWidget();
    }
    if (languageChanged) {
      await this.publishDevice();
      this.refreshWidget();
    }
    await this.updateConnection();
    await this.runCycle();
  }

  async stop() {
    clearInterval(this.timer);
    this.timer = null;
    await this.cycle?.catch(() => {});
    await this.store.flush();
  }

  // --- Reading ---------------------------------------------------------------

  canRead(now = this.now()) {
    return Boolean(this.config.apiKey) && !this.keyRejected && now >= this.pauseUntil;
  }

  isDone(parcel) {
    return parcel.finalAt !== null || FINAL_STATUSES.has(parcel.status);
  }

  /** One cycle; a cycle already running is shared, never doubled. */
  runCycle(options = {}) {
    if (!this.cycle) {
      this.cycle = this.cycleBody(options).finally(() => {
        this.cycle = null;
      });
    }
    return this.cycle;
  }

  async cycleBody({ force = false } = {}) {
    try {
      const now = this.now();
      let changed = this.prune(now);
      let read = 0;
      if (this.canRead(now)) {
        const due = [...this.parcels.values()].filter(
          (parcel) =>
            !this.isDone(parcel) &&
            (force ||
              parcel.checkedAt === null ||
              // Half a tick of slack: the timer never fires exactly on time.
              now - parcel.checkedAt >= this.config.checkIntervalMs - TICK_MS / 2),
        );
        for (const parcel of due) {
          if (read > 0) {
            // The user waits for a forced cycle (120 s at most): shorter
            // spacing, still far below the quota of the free plan.
            await this.sleep(force ? Math.min(this.spacingMs, FORCED_SPACING_MS) : this.spacingMs);
          }
          if (this.parcels.get(parcel.number) !== parcel) {
            continue; // removed meanwhile
          }
          const outcome = await this.read(parcel);
          changed = changed || outcome.changed;
          if (outcome.stop) {
            break;
          }
          read += 1;
        }
        if (due.length === 0 && this.connection === null) {
          await this.checkKey();
        }
      }
      logger.debug(`Reading cycle: ${read} parcel(s) read, ${this.parcels.size} tracked`);
      if (read > 0 || changed) {
        this.save();
      }
      if (changed) {
        this.refreshWidget();
      }
      await this.publishStates();
      if (this.cycleFailed) {
        this.cycleFailed = false;
        logger.info('Reading cycles work again');
      }
      return read;
    } catch (err) {
      if (this.cycleFailed) {
        logger.debug(`Reading cycle failed again: ${err.message}`);
      } else {
        this.cycleFailed = true;
        logger.error('Reading cycle failed', err);
      }
      return 0;
    }
  }

  /** Reads one parcel; `stop` ends the cycle (key refused, quota, API down). */
  async read(parcel) {
    const apiKey = this.config.apiKey;
    try {
      const shipment = await defaultFetchShipment(parcel.number, {
        apiKey,
        language: this.config.language,
        fetch: this.fetch,
      });
      if (apiKey !== this.config.apiKey) {
        return { changed: false, stop: true };
      }
      await this.apiAnswered();
      if (this.parcels.get(parcel.number) !== parcel) {
        return { changed: false }; // removed while La Poste was answering
      }
      return { changed: await this.apply(parcel, shipment) };
    } catch (err) {
      if (!(err instanceof LaPosteError)) {
        throw err;
      }
      if (apiKey !== this.config.apiKey) {
        return { changed: false, stop: true };
      }
      if (err.kind === ERROR_KINDS.NOT_FOUND || err.kind === ERROR_KINDS.INVALID_NUMBER) {
        // The key works; La Poste does not know this number (yet).
        await this.apiAnswered();
        parcel.checkedAt = this.now();
        if (parcel.status === 'pending') {
          parcel.status = 'unknown';
          logger.debug(`${parcel.name}: not known by La Poste yet`);
          return { changed: true };
        }
        return { changed: false };
      }
      if (err.kind === ERROR_KINDS.UNAVAILABLE) {
        // Read again at its next interval: a number La Poste keeps failing
        // on never blocks the parcels after it.
        parcel.checkedAt = this.now();
      }
      await this.apiFailed(err);
      return { changed: false, stop: true };
    }
  }

  /** Reads a number nobody tracks, only to learn whether the key works. */
  async checkKey() {
    const apiKey = this.config.apiKey;
    try {
      await defaultFetchShipment(KEY_CHECK_NUMBER, {
        apiKey,
        language: this.config.language,
        fetch: this.fetch,
      });
      if (apiKey === this.config.apiKey) {
        await this.apiAnswered();
      }
    } catch (err) {
      if (!(err instanceof LaPosteError)) {
        throw err;
      }
      if (apiKey !== this.config.apiKey) {
        return;
      }
      if (err.kind === ERROR_KINDS.NOT_FOUND || err.kind === ERROR_KINDS.INVALID_NUMBER) {
        await this.apiAnswered();
      } else {
        await this.apiFailed(err);
      }
    }
  }

  async apiAnswered() {
    if (this.apiProblem) {
      logger.info('The La Poste API answers again');
      this.apiProblem = null;
      this.refreshWidget();
    }
    await this.setConnection(true);
  }

  async apiFailed(err) {
    const now = this.now();
    if (err.kind === ERROR_KINDS.INVALID_KEY) {
      this.keyRejected = true;
      this.refreshWidget();
      logger.warn('La Poste refuses the API key: no reading until it is changed');
      await this.setConnection(false, CONNECTION.invalidKey);
      return;
    }
    const quota = err.kind === ERROR_KINDS.QUOTA;
    this.pauseUntil = now + (quota ? (err.retryAfterMs ?? QUOTA_PAUSE_MS) : UNAVAILABLE_PAUSE_MS);
    const kind = quota ? 'quota' : 'unavailable';
    if (this.apiProblem === kind) {
      logger.debug(`${err.message}, readings paused again`);
      return;
    }
    this.apiProblem = kind;
    this.refreshWidget();
    const minutes = Math.round((this.pauseUntil - now) / 60_000);
    logger.warn(`${err.message}: readings paused for ${minutes} min`);
  }

  /** Applies a shipment read from La Poste; true when the parcel changed. */
  async apply(parcel, shipment) {
    const now = this.now();
    const before = parcel.status;
    const status = statusOf(shipment);
    const changed =
      status !== before ||
      shipment.lastEvent?.code !== parcel.lastEvent?.code ||
      shipment.lastEvent?.date !== parcel.lastEvent?.date ||
      shipment.estimatedDate !== parcel.estimatedDate;
    Object.assign(parcel, {
      status,
      checkedAt: now,
      holder: shipment.holder,
      events: shipment.events.slice(0, MAX_EVENTS),
      lastEvent: shipment.lastEvent,
      estimatedDate: shipment.estimatedDate,
      deliveryDate: shipment.deliveryDate,
      url: shipment.url,
      removalPoint: shipment.removalPoint,
    });
    if ((shipment.isFinal || FINAL_STATUSES.has(status)) && parcel.finalAt === null) {
      // The days kept count from the delivery itself, when La Poste dates it.
      const delivered = Date.parse(shipment.deliveryDate ?? shipment.lastEvent?.date ?? '');
      parcel.finalAt = Number.isFinite(delivered) ? Math.min(delivered, now) : now;
    }
    if (changed) {
      logger.debug(`${parcel.name}: ${before} -> ${status} (${shipment.lastEvent?.code ?? '-'})`);
    }
    const trigger = TRIGGERS[status];
    // A parcel first seen delivered (never seen on the way) is not news.
    const addedDelivered =
      (before === 'pending' || before === 'unknown') && FINAL_STATUSES.has(status);
    if (trigger && trigger !== TRIGGERS[before] && !addedDelivered) {
      await this.fire(trigger, parcel);
    }
    return changed;
  }

  async fire(key, parcel) {
    const language = this.config.language;
    try {
      await this.gladys.publishSceneEvent(key, {
        name: parcel.name,
        number: parcel.number,
        status: pick(STATUS_LABELS, language)[parcel.status],
        event: parcel.lastEvent?.label ?? '',
        carrier: carrierOf(parcel.holder),
        pickup_point: parcel.removalPoint ?? '',
        url: parcel.url ?? '',
      });
      logger.debug(`Scene trigger ${key} fired for ${parcel.name}`);
    } catch (err) {
      logger.warn(`Scene trigger ${key} refused: ${err.message}`);
    }
  }

  /** Removes the parcels delivered long enough ago, and the numbers never found. */
  prune(now) {
    let changed = false;
    for (const parcel of [...this.parcels.values()]) {
      const keptDays = parcel.finalAt === null ? null : (now - parcel.finalAt) / DAY_MS;
      const unknownDays =
        parcel.status === 'unknown' || parcel.status === 'pending'
          ? (now - parcel.addedAt) / DAY_MS
          : null;
      if (keptDays !== null && keptDays >= this.config.keepDeliveredDays) {
        logger.info(`${parcel.name} removed: delivered ${Math.floor(keptDays)} days ago`);
      } else if (unknownDays !== null && unknownDays >= UNKNOWN_EXPIRY_DAYS) {
        logger.info(
          `${parcel.name} removed: still unknown to La Poste after ${UNKNOWN_EXPIRY_DAYS} days`,
        );
      } else {
        continue;
      }
      this.parcels.delete(parcel.number);
      changed = true;
    }
    return changed;
  }

  // --- Gladys ----------------------------------------------------------------

  async publishDevice() {
    try {
      await this.gladys.publishDiscoveredDevices([buildDevice(this.gladys, this.config.language)]);
    } catch (err) {
      logger.warn(`Publishing the device failed: ${err.message}`);
    }
  }

  deviceCreated() {
    const { device } = deviceIds(this.gladys);
    return (this.gladys.devices ?? []).some((entry) => entry.external_id === device);
  }

  async publishStates() {
    if (!this.deviceCreated()) {
      return;
    }
    const ids = deviceIds(this.gladys);
    const counts = this.counts();
    const states = [
      ...COUNTERS.map((key) => ({ device_feature_external_id: ids[key], state: counts[key] })),
      { device_feature_external_id: ids[SUMMARY], text: this.summary() },
    ];
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (this.publishFailed) {
        this.publishFailed = false;
        logger.info('Publishing the states works again');
      }
    } catch (err) {
      if (this.publishFailed) {
        logger.debug(`Publishing the states failed again: ${err.message}`);
      } else {
        this.publishFailed = true;
        logger.warn(`Publishing the states failed: ${err.message}`);
      }
    }
  }

  async onDeviceCreated(device) {
    if (device?.external_id !== deviceIds(this.gladys).device) {
      return;
    }
    // Gladys dropped the states sent before the device existed: all again.
    this.gladys.forgetPublishedStates(device.external_id);
    await this.publishStates();
    this.refreshWidget();
  }

  refreshWidget() {
    Promise.resolve()
      .then(() => this.gladys.requestWidgetRefresh(WIDGET_KEY))
      .catch(() => {});
  }

  /** Connection badge of the Configuration screen, sent only when it changes. */
  async setConnection(connected, message) {
    const signature = `${connected}:${message?.en ?? ''}`;
    if (this.connection === signature) {
      return;
    }
    this.connection = signature;
    try {
      await this.gladys.setConnectionStatus(connected, message);
    } catch (err) {
      this.connection = null;
      logger.debug(`Connection status refused: ${err.message}`);
    }
  }

  async updateConnection() {
    if (!this.config.apiKey) {
      await this.setConnection(false, CONNECTION.noKey);
    } else if (this.keyRejected) {
      await this.setConnection(false, CONNECTION.invalidKey);
    }
  }

  save() {
    const parcels = [...this.parcels.values()].map((parcel) => ({ ...parcel }));
    return this.store.save({ parcels });
  }

  // --- Views -------------------------------------------------------------------

  /** Parcels in display order: what needs the user first, then the most recent. */
  sortedParcels() {
    const rank = (parcel) => {
      const index = DISPLAY_ORDER.indexOf(parcel.status);
      return index === -1 ? DISPLAY_ORDER.length : index;
    };
    return [...this.parcels.values()].sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (b.lastEvent?.date ?? '').localeCompare(a.lastEvent?.date ?? '') ||
        b.addedAt - a.addedAt,
    );
  }

  activeParcels() {
    return this.sortedParcels().filter((parcel) => !this.isDone(parcel));
  }

  counts() {
    const active = this.activeParcels();
    const count = (predicate) => [...this.parcels.values()].filter(predicate).length;
    return {
      in_progress: active.length,
      out_for_delivery: active.filter((p) => p.status === 'out_for_delivery').length,
      awaiting_pickup: active.filter((p) => p.status === 'awaiting_pickup').length,
      problems: active.filter((p) => p.status === 'problem').length,
      delivered: count((p) => p.status === 'delivered'),
    };
  }

  /** "You have 2 parcels on the way: Shoes, out for delivery; Book, in transit." */
  sentence(language = this.config.language) {
    const texts = pick(SENTENCES, language);
    const phrases = pick(PHRASES, language);
    const active = this.activeParcels();
    if (active.length === 0) {
      return texts.none;
    }
    const items = active.map((parcel) =>
      texts.item({ name: parcel.name, phrase: phrases[parcel.status] ?? phrases.in_transit }),
    );
    return `${texts.intro({ count: active.length })}${items.join(texts.separator)}${texts.end}`;
  }

  summary() {
    const text = this.sentence();
    return text.length <= MAX_SUMMARY ? text : `${text.slice(0, MAX_SUMMARY - 1)}…`;
  }

  // --- Actions -----------------------------------------------------------------

  /**
   * Adds a parcel, or renames the one with this number, then reads it once.
   * @returns {Promise<{ parcel: object, isNew: boolean }>}
   * @throws {UserError}
   */
  async track(rawNumber, rawName, { extract = false } = {}) {
    const number = extract ? extractNumber(rawNumber) : normalizeNumber(rawNumber);
    if (!number) {
      const value = String(rawNumber ?? '').slice(0, 40);
      throw new UserError(inAllLanguages((l) => MESSAGES[l].invalidNumber({ value })));
    }
    const name = cleanName(rawName);
    const existing = this.parcels.get(number);
    if (existing) {
      if (name && name !== existing.name) {
        existing.name = name;
        logger.info(`Parcel ${number} renamed ${name}`);
        await this.afterChange();
      }
      return { parcel: existing, isNew: false };
    }
    if (this.parcels.size >= MAX_PARCELS) {
      throw new UserError(inAllLanguages((l) => MESSAGES[l].tooMany({ max: MAX_PARCELS })));
    }
    const parcel = newParcel(number, name || number, this.now());
    this.parcels.set(number, parcel);
    logger.info(`Parcel ${parcel.name} added`);
    if (this.canRead()) {
      await this.read(parcel);
    }
    await this.afterChange();
    return { parcel, isNew: true };
  }

  async afterChange() {
    this.save();
    this.refreshWidget();
    await this.publishStates();
  }

  /** Configuration action "Add a parcel". */
  async addParcel(fields = {}) {
    const { parcel, isNew } = await this.track(fields.number, fields.name);
    const answer = inAllLanguages((l) =>
      isNew || !cleanName(fields.name)
        ? MESSAGES[l].added({ name: parcel.name, status: STATUS_LABELS[l][parcel.status] })
        : MESSAGES[l].renamed({ name: parcel.name }),
    );
    if (!this.config.apiKey) {
      return inAllLanguages((l) => `${answer[l]} ${MESSAGES[l].noKey}`);
    }
    return answer;
  }

  /** Configuration action "Remove a parcel": by number or by name. */
  async removeParcel(fields = {}) {
    const query = typeof fields.parcel === 'string' ? fields.parcel.trim() : '';
    const number = normalizeNumber(query);
    const parcel =
      (number && this.parcels.get(number)) ||
      [...this.parcels.values()].find((p) => p.name.toLowerCase() === query.toLowerCase());
    if (!parcel || !query) {
      const value = query.slice(0, 40);
      throw new UserError(inAllLanguages((l) => MESSAGES[l].notTracked({ value })));
    }
    this.parcels.delete(parcel.number);
    logger.info(`Parcel ${parcel.name} removed`);
    await this.afterChange();
    return inAllLanguages((l) => MESSAGES[l].removed({ name: parcel.name }));
  }

  /** Configuration action "Read the parcels now": ignores the interval, once. */
  async refreshNow() {
    if (!this.config.apiKey) {
      throw new UserError(inAllLanguages((l) => MESSAGES[l].noKey));
    }
    // The user asks: one more try, even after a refusal or a pause.
    await this.cycle?.catch(() => {});
    this.keyRejected = false;
    this.pauseUntil = 0;
    const active = this.activeParcels().length;
    let count = 0;
    if (active === 0) {
      await this.checkKey();
    } else {
      count = await this.runCycle({ force: true });
    }
    if (this.keyRejected) {
      throw new UserError(inAllLanguages((l) => ERRORS[l].invalid_key));
    }
    if (this.apiProblem && count === 0) {
      throw new UserError(inAllLanguages((l) => ERRORS[l][this.apiProblem]));
    }
    if (active === 0) {
      return inAllLanguages((l) => MESSAGES[l].nothingToRefresh);
    }
    return inAllLanguages((l) => MESSAGES[l].refreshed({ count }));
  }
}
