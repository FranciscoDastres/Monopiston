import type { AdminService, CreateServiceInput } from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, Input } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { Modal } from '../../components/ui/Modal';
import { formatCLP } from '../../components/ui/money';
import { PageHeader } from '../../components/ui/PageHeader';
import { apiClient } from '../../lib/api-client';

const EMPTY_FORM = {
  code: '',
  description: '',
  durationMinutes: 60,
  name: '',
  price: 0,
};

export function AdminServicesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const services = useQuery({
    queryFn: () => apiClient.get<AdminService[]>('/v1/admin/workshop/services'),
    queryKey: ['admin', 'workshop', 'services'],
  });
  const refreshServices = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['admin', 'workshop', 'services'],
      }),
      queryClient.invalidateQueries({ queryKey: ['services'] }),
    ]);
  };
  const createService = useMutation({
    mutationFn: (input: CreateServiceInput) =>
      apiClient.post<AdminService>('/v1/admin/workshop/services', input),
    onSuccess: async () => {
      setForm(EMPTY_FORM);
      setFormOpen(false);
      await refreshServices();
    },
  });
  const toggleService = useMutation({
    mutationFn: (service: AdminService) =>
      apiClient.patch<AdminService>(
        `/v1/admin/workshop/services/${service.id}`,
        {
          isActive: !service.isActive,
        },
      ),
    onSuccess: refreshServices,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createService.mutate({
      code: form.code.trim().toUpperCase(),
      currency: 'CLP',
      description: form.description.trim() || undefined,
      durationMinutes: form.durationMinutes,
      name: form.name.trim(),
      price: form.price,
    });
  };

  return (
    <div>
      <PageHeader
        actions={
          <Button icon="plus" onClick={() => setFormOpen(true)}>
            Agregar servicio
          </Button>
        }
        eyebrow="Administración"
        subtitle="Los servicios activos aparecen automáticamente en el catálogo del cliente."
        title="Servicios"
      />

      {services.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              className="bg-surface h-36 animate-pulse rounded-2xl border border-white/8"
              key={index}
            />
          ))}
        </div>
      ) : !services.data?.length ? (
        <EmptyState
          icon="tool"
          title="No hay servicios"
          description="Agrega el primer servicio del taller."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {services.data.map((service) => (
            <Card
              className={`p-4 transition ${service.isActive ? '' : 'opacity-60'}`}
              key={service.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-primary font-mono text-[0.65rem] tracking-wider">
                    {service.code}
                  </p>
                  <h2 className="mt-1 truncate text-base font-bold tracking-normal normal-case">
                    {service.name}
                  </h2>
                </div>
                <Badge tone={service.isActive ? 'success' : 'neutral'}>
                  {service.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              {service.description && (
                <p className="text-muted mt-2 line-clamp-2 text-xs leading-5">
                  {service.description}
                </p>
              )}
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/8 pt-3">
                <div>
                  <p className="text-sm font-bold">
                    {formatCLP(service.price)}
                  </p>
                  <p className="text-muted mt-0.5 flex items-center gap-1 text-xs">
                    <Icon className="size-3.5" name="clock" />
                    {service.durationMinutes} min
                  </p>
                </div>
                <Button
                  disabled={toggleService.isPending}
                  onClick={() => toggleService.mutate(service)}
                  size="sm"
                  variant="secondary"
                >
                  {service.isActive ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        eyebrow="Catálogo"
        title="Agregar servicio"
      >
        <form className="space-y-4" onSubmit={submit}>
          <Field label="Nombre">
            <Input
              autoFocus
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              required
              value={form.name}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field hint="Ej.: MANTENCION_5K" label="Código">
              <Input
                minLength={2}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                required
                value={form.code}
              />
            </Field>
            <Field label="Duración (min)">
              <Input
                min={5}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    durationMinutes: Number(event.target.value),
                  }))
                }
                required
                type="number"
                value={form.durationMinutes}
              />
            </Field>
          </div>
          <Field label="Precio CLP">
            <Input
              min={0}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  price: Number(event.target.value),
                }))
              }
              required
              type="number"
              value={form.price}
            />
          </Field>
          <Field label="Descripción">
            <textarea
              className="bg-background focus:border-accent min-h-24 w-full resize-y rounded-xl border border-white/10 px-3.5 py-2.5 text-sm outline-none"
              maxLength={2000}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              value={form.description}
            />
          </Field>
          {createService.isError && (
            <p className="text-sm text-red-400" role="alert">
              No fue posible crear el servicio. Revisa que el código sea único.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setFormOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button loading={createService.isPending} type="submit">
              Agregar servicio
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
