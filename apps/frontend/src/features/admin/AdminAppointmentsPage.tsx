import type { AdminAppointment, Appointment } from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import {
  AGENDA_BUCKET_LABEL,
  AGENDA_BUCKET_OF,
  type AgendaBucket,
} from '../../components/ui/status-meta';
import { apiClient } from '../../lib/api-client';
import { AdminAppointmentCard } from './AdminAppointmentCard';
import {
  addDays,
  type AgendaView,
  formatAgendaRange,
  getAgendaRange,
  getWorkshopToday,
} from './agenda-dates';
import { CompleteWorkModal } from './CompleteWorkModal';

const AGENDA_BUCKETS: AgendaBucket[] = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
];

export function AdminAppointmentsPage() {
  const queryClient = useQueryClient();
  const [agendaView, setAgendaView] = useState<AgendaView>('day');
  const [bucket, setBucket] = useState<AgendaBucket>('pending');
  const [selectedDate, setSelectedDate] = useState(getWorkshopToday());
  const [closingAppointment, setClosingAppointment] =
    useState<AdminAppointment | null>(null);
  const range = getAgendaRange(selectedDate, agendaView);

  const appointments = useQuery({
    queryFn: () =>
      apiClient.get<AdminAppointment[]>(
        `/v1/admin/appointments?from=${range.from}&to=${range.to}`,
      ),
    queryKey: ['admin', 'appointments', range.from, range.to],
  });
  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: Appointment['status'];
    }) =>
      apiClient.patch<Appointment>(`/v1/admin/appointments/${id}/status`, {
        status,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] }),
        queryClient.invalidateQueries({
          queryKey: ['admin', 'pending-requests'],
        }),
      ]);
    },
  });

  return (
    <div>
      <PageHeader
        actions={
          <Badge tone="primary">
            {appointments.data?.length ?? 0}{' '}
            {appointments.data?.length === 1 ? 'cita' : 'citas'}
          </Badge>
        }
        eyebrow="Administración"
        subtitle="Confirma o cancela reservas y contacta al cliente directamente."
        title="Agenda del taller"
      />

      <section
        aria-label="Controles de agenda"
        className="bg-surface mb-5 rounded-2xl border border-white/8 p-3 sm:p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            aria-label="Vista de agenda"
            className="bg-background flex rounded-lg border border-white/8 p-1"
            role="group"
          >
            {(['day', 'week'] as const).map((view) => (
              <button
                aria-pressed={agendaView === view}
                className={`rounded-md px-4 py-2 text-xs font-bold transition ${agendaView === view ? 'bg-primary text-white' : 'text-muted hover:text-foreground'}`}
                key={view}
                onClick={() => setAgendaView(view)}
                type="button"
              >
                {view === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              aria-label={
                agendaView === 'day' ? 'Día anterior' : 'Semana anterior'
              }
              onClick={() =>
                setSelectedDate((current) =>
                  addDays(current, agendaView === 'day' ? -1 : -7),
                )
              }
              size="sm"
              variant="ghost"
            >
              ←
            </Button>
            <input
              aria-label="Fecha de agenda"
              className="bg-background focus:border-accent rounded-lg border border-white/10 px-3 py-2 text-sm outline-none"
              onChange={(event) => setSelectedDate(event.target.value)}
              type="date"
              value={selectedDate}
            />
            <Button
              aria-label={
                agendaView === 'day' ? 'Día siguiente' : 'Semana siguiente'
              }
              onClick={() =>
                setSelectedDate((current) =>
                  addDays(current, agendaView === 'day' ? 1 : 7),
                )
              }
              size="sm"
              variant="ghost"
            >
              →
            </Button>
            <Button
              onClick={() => setSelectedDate(getWorkshopToday())}
              size="sm"
              variant="secondary"
            >
              Hoy
            </Button>
          </div>
        </div>
        <p className="text-muted mt-3 text-xs font-semibold capitalize">
          {formatAgendaRange(range, agendaView)}
        </p>
      </section>

      <div
        aria-label="Secciones de la agenda"
        className="mb-5 flex flex-wrap gap-2"
        role="group"
      >
        {AGENDA_BUCKETS.map((item) => {
          const count =
            appointments.data?.filter(
              (appointment) => AGENDA_BUCKET_OF[appointment.status] === item,
            ).length ?? 0;
          return (
            <button
              aria-pressed={bucket === item}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${bucket === item ? 'bg-primary text-white' : 'bg-surface text-muted hover:text-foreground border border-white/8'}`}
              key={item}
              onClick={() => setBucket(item)}
              type="button"
            >
              {AGENDA_BUCKET_LABEL[item]} ({count})
            </button>
          );
        })}
      </div>

      {appointments.isError && (
        <p className="border-primary/30 bg-primary/10 rounded-xl border p-4 text-sm">
          No fue posible cargar la agenda.
        </p>
      )}
      {appointments.isLoading && (
        <div className="bg-surface h-64 animate-pulse rounded-2xl border border-white/8" />
      )}
      {!appointments.isLoading && appointments.data?.length === 0 && (
        <EmptyState
          icon="calendar"
          title="No hay citas en este periodo"
          description="Cambia la fecha o selecciona la vista semanal."
        />
      )}

      <div className="space-y-3">
        {appointments.data
          ?.filter(
            (appointment) => AGENDA_BUCKET_OF[appointment.status] === bucket,
          )
          .map((appointment) => (
            <AdminAppointmentCard
              appointment={appointment}
              key={appointment.id}
              onRegisterWork={setClosingAppointment}
              onUpdateStatus={(id, status) =>
                statusMutation.mutate({ id, status })
              }
              statusPending={statusMutation.isPending}
            />
          ))}
      </div>

      {statusMutation.isError && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          La cita cambió de estado y no pudo actualizarse. Recarga la agenda.
        </p>
      )}

      {closingAppointment && (
        <CompleteWorkModal
          appointment={closingAppointment}
          key={closingAppointment.id}
          onClose={() => setClosingAppointment(null)}
        />
      )}
    </div>
  );
}
