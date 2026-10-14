// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+). A scene action does
// not receive the user's language: texts follow the `language` setting.
//
// - track_parcel: adds a parcel from a scene. The number field takes a whole
//   text too (the subject of a mail passed by an IMAP integration, a message):
//   the first tracking number found in it is used. Throwing fails this action
//   only, which the scene logs.
// - read_parcels: a sentence for a message or a voice announcement, and the
//   counts for a "Continue only if".
//
// Outputs are numbers, never booleans: the core's "Continue only if" compares
// with ===, and its value field only produces numbers and strings.
// -----------------------------------------------------------------------------

import { pick, STATUS_LABELS } from './texts.js';

export const SCENE_ACTIONS = {
  async track_parcel(tracker, { fields }) {
    const { parcel, isNew } = await tracker.track(fields.number, fields.name, { extract: true });
    return {
      number: parcel.number,
      name: parcel.name,
      status: pick(STATUS_LABELS, tracker.config.language)[parcel.status],
      added: isNew ? 1 : 0,
    };
  },

  async read_parcels(tracker) {
    const counts = tracker.counts();
    return {
      text: tracker.sentence(),
      in_progress: counts.in_progress,
      out_for_delivery: counts.out_for_delivery,
      awaiting_pickup: counts.awaiting_pickup,
    };
  },
};
