import type { Appointment, AvailabilitySlot } from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/Badge';
import { APPOINTMENT_STATUS_META } from '../../components/ui/status-meta';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCLP } from '../../components/ui/money';
import { Tabs } from '../../components/ui/Tabs';
import { apiClient } from '../../lib/api-client';
import { AppointmentCalendar } from './AppointmentCalendar';
import { dateFormatter } from './appointment-formatters';
import {
  getMaxBookableDate,
  getNextBookableDate,
  getToday,
} from './appointment-helpers';
import { TimeSlotGroup } from './TimeSlotGroup';

const UPCOMING_STATUSES: Appointment['status'][] = [
  'pending_payment',
  'requested',
  'confirmed',
  'checked_in',
  'in_service',
  'ready',
];

export function AppointmentListSection() {
  const queryClient = useQueryClient();
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<
    string | null
  >(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [reschedulingAppointmentId, setReschedulingAppointmentId] = useState<
    string | null
  >(null);
  const [rescheduleDate, setRescheduleDate] = useState(getNextBookableDate());
  const [rescheduleSlot, setRescheduleSlot] = useState('');
  const [appointmentsTab, setAppointmentsTab] = useState<'upcoming' | 'past'>(
    'upcoming',
  );

  const appointments = useQuery({
    queryFn: () => apiClient.get<Appointment[]>('/v1/appointments'),
    queryKey: ['appointments'],
  });
  const reschedulingAppointment = appointments.data?.find(
    (item) => item.id === reschedulingAppointmentId,
  );
  const rescheduleServiceIds =
    reschedulingAppointment?.services.map((service) => service.id) ?? [];
  const rescheduleAvailability = useQuery({
    enabled:
      Boolean(reschedulingAppointment) &&
      Boolean(rescheduleDate) &&
      rescheduleServiceIds.length > 0,
    queryFn: () =>
      apiClient.get<AvailabilitySlot[]>(
        `/v1/availability?date=${rescheduleDate}&serviceIds=${rescheduleServiceIds.join(',')}`,
      ),
    queryKey: [
      'availability',
      'reschedule',
      rescheduleDate,
      rescheduleServiceIds,
    ],
  });
  const cancelAppointment = useMutation({
    mutationFn: ({
      appointmentId,
      reason,
    }: {
      appointmentId: string;
      reason?: string;
    }) =>
      apiClient.patch<Appointment>(
        `/v1/appointments/${appointmentId}/cancel`,
        reason ? { reason } : {},
      ),
    onSuccess: async () => {
      setCancellationReason('');
      setCancellingAppointmentId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
      ]);
    },
  });
  const rescheduleAppointment = useMutation({
    mutationFn: ({
      appointmentId,
      startsAt,
    }: {
      appointmentId: string;
      startsAt: string;
    }) =>
      apiClient.patch<Appointment>(
        `/v1/appointments/${appointmentId}/reschedule`,
        { startsAt },
      ),
    onSuccess: async () => {
      setReschedulingAppointmentId(null);
      setRescheduleSlot('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['availability'] }),
        queryClient.invalidateQueries({ queryKey: ['customer', 'dashboard'] }),
      ]);
    },
  });

  const allAppointments = appointments.data ?? [];
  const nowMs = new Date().getTime();
  const upcomingAppointments = allAppointments.filter(
    (item) =>
      UPCOMING_STATUSES.includes(item.status) &&
      new Date(item.startsAt).getTime() >= nowMs,
  );
  const pastAppointments = allAppointments.filter(
    (item) => !upcomingAppointments.includes(item),
  );
  const visibleAppointments =
    appointmentsTab === 'upcoming' ? upcomingAppointments : pastAppointments;

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl font-extrabold">Tus citas</h2>
        <Tabs
          items={[
            {
              count: upcomingAppointments.length,
              label: 'Próximas',
              value: 'upcoming',
            },
            {
              count: pastAppointments.length,
              label: 'Historial',
              value: 'past',
            },
          ]}
          onChange={setAppointmentsTab}
          value={appointmentsTab}
        />
      </div>
      <div className="mt-5 space-y-3">
        {visibleAppointments.length === 0 && (
          <EmptyState
            icon="calendar"
            title={
              appointmentsTab === 'upcoming'
                ? 'No tienes citas próximas'
                : 'Aún no hay historial'
            }
            description={
              appointmentsTab === 'upcoming'
                ? 'Agenda una mantención para tu Honda NAVI arriba.'
                : 'Tus citas completadas y canceladas aparecerán aquí.'
            }
          />
        )}
        {visibleAppointments.map((item) => {
          const meta = APPOINTMENT_STATUS_META[item.status];
          return (
            <article
              className="bg-surface flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 p-5"
              key={item.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{item.motorcycle.label}</p>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
                <p className="text-muted mt-1 text-sm">
                  {item.services.map((service) => service.name).join(', ')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">
                  {dateFormatter.format(new Date(item.startsAt))}
                </p>
                <p className="text-primary mt-1 text-sm font-bold tabular-nums">
                  {formatCLP(item.total)}
                </p>
                <Link
                  className="text-muted hover:text-accent mt-2 inline-block text-xs font-semibold"
                  to={`/app/appointments/${item.id}`}
                >
                  Ver avance →
                </Link>
                {isCustomerCancellable(item) && (
                  <>
                    <button
                      aria-label={`Reprogramar cita de ${item.motorcycle.label}`}
                      className="text-muted hover:text-accent mt-2 ml-4 text-xs font-semibold"
                      onClick={() => {
                        setCancellingAppointmentId(null);
                        setRescheduleDate(getNextBookableDate());
                        setRescheduleSlot('');
                        rescheduleAppointment.reset();
                        setReschedulingAppointmentId(item.id);
                      }}
                      type="button"
                    >
                      Reprogramar
                    </button>
                    <button
                      aria-controls={`cancel-appointment-${item.id}`}
                      aria-expanded={cancellingAppointmentId === item.id}
                      aria-label={`Cancelar cita de ${item.motorcycle.label}`}
                      className="text-primary hover:text-danger mt-2 ml-4 text-xs font-semibold"
                      onClick={() => {
                        cancelAppointment.reset();
                        setCancellationReason('');
                        setCancellingAppointmentId(item.id);
                      }}
                      type="button"
                    >
                      Cancelar cita
                    </button>
                  </>
                )}
              </div>

              {cancellingAppointmentId === item.id && (
                <div
                  className="bg-background basis-full rounded-xl border border-white/10 p-4 text-left"
                  id={`cancel-appointment-${item.id}`}
                >
                  <label
                    className="text-sm font-semibold"
                    htmlFor={`cancellation-reason-${item.id}`}
                  >
                    Motivo de cancelación (opcional)
                  </label>
                  <input
                    className="bg-surface focus:border-primary mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-sm outline-none"
                    id={`cancellation-reason-${item.id}`}
                    maxLength={500}
                    onChange={(event) =>
                      setCancellationReason(event.target.value)
                    }
                    placeholder="Ej. Cambio de planes"
                    value={cancellationReason}
                  />
                  <p className="text-muted mt-2 text-xs">
                    Si indicas un motivo, debe tener al menos 3 caracteres.
                  </p>
                  {cancelAppointment.isError && (
                    <p className="text-primary mt-3 text-sm" role="alert">
                      No fue posible cancelar la cita. Actualiza la agenda e
                      inténtalo nuevamente.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="bg-primary rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                      disabled={
                        cancelAppointment.isPending ||
                        isInvalidCancellationReason(cancellationReason)
                      }
                      onClick={() => {
                        const reason = cancellationReason.trim();
                        cancelAppointment.mutate({
                          appointmentId: item.id,
                          ...(reason && { reason }),
                        });
                      }}
                      type="button"
                    >
                      {cancelAppointment.isPending
                        ? 'Cancelando…'
                        : 'Confirmar cancelación'}
                    </button>
                    <button
                      className="text-muted hover:text-foreground rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold"
                      disabled={cancelAppointment.isPending}
                      onClick={() => {
                        cancelAppointment.reset();
                        setCancellationReason('');
                        setCancellingAppointmentId(null);
                      }}
                      type="button"
                    >
                      Conservar cita
                    </button>
                  </div>
                </div>
              )}
              {reschedulingAppointmentId === item.id && (
                <div className="bg-background basis-full rounded-xl border border-white/10 p-4 text-left">
                  <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                    <AppointmentCalendar
                      maxDate={getMaxBookableDate()}
                      minDate={getToday()}
                      onChange={(nextDate) => {
                        setRescheduleDate(nextDate);
                        setRescheduleSlot('');
                      }}
                      value={rescheduleDate}
                    />
                    <div>
                      <h3 className="text-sm font-bold">Nuevo horario</h3>
                      <p className="text-muted mt-1 text-xs">
                        La cita volverá a estado pendiente de confirmación.
                      </p>
                      {rescheduleAvailability.isFetching ? (
                        <p className="text-muted mt-5 text-sm">
                          Buscando horarios…
                        </p>
                      ) : (
                        <div className="mt-4">
                          <TimeSlotGroup
                            label="Disponibles"
                            onSelect={setRescheduleSlot}
                            selectedSlot={rescheduleSlot}
                            slots={rescheduleAvailability.data ?? []}
                          />
                        </div>
                      )}
                      {!rescheduleAvailability.isFetching &&
                        rescheduleAvailability.data?.length === 0 && (
                          <p className="text-muted mt-5 text-sm">
                            No hay horarios disponibles para este día.
                          </p>
                        )}
                      {rescheduleAppointment.isError && (
                        <p className="mt-4 text-sm text-red-400" role="alert">
                          El horario dejó de estar disponible. Selecciona otro.
                        </p>
                      )}
                      <div className="mt-5 flex gap-2">
                        <button
                          className="bg-primary rounded-lg px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                          disabled={
                            !rescheduleSlot || rescheduleAppointment.isPending
                          }
                          onClick={() =>
                            rescheduleAppointment.mutate({
                              appointmentId: item.id,
                              startsAt: rescheduleSlot,
                            })
                          }
                          type="button"
                        >
                          {rescheduleAppointment.isPending
                            ? 'Reprogramando…'
                            : 'Confirmar cambio'}
                        </button>
                        <button
                          className="text-muted rounded-lg border border-white/10 px-4 py-2 text-xs"
                          onClick={() => setReschedulingAppointmentId(null)}
                          type="button"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function isCustomerCancellable(appointment: Appointment): boolean {
  return (
    (appointment.status === 'requested' ||
      appointment.status === 'confirmed') &&
    new Date(appointment.startsAt).getTime() > Date.now()
  );
}

function isInvalidCancellationReason(reason: string): boolean {
  const length = reason.trim().length;
  return length > 0 && length < 3;
}
