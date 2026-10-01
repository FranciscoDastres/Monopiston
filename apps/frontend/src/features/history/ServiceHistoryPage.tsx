import type { ServiceHistoryRecord } from '@monopiston/contracts';
import * as Accordion from '@radix-ui/react-accordion';
import { useQuery } from '@tanstack/react-query';

import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { formatCLP } from '../../components/ui/money';
import { PageHeader } from '../../components/ui/PageHeader';
import { PROGRESS_STATUS_META } from '../../components/ui/status-meta';
import { apiClient } from '../../lib/api-client';

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'long',
  timeZone: 'America/Santiago',
});

export function ServiceHistoryPage() {
  const history = useQuery({
    queryFn: () =>
      apiClient.get<ServiceHistoryRecord[]>('/v1/customer/history'),
    queryKey: ['customer', 'history'],
  });

  return (
    <div>
      <PageHeader
        eyebrow="Mi NAVI"
        subtitle="Detalle técnico de cada atención y recomendaciones para mantener tu moto al día."
        title="Historial de atenciones"
      />
      {history.isLoading ? (
        <div className="h-72 animate-pulse rounded-2xl bg-white/5" />
      ) : !history.data?.length ? (
        <EmptyState
          icon="history"
          title="Aún no hay atenciones finalizadas"
          description="Cuando el taller finalice un servicio, su informe aparecerá aquí."
        />
      ) : (
        <Accordion.Root className="space-y-3" collapsible type="single">
          {history.data.map((record, index) => (
            <Accordion.Item
              className="bg-surface overflow-hidden rounded-2xl border border-white/8"
              key={record.appointmentId}
              value={record.appointmentId}
            >
              <Accordion.Header>
                <Accordion.Trigger className="group flex w-full items-center gap-4 p-4 text-left sm:p-5">
                  <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
                    <Icon className="size-5" name="tool" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {record.services.join(', ')}
                    </span>
                    <span className="text-muted mt-1 block text-xs">
                      {dateFormatter.format(new Date(record.completedAt))} ·{' '}
                      {record.motorcycleLabel}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatCLP(record.total)}
                  </span>
                  <span className="text-muted transition group-data-[state=open]:rotate-90">
                    ›
                  </span>
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="border-t border-white/8">
                <div className="p-4 sm:p-5">
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                    <p className="text-muted text-[0.65rem] font-bold tracking-widest uppercase">
                      Resumen técnico
                    </p>
                    <p className="mt-2 text-sm leading-6">
                      {record.technicalSummary}
                    </p>
                  </div>
                  <div className="mt-5 grid gap-5 xl:grid-cols-3">
                    <WorkList
                      items={record.workPerformed}
                      title="Trabajo realizado"
                      tone="success"
                    />
                    <ProgressTimeline record={record} />
                    <RecommendationList record={record} />
                  </div>
                  {index === 0 && (
                    <p className="text-muted mt-5 text-xs">
                      Esta es tu atención más reciente.
                    </p>
                  )}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      )}
    </div>
  );
}

function WorkList({
  items,
  title,
  tone,
}: {
  items: ServiceHistoryRecord['workPerformed'];
  title: string;
  tone: 'success' | 'warning';
}) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
        <span
          className={`size-2 rounded-full ${tone === 'success' ? 'bg-success' : 'bg-warning'}`}
        />
        {title}
      </h2>
      {items.length ? (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li className="rounded-xl border border-white/8 p-3" key={item.id}>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-muted mt-1 text-xs leading-5">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted mt-3 text-xs">Sin elementos.</p>
      )}
    </section>
  );
}

function ProgressTimeline({ record }: { record: ServiceHistoryRecord }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
        <span className="bg-primary size-2 rounded-full" />
        Progreso
      </h2>
      {record.progress.length ? (
        <ol className="mt-3 space-y-3">
          {record.progress.map((update) => {
            const meta = PROGRESS_STATUS_META[update.progressStatus];
            return (
              <li className="border-primary/30 border-l pl-3" key={update.id}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <Badge tone={meta.tone}>Avance</Badge>
                </div>
                {update.message && (
                  <p className="text-muted mt-1 text-xs leading-5">
                    {update.message}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-muted mt-3 text-xs">
          La atención no registró eventos públicos.
        </p>
      )}
    </section>
  );
}

function RecommendationList({ record }: { record: ServiceHistoryRecord }) {
  const items = [
    ...record.workPending.map((item) => ({
      ...item,
      dueAt: null,
      dueOdometerKm: null,
      severity: 'warning' as const,
    })),
    ...record.recommendations,
  ];
  return (
    <section>
      <h2 className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
        <span className="bg-warning size-2 rounded-full" />
        Pendiente y futuro
      </h2>
      {items.length ? (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li
              className="border-warning/15 bg-warning/[0.035] rounded-xl border p-3"
              key={item.id}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{item.title}</p>
                <Badge
                  tone={item.severity === 'critical' ? 'danger' : 'warning'}
                >
                  {item.severity === 'critical' ? 'Prioritario' : 'Recomendado'}
                </Badge>
              </div>
              <p className="text-muted mt-1 text-xs leading-5">
                {item.description}
              </p>
              {(item.dueAt || item.dueOdometerKm) && (
                <p className="text-warning mt-2 text-[0.68rem] font-semibold">
                  {item.dueAt
                    ? new Date(item.dueAt).toLocaleDateString('es-CL')
                    : ''}
                  {item.dueAt && item.dueOdometerKm ? ' · ' : ''}
                  {item.dueOdometerKm
                    ? `${item.dueOdometerKm.toLocaleString('es-CL')} km`
                    : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted mt-3 text-xs">
          No quedan trabajos ni recomendaciones pendientes.
        </p>
      )}
    </section>
  );
}
