import type { CustomerMotorcycleUpdate } from '@monopiston/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { Badge } from '../../components/ui/Badge';
import { PROGRESS_STATUS_META } from '../../components/ui/status-meta';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { apiClient } from '../../lib/api-client';

const progressLabels: Record<
  CustomerMotorcycleUpdate['progressStatus'],
  string
> = {
  delivered: 'Tu moto fue entregada',
  diagnosing: 'Comenzó el diagnóstico',
  quality_check: 'Entró a control de calidad',
  ready_for_pickup: 'Tu moto está lista para retiro',
  received: 'El taller recibió tu moto',
  repairing: 'Comenzó la reparación',
  waiting_approval: 'El taller espera tu aprobación',
};

export function NotificationsPage() {
  const query = useQuery({
    queryFn: () =>
      apiClient.get<CustomerMotorcycleUpdate[]>('/v1/notifications'),
    queryKey: ['notifications'],
    refetchInterval: 60_000,
  });

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Novedades"
        subtitle="Los últimos avances publicados por el equipo del taller."
        title="Actualizaciones de tus motos"
      />

      {!query.isLoading && query.data?.length === 0 && (
        <EmptyState
          icon="spark"
          title="Todavía no hay novedades"
          description="Las actualizaciones aparecerán cuando una moto ingrese al taller."
        />
      )}

      <div className="space-y-3">
        {query.data?.map((update) => (
          <Link
            className="bg-surface hover:border-accent/40 block rounded-2xl border border-white/10 p-5 transition"
            key={update.id}
            to={`/app/appointments/${update.appointmentId}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-accent text-xs font-semibold">
                    {update.motorcycleLabel}
                  </p>
                  <Badge
                    tone={PROGRESS_STATUS_META[update.progressStatus].tone}
                  >
                    {PROGRESS_STATUS_META[update.progressStatus].label}
                  </Badge>
                </div>
                <h2 className="mt-2 font-bold">
                  {progressLabels[update.progressStatus]}
                </h2>
                {update.message && (
                  <p className="text-muted mt-2 text-sm">{update.message}</p>
                )}
              </div>
              <time className="text-muted text-xs whitespace-nowrap">
                {new Date(update.createdAt).toLocaleDateString('es-CL')}
              </time>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
