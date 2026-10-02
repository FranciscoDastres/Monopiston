import { z } from 'zod';

export type ServiceStatus = 'ok' | 'degraded';

export interface HealthResponse {
  service: 'monopiston-api';
  status: ServiceStatus;
  timestamp: string;
  checks?: {
    database: ServiceStatus;
  };
}

export const UserRoleSchema = z.enum(['customer', 'admin']);

export const CurrentUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  avatarUrl: z.url().nullable(),
  phone: z.string().nullable(),
  role: UserRoleSchema,
});

export type CurrentUser = z.infer<typeof CurrentUserSchema>;

export const AdminLoginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

export const UpdateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .max(32)
    .nullish()
    .transform((value) => (value ? value : null)),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const MotorcycleSchema = z.object({
  id: z.uuid(),
  nickname: z.string().nullable(),
  make: z.string(),
  model: z.string(),
  modelYear: z.number().int().min(2016).max(2100).nullable(),
  color: z.string().nullable(),
  licensePlate: z.string().nullable(),
  vin: z.string().nullable(),
  odometerKm: z.number().int().nonnegative().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateMotorcycleSchema = z.object({
  nickname: z.string().trim().min(1).max(80).optional(),
  modelYear: z.number().int().min(2016).max(2100).optional(),
  color: z.string().trim().min(1).max(60).optional(),
  licensePlate: z.string().trim().min(1).max(20).optional(),
  vin: z.string().trim().min(11).max(32).optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const UpdateMotorcycleSchema = CreateMotorcycleSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'At least one field is required',
);

export type Motorcycle = z.infer<typeof MotorcycleSchema>;
export type CreateMotorcycleInput = z.infer<typeof CreateMotorcycleSchema>;
export type UpdateMotorcycleInput = z.infer<typeof UpdateMotorcycleSchema>;

export const ServiceSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  currency: z.string().length(3),
});

export type Service = z.infer<typeof ServiceSchema>;

/**
 * Bookings are limited to the current and following calendar year. Keeps the
 * date picker honest and blocks arbitrary far-future dates (e.g. year 9999)
 * submitted directly to the API.
 */
export function isWithinBookingHorizon(year: number): boolean {
  return year <= new Date().getFullYear() + 1;
}

export const AvailabilityRequestSchema = z.object({
  date: z.iso
    .date()
    .refine(
      (value) => isWithinBookingHorizon(Number(value.slice(0, 4))),
      'Fecha fuera del rango reservable',
    ),
  serviceIds: z.array(z.uuid()).min(1).max(10),
});

export const AvailabilitySlotSchema = z.object({
  endsAt: z.iso.datetime(),
  startsAt: z.iso.datetime(),
});

export type AvailabilityRequest = z.infer<typeof AvailabilityRequestSchema>;
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

// Chilean mobile in E.164: +56 9 XXXX XXXX. Spaces, dashes and parentheses are
// stripped before validation so the UI can format freely.
export const ChileanPhoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .pipe(
    z
      .string()
      .regex(/^\+569\d{8}$/, 'Ingresa un número de WhatsApp chileno válido'),
  );

export const CreateAppointmentSchema = z.object({
  motorcycleId: z.uuid(),
  serviceIds: z.array(z.uuid()).min(1).max(10),
  startsAt: z.iso
    .datetime()
    .refine(
      (value) => isWithinBookingHorizon(new Date(value).getUTCFullYear()),
      'Fecha fuera del rango reservable',
    ),
  whatsappPhone: ChileanPhoneSchema,
});

export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;

export const CancelAppointmentSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});

export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;

export const RescheduleAppointmentSchema = z.object({
  startsAt: z.iso.datetime(),
});

export type RescheduleAppointmentInput = z.infer<
  typeof RescheduleAppointmentSchema
>;

export const AppointmentSchema = z.object({
  endsAt: z.iso.datetime(),
  id: z.uuid(),
  motorcycle: z.object({
    id: z.uuid(),
    label: z.string(),
  }),
  services: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      unitPrice: z.number().int().nonnegative(),
      currency: z.string().length(3),
    }),
  ),
  startsAt: z.iso.datetime(),
  total: z.number().int().nonnegative(),
  status: z.enum([
    'pending_payment',
    'requested',
    'confirmed',
    'checked_in',
    'in_service',
    'ready',
    'completed',
    'cancelled',
    'no_show',
  ]),
  whatsappPhone: z.string().nullable(),
});

export type Appointment = z.infer<typeof AppointmentSchema>;

export const ServiceBaySchema = z.object({
  description: z.string().nullable(),
  id: z.uuid(),
  name: z.string(),
});

export type ServiceBay = z.infer<typeof ServiceBaySchema>;

export const AdminAppointmentSchema = AppointmentSchema.extend({
  customer: z.object({
    displayName: z.string(),
    email: z.email(),
    id: z.uuid(),
    phone: z.string().nullable(),
  }),
  serviceBay: ServiceBaySchema,
});

export type AdminAppointment = z.infer<typeof AdminAppointmentSchema>;

export const AdminAppointmentFiltersSchema = z
  .object({
    from: z.iso.date(),
    statuses: z.array(AppointmentSchema.shape.status).min(1).max(8).optional(),
    to: z.iso.date(),
  })
  .refine((value) => value.from < value.to, {
    message: 'End date must be after start date',
    path: ['to'],
  })
  .refine(
    (value) =>
      Date.parse(`${value.to}T00:00:00.000Z`) -
        Date.parse(`${value.from}T00:00:00.000Z`) <=
      31 * 24 * 60 * 60 * 1000,
    {
      message: 'Date range cannot exceed 31 days',
      path: ['to'],
    },
  );

export type AdminAppointmentFilters = z.infer<
  typeof AdminAppointmentFiltersSchema
>;

export const ReassignAppointmentSchema = z.object({
  serviceBayId: z.uuid(),
});

export type ReassignAppointmentInput = z.infer<
  typeof ReassignAppointmentSchema
>;

export const UpdateAppointmentStatusSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  status: AppointmentSchema.shape.status,
});

export type UpdateAppointmentStatusInput = z.infer<
  typeof UpdateAppointmentStatusSchema
>;

export const CreateMotorcycleStatusUpdateSchema = z.object({
  customerVisible: z.boolean().default(true),
  message: z.string().trim().max(2000).optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  progressStatus: z.enum([
    'received',
    'diagnosing',
    'waiting_approval',
    'repairing',
    'quality_check',
    'ready_for_pickup',
    'delivered',
  ]),
});

export type CreateMotorcycleStatusUpdateInput = z.infer<
  typeof CreateMotorcycleStatusUpdateSchema
>;

export const AdminServiceSchema = ServiceSchema.extend({
  isActive: z.boolean(),
});

export const CreateServiceSchema = z.object({
  code: z.string().trim().min(2).max(40),
  currency: z.string().trim().length(3).default('CLP'),
  description: z.string().trim().max(2000).optional(),
  durationMinutes: z.number().int().min(5).max(1440),
  name: z.string().trim().min(2).max(120),
  price: z.number().int().nonnegative(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required',
  );

export type AdminService = z.infer<typeof AdminServiceSchema>;
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;

const workshopTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const BusinessHourSchema = z.object({
  closesAt: workshopTimeSchema,
  id: z.uuid(),
  opensAt: workshopTimeSchema,
  slotMinutes: z.number().int(),
  validFrom: z.iso.date(),
  validUntil: z.iso.date().nullable(),
  weekday: z.number().int().min(0).max(6),
});

export const SaveBusinessHourSchema = z.object({
  closesAt: workshopTimeSchema,
  opensAt: workshopTimeSchema,
  slotMinutes: z.number().int().min(5).max(240),
  validFrom: z.iso.date(),
  validUntil: z.iso.date().optional(),
  weekday: z.number().int().min(0).max(6),
});

export type BusinessHour = z.infer<typeof BusinessHourSchema>;
export type SaveBusinessHourInput = z.infer<typeof SaveBusinessHourSchema>;

export const ScheduleExceptionSchema = z.object({
  capacityOverride: z.number().int().positive().nullable(),
  endsAt: z.iso.datetime(),
  id: z.uuid(),
  kind: z.enum(['closed', 'availability_override']),
  reason: z.string().nullable(),
  startsAt: z.iso.datetime(),
});

export const CreateScheduleExceptionSchema = z
  .object({
    capacityOverride: z.number().int().positive().optional(),
    endsAt: z.iso.datetime(),
    kind: z.enum(['closed', 'availability_override']),
    reason: z.string().trim().max(255).optional(),
    startsAt: z.iso.datetime(),
  })
  .refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
    message: 'End must be after start',
    path: ['endsAt'],
  });

export type ScheduleException = z.infer<typeof ScheduleExceptionSchema>;
export type CreateScheduleExceptionInput = z.infer<
  typeof CreateScheduleExceptionSchema
>;

export const CustomerMotorcycleUpdateSchema = z.object({
  appointmentId: z.uuid(),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
  message: z.string().nullable(),
  motorcycleLabel: z.string(),
  progressStatus: z.enum([
    'received',
    'diagnosing',
    'waiting_approval',
    'repairing',
    'quality_check',
    'ready_for_pickup',
    'delivered',
  ]),
});

export const AppointmentTimelineSchema = z.object({
  appointment: AppointmentSchema,
  updates: z.array(CustomerMotorcycleUpdateSchema),
});

export type CustomerMotorcycleUpdate = z.infer<
  typeof CustomerMotorcycleUpdateSchema
>;
export type AppointmentTimeline = z.infer<typeof AppointmentTimelineSchema>;

export const ServiceHistoryWorkItemSchema = z.object({
  description: z.string(),
  id: z.uuid(),
  title: z.string(),
});

export const ServiceRecommendationSchema = ServiceHistoryWorkItemSchema.extend({
  dueAt: z.iso.datetime().nullable(),
  dueOdometerKm: z.number().int().nonnegative().nullable(),
  severity: z.enum(['info', 'warning', 'critical']),
});

export const ServiceHistoryRecordSchema = z.object({
  appointmentId: z.uuid(),
  completedAt: z.iso.datetime(),
  motorcycleLabel: z.string(),
  progress: z.array(CustomerMotorcycleUpdateSchema),
  recommendations: z.array(ServiceRecommendationSchema),
  services: z.array(z.string()),
  technicalSummary: z.string(),
  total: z.number().int().nonnegative(),
  workPending: z.array(ServiceHistoryWorkItemSchema),
  workPerformed: z.array(ServiceHistoryWorkItemSchema),
});

export type ServiceHistoryWorkItem = z.infer<
  typeof ServiceHistoryWorkItemSchema
>;
export type ServiceRecommendation = z.infer<typeof ServiceRecommendationSchema>;
export type ServiceHistoryRecord = z.infer<typeof ServiceHistoryRecordSchema>;

export const InvoiceSchema = z.object({
  amount: z.number().int().nonnegative(),
  appointmentId: z.uuid(),
  currency: z.string().length(3),
  documentNumber: z.string(),
  id: z.uuid(),
  issuedAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  paymentStatus: z.enum(['pending', 'paid']),
  services: z.array(z.string()),
  // Tax breakdown prepared for a future SII integration (nullable for legacy
  // invoices issued before payments were introduced).
  netAmount: z.number().int().nonnegative().nullable(),
  ivaAmount: z.number().int().nonnegative().nullable(),
  documentKind: z.string(),
  siiStatus: z.string(),
  siiFolio: z.string().nullable(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

// --- Payments (Flow) ---

export const PaymentModeSchema = z.enum([
  'total',
  'deposit_fixed',
  'deposit_pct',
]);

export type PaymentMode = z.infer<typeof PaymentModeSchema>;

export const PaymentTransactionStatusSchema = z.enum([
  'created',
  'pending',
  'paid',
  'failed',
  'expired',
  'cancelled',
]);

export type PaymentTransactionStatus = z.infer<
  typeof PaymentTransactionStatusSchema
>;

// Response of POST /v1/appointments/:id/payment — the frontend only ever
// receives a URL to redirect to; the amount is computed server-side.
export const PaymentInitResponseSchema = z.object({
  redirectUrl: z.url(),
});

export type PaymentInitResponse = z.infer<typeof PaymentInitResponseSchema>;

// Read model for the return page that reconstructs the receipt after payment.
export const PaymentStatusSchema = z.object({
  appointmentId: z.uuid(),
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: PaymentTransactionStatusSchema,
  invoiceId: z.uuid().nullable(),
});

export type PaymentStatusView = z.infer<typeof PaymentStatusSchema>;

export const PaymentSettingsSchema = z.object({
  mode: PaymentModeSchema,
  depositFixed: z.number().int().nonnegative(),
  depositPercent: z.number().int().min(1).max(100),
  holdMinutes: z.number().int().min(1).max(1440),
});

export type PaymentSettings = z.infer<typeof PaymentSettingsSchema>;

export const UpdatePaymentSettingsSchema =
  PaymentSettingsSchema.partial().refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required',
  );

export type UpdatePaymentSettingsInput = z.infer<
  typeof UpdatePaymentSettingsSchema
>;

export const CustomerDashboardSchema = z.object({
  activeAppointment: AppointmentSchema.nullable(),
  latestProgress: CustomerMotorcycleUpdateSchema.nullable(),
  nextAppointment: AppointmentSchema.nullable(),
  nextMaintenance: ServiceRecommendationSchema.nullable(),
  unpaidInvoices: z.number().int().nonnegative(),
});

export type CustomerDashboard = z.infer<typeof CustomerDashboardSchema>;

const WorkItemInputSchema = z.object({
  description: z.string().trim().min(2).max(2000),
  title: z.string().trim().min(2).max(160),
});

const RecommendationInputSchema = WorkItemInputSchema.extend({
  dueAt: z.iso.datetime().optional(),
  dueOdometerKm: z.number().int().nonnegative().optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
});

export const CompleteAppointmentWorkSchema = z.object({
  paymentStatus: z.enum(['pending', 'paid']).default('pending'),
  performed: z.array(WorkItemInputSchema).min(1).max(30),
  pending: z.array(WorkItemInputSchema).max(30).default([]),
  recommendations: z.array(RecommendationInputSchema).max(30).default([]),
  technicalSummary: z.string().trim().min(3).max(5000),
});

export type CompleteAppointmentWorkInput = z.infer<
  typeof CompleteAppointmentWorkSchema
>;

/** Kinds of technical-report item, mirrors the service_report_item_kind enum. */
export const ReportPresetKindSchema = z.enum([
  'performed',
  'pending',
  'recommendation',
]);

export type ReportPresetKind = z.infer<typeof ReportPresetKindSchema>;

/** A reusable predefined answer for the technical report. */
export const ReportPresetSchema = z.object({
  description: z.string(),
  id: z.uuid(),
  kind: ReportPresetKindSchema,
  severity: z.enum(['info', 'warning', 'critical']).nullable(),
  title: z.string(),
  usageCount: z.number().int().nonnegative(),
});

export type ReportPreset = z.infer<typeof ReportPresetSchema>;

export const CreateReportPresetSchema = z.object({
  description: z.string().trim().min(2).max(2000),
  kind: ReportPresetKindSchema,
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  title: z.string().trim().min(2).max(160),
});

export type CreateReportPresetInput = z.infer<typeof CreateReportPresetSchema>;

export const ReportPresetQuerySchema = z.object({
  kind: ReportPresetKindSchema.optional(),
});

export type ReportPresetQuery = z.infer<typeof ReportPresetQuerySchema>;

export const AdminUserSchema = z.object({
  appointmentCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  displayName: z.string(),
  email: z.email(),
  id: z.uuid(),
  isActive: z.boolean(),
  isPrimaryAdmin: z.boolean(),
  phone: z.string().nullable(),
  role: UserRoleSchema,
  totalSpent: z.number().int().nonnegative(),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;

export const CreateAdminUserSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  email: z.email().trim().toLowerCase(),
  phone: z
    .string()
    .trim()
    .max(32)
    .nullish()
    .transform((value) => (value ? value : null)),
});

export type CreateAdminUserInput = z.infer<typeof CreateAdminUserSchema>;

export const UpdateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.email().trim().toLowerCase().optional(),
    isActive: z.boolean().optional(),
    phone: z.string().trim().max(32).nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    'At least one field is required',
  );

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const AdminMetricsSchema = z.object({
  appointmentsByStatus: z.record(z.string(), z.number().int().nonnegative()),
  averageTicket: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  newUsersCount: z.number().int().nonnegative(),
  newUsersByDay: z.array(
    z.object({ date: z.iso.date(), total: z.number().int().nonnegative() }),
  ),
  pendingRequests: z.number().int().nonnegative(),
  revenueByDay: z.array(
    z.object({ date: z.iso.date(), total: z.number().int().nonnegative() }),
  ),
  revenueByService: z.array(
    z.object({ name: z.string(), total: z.number().int().nonnegative() }),
  ),
  totalRevenue: z.number().int().nonnegative(),
});

export type AdminMetrics = z.infer<typeof AdminMetricsSchema>;

export const AdminMetricsFiltersSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine((value) => value.from <= value.to, {
    message: 'End date must be after start date',
    path: ['to'],
  });

export type AdminMetricsFilters = z.infer<typeof AdminMetricsFiltersSchema>;
