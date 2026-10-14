// -----------------------------------------------------------------------------
// The status of a parcel, from the code of its last event (event codes of the
// Suivi v2 API, common to tracked letters, Colissimo and Chronopost):
//   DR1 declared by the sender           -> announced
//   PC1 PC2 ET1-4 EP1 DO1 DO2 PB2 (and any other code) -> in_transit
//   MD2 out for delivery                  -> out_for_delivery
//   AG1 waiting at a counter or pickup point (the "instance") -> awaiting_pickup
//   PB1 problem, ND1 undeliverable, RE1 returned to the sender, DO3 held at
//   customs                               -> problem
//   DI1 delivered                         -> delivered
//   DI2 delivered back to the sender      -> returned
// Two statuses of our own: pending (never read yet) and unknown (La Poste
// does not know the number yet: a label printed but not handed over).
// -----------------------------------------------------------------------------

export const STATUSES = [
  'pending',
  'unknown',
  'announced',
  'in_transit',
  'out_for_delivery',
  'awaiting_pickup',
  'problem',
  'delivered',
  'returned',
];

const BY_CODE = {
  DR1: 'announced',
  MD2: 'out_for_delivery',
  AG1: 'awaiting_pickup',
  PB1: 'problem',
  ND1: 'problem',
  RE1: 'problem',
  DO3: 'problem',
  DI1: 'delivered',
  DI2: 'returned',
};

// Statuses after which La Poste is not asked again.
export const FINAL_STATUSES = new Set(['delivered', 'returned']);

// Display order: what needs the user first.
export const DISPLAY_ORDER = [
  'out_for_delivery',
  'awaiting_pickup',
  'problem',
  'in_transit',
  'announced',
  'unknown',
  'pending',
  'delivered',
  'returned',
];

// Scene trigger fired when a parcel enters a status. A return ends as a
// problem: DI2 after RE1 does not fire twice (same trigger).
export const TRIGGERS = {
  out_for_delivery: 'parcel_out_for_delivery',
  awaiting_pickup: 'parcel_awaiting_pickup',
  delivered: 'parcel_delivered',
  problem: 'parcel_problem',
  returned: 'parcel_problem',
};

/** Status of a parsed shipment (src/laposte.js). */
export function statusOf(shipment) {
  const code = shipment.lastEvent?.code;
  const byCode = code ? BY_CODE[code] : undefined;
  if (shipment.isFinal && !FINAL_STATUSES.has(byCode)) {
    // La Poste closed the tracking on a code that is not a delivery: a parcel
    // that went back (problem) is returned, any other one delivered.
    return byCode === 'problem' ? 'returned' : 'delivered';
  }
  if (byCode) {
    return byCode;
  }
  if (code?.startsWith('DI') || shipment.isFinal) {
    return 'delivered';
  }
  return shipment.lastEvent ? 'in_transit' : 'unknown';
}

/** Name of the carrier, from the `holder` of the API (brands are not translated). */
export function carrierOf(holder) {
  return { 3: 'Chronopost', 4: 'Colissimo' }[holder] ?? 'La Poste';
}
