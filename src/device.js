// -----------------------------------------------------------------------------
// One Gladys device for all the parcels: "La Poste parcels".
//
// Parcels live a few days and Gladys never deletes a device by itself: one
// device per parcel would leave a dead device behind every delivery, and fill
// the Discover tab. The device holds what scenes and history need (counts and
// a summary); the details of each parcel are in the widget, in the variables
// of the scene triggers and in the "Read my parcels" scene action.
//
// Features (couples checked against the Gladys front, v5.2.0):
//   - in_progress, out_for_delivery, awaiting_pickup, problems, delivered:
//     counter-sensor/integer, read only;
//   - summary: text/text (one line per parcel on the way).
// Published with should_poll: false: the container reads La Poste on its own
// timer (src/tracker.js), at most once per parcel per interval.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { NAMES, pick } from './texts.js';

export const DEVICE_TYPE = 'parcels';
export const PLATFORM_ID = 'laposte';
export const COUNTERS = [
  'in_progress',
  'out_for_delivery',
  'awaiting_pickup',
  'problems',
  'delivered',
];
export const SUMMARY = 'summary';

// Tracked parcels at most: also the display bound of the counters.
export const MAX_PARCELS = 50;

/** External ids of the device and of its features. */
export function deviceIds(gladys) {
  const ids = gladys.externalIds(DEVICE_TYPE, PLATFORM_ID);
  return {
    device: ids.device,
    ...Object.fromEntries([...COUNTERS, SUMMARY].map((key) => [key, ids.feature(key)])),
  };
}

/** The discovery payload of the device, feature names in `language`. */
export function buildDevice(gladys, language = 'fr') {
  const ids = deviceIds(gladys);
  const names = pick(NAMES, language);
  return {
    name: names.device,
    external_id: ids.device,
    model: 'Suivi v2',
    should_poll: false,
    features: [
      ...COUNTERS.map((key) => ({
        name: names[key],
        external_id: ids[key],
        category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        read_only: true,
        has_feedback: false,
        keep_history: true,
        min: 0,
        max: MAX_PARCELS,
      })),
      {
        name: names.summary,
        external_id: ids.summary,
        category: DEVICE_FEATURE_CATEGORIES.TEXT,
        type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
        read_only: true,
        has_feedback: false,
        keep_history: false,
        min: 0,
        max: 0,
      },
    ],
  };
}
