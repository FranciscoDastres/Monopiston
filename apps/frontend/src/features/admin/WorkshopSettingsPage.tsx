import type { BusinessHour, ScheduleException } from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { PageHeader } from '../../components/ui/PageHeader';
import { apiClient } from '../../lib/api-client';

const weekdays = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
const fieldClass =
  'rounded-lg border border-white/10 bg-background px-3 py-2.5 text-sm outline-none focus:border-accent';

export function WorkshopSettingsPage() {
  const queryClient = useQueryClient();
  const [weekday, setWeekday] = useState(1);
  const [opensAt, setOpensAt] = useState('09:30');
  const [closesAt, setClosesAt] = useState('14:00');
  const [exceptionStart, setExceptionStart] = useState('');
  const [exceptionEnd, setExceptionEnd] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');

  const hours = useQuery({
    queryFn: () => apiClient.get<BusinessHour[]>('/v1/admin/workshop/hours'),
    queryKey: ['admin', 'workshop', 'hours'],
  });
  const exceptions = useQuery({
    queryFn: () =>
      apiClient.get<ScheduleException[]>('/v1/admin/workshop/exceptions'),
    queryKey: ['admin', 'workshop', 'exceptions'],
  });

  const saveHour = useMutation({
    mutationFn: () =>
      apiClient.post('/v1/admin/workshop/hours', {
        closesAt,
        opensAt,
        slotMinutes: 45,
        validFrom: new Date().toISOString().slice(0, 10),
        weekday,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'workshop', 'hours'],
      }),
  });
  const deleteHour = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/v1/admin/workshop/hours/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'workshop', 'hours'],
      }),
  });
  const createException = useMutation({
    mutationFn: () =>
      apiClient.post('/v1/admin/workshop/exceptions', {
        endsAt: new Date(exceptionEnd).toISOString(),
        kind: 'closed',
        reason: exceptionReason || undefined,
        startsAt: new Date(exceptionStart).toISOString(),
      }),
    onSuccess: async () => {
      setExceptionEnd('');
      setExceptionReason('');
      setExceptionStart('');
      await queryClient.invalidateQueries({
        queryKey: ['admin', 'workshop', 'exceptions'],
      });
    },
  });
  const deleteException = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/v1/admin/workshop/exceptions/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin', 'workshop', 'exceptions'],
      }),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Administración"
        subtitle="Gestiona el horario habitual y los cierres especiales del taller."
        title="Configuración"
      />

      <div className="grid items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-surface rounded-2xl border border-white/8 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
              <Icon className="size-5" name="clock" />
            </span>
            <div>
              <h2 className="text-base font-bold">Horario semanal</h2>
              <p className="text-muted mt-0.5 text-xs">
                Intervalos disponibles para reservas
              </p>
            </div>
          </div>
          <p className="text-muted mt-2 text-sm">
            Los inicios se ofrecen cada 45 minutos. Registra 09:30–14:00 y
            15:00–18:00 para mantener la hora de colación bloqueada.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <select
              aria-label="Día de la semana"
              className={fieldClass}
              onChange={(event) => setWeekday(Number(event.target.value))}
              value={weekday}
            >
              {weekdays.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
            <input
              aria-label="Hora de apertura"
              className={fieldClass}
              onChange={(event) => setOpensAt(event.target.value)}
              type="time"
              value={opensAt}
            />
            <input
              aria-label="Hora de cierre"
              className={fieldClass}
              onChange={(event) => setClosesAt(event.target.value)}
              type="time"
              value={closesAt}
            />
            <Button
              loading={saveHour.isPending}
              onClick={() => saveHour.mutate()}
              size="sm"
            >
              Guardar intervalo
            </Button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hours.data?.map((hour) => (
              <div
                className="bg-background/50 flex items-center justify-between gap-3 rounded-xl border border-white/8 p-3.5"
                key={hour.id}
              >
                <div>
                  <p className="text-sm font-semibold">
                    {weekdays[hour.weekday]}
                  </p>
                  <p className="text-muted mt-1 text-xs">
                    {hour.opensAt}–{hour.closesAt} · cada {hour.slotMinutes} min
                  </p>
                </div>
                <button
                  aria-label={`Eliminar horario de ${weekdays[hour.weekday]}`}
                  className="text-muted hover:bg-primary/10 hover:text-primary grid size-8 place-items-center rounded-lg"
                  onClick={() => deleteHour.mutate(hour.id)}
                  type="button"
                >
                  <Icon className="size-4" name="trash" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-surface rounded-2xl border border-white/8 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="bg-warning/10 text-warning grid size-10 place-items-center rounded-xl">
              <Icon className="size-5" name="calendar" />
            </span>
            <div>
              <h2 className="text-base font-bold">Cierres y excepciones</h2>
              <p className="text-muted mt-0.5 text-xs">
                Bloqueos fuera del horario habitual
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <input
              aria-label="Inicio del cierre"
              className={fieldClass}
              onChange={(event) => setExceptionStart(event.target.value)}
              type="datetime-local"
              value={exceptionStart}
            />
            <input
              aria-label="Fin del cierre"
              className={fieldClass}
              onChange={(event) => setExceptionEnd(event.target.value)}
              type="datetime-local"
              value={exceptionEnd}
            />
            <input
              aria-label="Motivo del cierre"
              className={fieldClass}
              onChange={(event) => setExceptionReason(event.target.value)}
              placeholder="Motivo"
              value={exceptionReason}
            />
            <Button
              disabled={
                !exceptionStart || !exceptionEnd || createException.isPending
              }
              loading={createException.isPending}
              onClick={() => createException.mutate()}
            >
              Registrar cierre
            </Button>
          </div>
          <div className="mt-6 space-y-3">
            {exceptions.data?.map((exception) => (
              <div
                className="bg-background/50 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/8 p-3.5"
                key={exception.id}
              >
                <div>
                  <p className="font-semibold">
                    {exception.reason ?? 'Cierre del taller'}
                  </p>
                  <p className="text-muted mt-1 text-xs">
                    {new Date(exception.startsAt).toLocaleString('es-CL')} →{' '}
                    {new Date(exception.endsAt).toLocaleString('es-CL')}
                  </p>
                </div>
                <button
                  aria-label={`Eliminar cierre ${exception.reason ?? 'del taller'}`}
                  className="text-muted hover:bg-primary/10 hover:text-primary grid size-8 place-items-center rounded-lg"
                  onClick={() => deleteException.mutate(exception.id)}
                  type="button"
                >
                  <Icon className="size-4" name="trash" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
