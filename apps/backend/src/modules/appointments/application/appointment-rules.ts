import type { Appointment } from '@monopiston/contracts';

export const ACTIVE_STATUSES = [
  // A slot held while its Flow payment is pending must keep blocking the slot
  // so two customers can't book the same time during the payment window.
  'pending_payment',
  'requested',
  'confirmed',
  'checked_in',
  'in_service',
  'ready',
] as const;

export const CUSTOMER_CANCELLABLE_STATUSES: Appointment['status'][] = [
  'requested',
  'confirmed',
];

export const ALLOWED_STATUS_TRANSITIONS = {
  cancelled: [],
  checked_in: ['in_service', 'cancelled'],
  completed: [],
  confirmed: ['checked_in', 'in_service', 'cancelled', 'no_show'],
  in_service: ['ready'],
  no_show: [],
  pending_payment: ['confirmed', 'cancelled'],
  ready: ['completed'],
  requested: ['confirmed', 'cancelled'],
} as const satisfies Record<
  Appointment['status'],
  readonly Appointment['status'][]
>;
