import type { AdminAppointment, AdminMetrics } from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon, type IconName } from '../../components/ui/Icon';
import { formatCLP } from '../../components/ui/money';
import { apiClient } from '../../lib/api-client';

import { RevenueAreaChart, StatusDonutChart } from './DashboardCharts';

const RANGE_OPTIONS = [7, 30, 90] as const;
const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Pendientes de pago',
  cancelled: 'Canceladas',
  checked_in: 'Recibidas',
  completed: 'Completadas',
  confirmed: 'Confirmadas',
  in_service: 'En servicio',
  no_show: 'No asistió',
  ready: 'Listas',
  requested: 'Solicitadas',
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const appointmentFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  timeZone: 'America/Santiago',
});

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [rangeDays, setRangeDays] =
    useState<(typeof RANGE_OPTIONS)[number]>(30);
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (rangeDays - 1));
    return { from: isoDate(from), to: isoDate(to) };
  }, [rangeDays]);

  const metricsQuery = useQuery({
    queryFn: () =>
      apiClient.get<AdminMetrics>(
        `/v1/admin/metrics?from=${range.from}&to=${range.to}`,
      ),
    queryKey: ['admin', 'metrics', range.from, range.to],
  });
  const pendingQuery = useQuery({
    queryFn: () => {
      const end = new Date();
      end.setDate(end.getDate() + 30);
      return apiClient.get<AdminAppointment[]>(
        `/v1/admin/appointments?from=${isoDate(new Date())}&to=${isoDate(end)}&statuses=requested`,
      );
    },
    queryKey: ['admin', 'pending-requests'],
  });
  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/v1/admin/appointments/${id}/status`, {
        status: 'confirmed',
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'pending-requests'],
        }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] }),
      ]);
    },
  });

  const metrics = metricsQuery.data;
  const revenueData = (metrics?.revenueByDay ?? []).map((point) => ({
    date: point.date.slice(5),
    ingresos: point.total,
  }));
  const statusData = Object.entries(metrics?.appointmentsByStatus ?? {})
    .filter(([, value]) => value > 0)
    .map(([status, value]) => ({
      name: STATUS_LABELS[status] ?? status,
      value,
    }));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-primary text-xs font-bold tracking-[0.18em] uppercase">
            Centro de operaciones
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-muted mt-2 text-sm">
            Rendimiento del taller y actividad en tiempo real.
          </p>
        </div>
        <div
          aria-label="Período del dashboard"
          className="bg-surface flex rounded-xl border border-white/8 p-1"
          role="group"
        >
          {RANGE_OPTIONS.map((days) => (
            <button
              aria-pressed={rangeDays === days}
              className={`rounded-lg px-3 py-2 text-xs font-bold transition ${
                rangeDays === days
                  ? 'bg-primary text-white shadow-lg shadow-red-950/30'
                  : 'text-muted hover:text-foreground'
              }`}
              key={days}
              onClick={() => setRangeDays(days)}
              type="button"
            >
              {days} días
            </button>
          ))}
        </div>
      </header>

      {metricsQuery.isError ? (
        <p className="border-primary/30 bg-primary/10 rounded-xl border p-4 text-sm">
          No fue posible cargar las métricas del taller.
        </p>
      ) : metricsQuery.isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="bg-surface grid overflow-hidden rounded-2xl border border-white/8 sm:grid-cols-2 xl:grid-cols-5">
            <Metric
              icon="wallet"
              label="Ingresos"
              value={formatCLP(metrics?.totalRevenue ?? 0)}
            />
            <Metric
              icon="check"
              label="Completadas"
              value={metrics?.completedCount ?? 0}
            />
            <Metric
              icon="chart"
              label="Ticket promedio"
              value={formatCLP(metrics?.averageTicket ?? 0)}
            />
            <Metric
              icon="users"
              label="Usuarios nuevos"
              value={metrics?.newUsersCount ?? 0}
            />
            <Metric
              accent
              icon="clock"
              label="Por confirmar"
              value={metrics?.pendingRequests ?? 0}
            />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <Card className="p-5 sm:p-6">
              <div>
                <h2 className="text-sm font-bold">Evolución de ingresos</h2>
                <p className="text-muted mt-1 text-xs">
                  Servicios completados en el período
                </p>
              </div>
              <RevenueAreaChart data={revenueData} />
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-sm font-bold">Distribución de citas</h2>
              <p className="text-muted mt-1 text-xs">
                Estados operativos del período
              </p>
              {statusData.length ? (
                <StatusDonutChart data={statusData} />
              ) : (
                <p className="text-muted mt-8 text-sm">
                  Sin citas en este período.
                </p>
              )}
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold">Próximas solicitudes</h2>
                  <p className="text-muted mt-1 text-xs">
                    Reservas que requieren confirmación
                  </p>
                </div>
                <Badge tone={pendingQuery.data?.length ? 'warning' : 'success'}>
                  {pendingQuery.data?.length ?? 0}
                </Badge>
              </div>
              {!pendingQuery.data?.length ? (
                <div className="mt-5">
                  <EmptyState
                    icon="calendar"
                    title="Todo al día"
                    description="No hay solicitudes pendientes."
                  />
                </div>
              ) : (
                <div className="mt-4 divide-y divide-white/8">
                  {pendingQuery.data.slice(0, 5).map((appointment) => (
                    <div
                      className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center"
                      key={appointment.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {appointment.customer.displayName}
                        </p>
                        <p className="text-muted mt-1 truncate text-xs">
                          {appointmentFormatter.format(
                            new Date(appointment.startsAt),
                          )}{' '}
                          ·{' '}
                          {appointment.services
                            .map((service) => service.name)
                            .join(', ')}
                        </p>
                      </div>
                      <Button
                        disabled={confirmMutation.isPending}
                        icon="check"
                        onClick={() => confirmMutation.mutate(appointment.id)}
                        size="sm"
                      >
                        Confirmar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-sm font-bold">Ingresos por servicio</h2>
              <div className="mt-5 space-y-4">
                {(metrics?.revenueByService ?? []).map((service) => (
                  <div key={service.name}>
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="truncate">{service.name}</span>
                      <span className="text-muted shrink-0 tabular-nums">
                        {formatCLP(service.total)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="from-primary to-accent h-full rounded-full bg-gradient-to-r"
                        style={{
                          width: `${Math.max((service.total / Math.max(metrics?.totalRevenue ?? 1, 1)) * 100, 3)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({
  accent = false,
  icon,
  label,
  value,
}: {
  accent?: boolean;
  icon: IconName;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-white/8 p-4 not-last:border-b sm:odd:border-r xl:border-r xl:border-b-0">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${accent ? 'bg-primary/15 text-primary' : 'text-muted bg-white/5'}`}
      >
        <Icon className="size-4" name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-muted truncate text-[0.64rem] font-semibold tracking-[0.1em] uppercase">
          {label}
        </p>
        <p
          className={`mt-1 truncate text-xl font-bold tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Cargando dashboard">
      <div className="bg-surface h-24 animate-pulse rounded-2xl border border-white/8" />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="bg-surface h-96 animate-pulse rounded-2xl border border-white/8" />
        <div className="bg-surface h-96 animate-pulse rounded-2xl border border-white/8" />
      </div>
    </div>
  );
}
