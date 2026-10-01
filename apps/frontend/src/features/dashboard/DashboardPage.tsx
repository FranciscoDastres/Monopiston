import type { CustomerDashboard } from '@monopiston/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Icon, type IconName } from '../../components/ui/Icon';
import {
  APPOINTMENT_STATUS_META,
  PROGRESS_STATUS_META,
} from '../../components/ui/status-meta';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'long',
  hourCycle: 'h23',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
});

export function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useQuery({
    queryFn: () => apiClient.get<CustomerDashboard>('/v1/customer/dashboard'),
    queryKey: ['customer', 'dashboard'],
  });

  if (dashboard.isLoading) return <DashboardSkeleton />;
  if (!dashboard.data) {
    return <p className="text-muted">No pudimos cargar tu resumen.</p>;
  }

  const data = dashboard.data;
  const active = data.activeAppointment;
  const status = active ? APPOINTMENT_STATUS_META[active.status] : null;
  const progress = data.latestProgress
    ? PROGRESS_STATUS_META[data.latestProgress.progressStatus]
    : null;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-primary text-xs font-bold tracking-[0.18em] uppercase">
          Mi NAVI
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Hola, {user?.displayName.split(' ')[0]}
        </h1>
        <p className="text-muted mt-2 text-sm">
          Todo lo importante sobre tu moto, en un solo lugar.
        </p>
      </header>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,41,72,.16),rgba(14,19,26,.92)_48%)] p-5 sm:p-7">
        <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-red-500/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted text-xs font-semibold tracking-widest uppercase">
                Estado actual
              </span>
              <Badge tone={status?.tone ?? 'neutral'}>
                {active ? status?.label : 'Fuera del taller'}
              </Badge>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight normal-case sm:text-3xl">
              {active
                ? active.motorcycle.label
                : 'Tu Honda NAVI está lista para rodar'}
            </h2>
            <p className="text-muted mt-2 max-w-xl text-sm leading-6">
              {data.latestProgress?.message ??
                (progress
                  ? progress.label
                  : 'Agenda tu próxima mantención cuando la necesites.')}
            </p>
            {active && (
              <Link
                className="text-primary mt-5 inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase"
                to={`/app/appointments/${active.id}`}
              >
                Ver seguimiento <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
          <div className="border-primary/25 bg-primary/10 grid size-28 place-items-center rounded-full border shadow-[0_0_55px_rgba(230,0,35,.16)]">
            <Icon
              className="text-primary size-12"
              name={active?.status === 'ready' ? 'check' : 'bike'}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="text-muted text-[0.65rem] font-semibold tracking-widest uppercase">
            Próxima cita
          </p>
          {data.nextAppointment ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <p className="font-semibold">
                  {dateFormatter.format(
                    new Date(data.nextAppointment.startsAt),
                  )}
                </p>
                <Badge
                  tone={
                    APPOINTMENT_STATUS_META[data.nextAppointment.status].tone
                  }
                >
                  {APPOINTMENT_STATUS_META[data.nextAppointment.status].label}
                </Badge>
              </div>
              <p className="text-muted mt-2 text-xs">
                {data.nextAppointment.services
                  .map((service) => service.name)
                  .join(', ')}
              </p>
            </>
          ) : (
            <p className="text-muted mt-3 text-sm">
              No tienes citas programadas.
            </p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-muted text-[0.65rem] font-semibold tracking-widest uppercase">
            Próximo mantenimiento
          </p>
          {data.nextMaintenance ? (
            <>
              <p className="mt-3 font-semibold">{data.nextMaintenance.title}</p>
              <p className="text-muted mt-2 text-xs leading-5">
                {formatRecommendationDue(data.nextMaintenance)}
              </p>
            </>
          ) : (
            <p className="text-muted mt-3 text-sm">
              Sin recomendaciones pendientes.
            </p>
          )}
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold tracking-wide uppercase">
          Acciones rápidas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            icon="calendar"
            label="Agendar nueva cita"
            to="/app/appointments"
          />
          <QuickLink
            badge={data.unpaidInvoices || undefined}
            icon="receipt"
            label="Ver mis boletas"
            to="/app/billing"
          />
          <QuickLink
            icon="history"
            label="Historial de atenciones"
            to="/app/history"
          />
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  badge,
  icon,
  label,
  to,
}: {
  badge?: number | undefined;
  icon: IconName;
  label: string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="flex items-center justify-between gap-3 p-4" interactive>
        <span className="flex items-center gap-3">
          <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-xl">
            <Icon name={icon} />
          </span>
          <span className="text-sm font-bold">{label}</span>
        </span>
        {badge ? (
          <Badge tone="warning">{badge}</Badge>
        ) : (
          <span className="text-muted">→</span>
        )}
      </Card>
    </Link>
  );
}

function formatRecommendationDue(
  item: CustomerDashboard['nextMaintenance'],
): string {
  if (!item) return '';
  const parts = [item.description];
  if (item.dueAt)
    parts.push(
      `Recomendado para ${new Date(item.dueAt).toLocaleDateString('es-CL')}`,
    );
  if (item.dueOdometerKm)
    parts.push(`A los ${item.dueOdometerKm.toLocaleString('es-CL')} km`);
  return parts.join(' · ');
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-64 animate-pulse rounded-3xl bg-white/5" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
