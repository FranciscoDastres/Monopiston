import type { AppointmentTimeline } from '@monopiston/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { Badge } from '../../components/ui/Badge';
import {
  APPOINTMENT_STATUS_META,
  PROGRESS_STATUS_META,
} from '../../components/ui/status-meta';
import { Card } from '../../components/ui/Card';
import { formatCLP } from '../../components/ui/money';
import { apiClient } from '../../lib/api-client';

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'long',
  year: 'numeric',
});

export function AppointmentTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const timeline = useQuery({
    enabled: Boolean(id),
    queryFn: () =>
      apiClient.get<AppointmentTimeline>(`/v1/appointments/${id}/timeline`),
    queryKey: ['appointments', id, 'timeline'],
  });

  if (timeline.isLoading)
    return <p className="text-muted animate-pulse">Cargando avance…</p>;
  if (!timeline.data) {
    return (
      <div>
        <p className="text-primary">No fue posible encontrar esta cita.</p>
        <Link
          className="text-accent mt-4 inline-block text-sm"
          to="/app/appointments"
        >
          Volver a agenda
        </Link>
      </div>
    );
  }

  const { appointment, updates } = timeline.data;
  const statusMeta = APPOINTMENT_STATUS_META[appointment.status];

  return (
    <div className="max-w-4xl">
      <Link
        className="text-accent text-sm font-semibold"
        to="/app/appointments"
      >
        ← Volver a agenda
      </Link>
      <p className="text-accent mt-6 text-xs font-semibold tracking-[0.12em] uppercase">
        Seguimiento de servicio
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          {appointment.motorcycle.label}
        </h1>
        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
      </div>
      <p className="text-muted mt-2">
        Ingreso agendado ·{' '}
        {dateFormatter.format(new Date(appointment.startsAt))}
      </p>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="p-6">
          <h2 className="font-display text-sm font-bold tracking-wide text-white uppercase">
            Avance de tu moto
          </h2>
          {updates.length === 0 ? (
            <p className="text-muted py-8 text-center text-sm">
              El taller publicará aquí los avances de tu moto.
            </p>
          ) : (
            <ol className="mt-6 space-y-0">
              {updates.map((update, index) => {
                const meta = PROGRESS_STATUS_META[update.progressStatus];
                return (
                  <li
                    className="relative grid grid-cols-[24px_1fr] gap-4 pb-7 last:pb-0"
                    key={update.id}
                  >
                    {index < updates.length - 1 && (
                      <span className="absolute top-5 bottom-0 left-[11px] w-px bg-white/10" />
                    )}
                    <span className="border-surface bg-accent relative z-10 mt-1 size-6 rounded-full border-4" />
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-bold">{meta.label}</h3>
                        <time className="text-muted text-xs">
                          {dateFormatter.format(new Date(update.createdAt))}
                        </time>
                      </div>
                      {update.message && (
                        <p className="text-muted mt-2 leading-7">
                          {update.message}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card className="h-fit p-6">
          <h2 className="font-display text-sm font-bold tracking-wide text-white uppercase">
            Resumen del pedido
          </h2>
          <ul className="mt-4 space-y-3">
            {appointment.services.map((service) => (
              <li
                className="flex items-baseline justify-between gap-3 text-sm"
                key={service.id}
              >
                <span className="text-foreground">{service.name}</span>
                <span className="text-muted shrink-0 tabular-nums">
                  {formatCLP(service.unitPrice)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
            <span className="font-display text-sm font-bold tracking-wide text-white uppercase">
              Total
            </span>
            <span className="font-display text-primary text-xl font-extrabold tabular-nums">
              {formatCLP(appointment.total)}
            </span>
          </div>
          <p className="text-muted mt-3 text-xs">
            Valores referenciales de la mantención de tu Honda NAVI al momento
            de agendar.
          </p>
        </Card>
      </div>
    </div>
  );
}
