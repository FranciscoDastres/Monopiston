import {
  CreateMotorcycleSchema,
  type CreateMotorcycleInput,
  type Motorcycle,
} from '@monopiston/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { apiClient } from '../../lib/api-client';

const inputClassName =
  'mt-2 w-full rounded-lg border border-white/10 bg-background px-3 py-2.5 text-sm outline-none transition placeholder:text-muted/60 focus:border-accent';

export function MotorcyclesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const query = useQuery({
    queryFn: () => apiClient.get<Motorcycle[]>('/v1/motorcycles'),
    queryKey: ['motorcycles'],
  });
  const form = useForm<CreateMotorcycleInput>({
    resolver: zodResolver(CreateMotorcycleSchema),
  });
  const createMutation = useMutation({
    mutationFn: (input: CreateMotorcycleInput) =>
      apiClient.post<Motorcycle>('/v1/motorcycles', input),
    onSuccess: async () => {
      form.reset();
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['motorcycles'] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/motorcycles/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['motorcycles'] }),
  });

  return (
    <div>
      <PageHeader
        actions={
          <Button
            icon={showForm ? 'close' : 'plus'}
            onClick={() => setShowForm((current) => !current)}
            variant={showForm ? 'secondary' : 'primary'}
          >
            {showForm ? 'Cerrar formulario' : 'Agregar NAVI'}
          </Button>
        }
        eyebrow="Tu garaje"
        subtitle="Registra cada moto para conservar su historial."
        title="Mis Honda NAVI"
      />

      {showForm && (
        <form
          className="border-accent/20 bg-surface mt-8 rounded-2xl border p-6"
          onSubmit={form.handleSubmit((input) => createMutation.mutate(input))}
        >
          <h2 className="text-lg font-bold">Datos de la moto</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Apodo
              <input
                className={inputClassName}
                placeholder="La Roja"
                {...form.register('nickname', {
                  setValueAs: (value: string) =>
                    value === '' ? undefined : value,
                })}
              />
            </label>
            <label className="text-sm font-semibold">
              Año
              <input
                className={inputClassName}
                inputMode="numeric"
                placeholder="2024"
                type="number"
                {...form.register('modelYear', {
                  setValueAs: (value: string) =>
                    value === '' ? undefined : Number(value),
                })}
              />
            </label>
            <label className="text-sm font-semibold">
              Color
              <input
                className={inputClassName}
                placeholder="Rojo"
                {...form.register('color', {
                  setValueAs: (value: string) =>
                    value === '' ? undefined : value,
                })}
              />
            </label>
            <label className="text-sm font-semibold">
              Patente
              <input
                className={inputClassName}
                placeholder="ABCD12"
                {...form.register('licensePlate', {
                  setValueAs: (value: string) =>
                    value === '' ? undefined : value,
                })}
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Kilometraje
              <input
                className={inputClassName}
                inputMode="numeric"
                min="0"
                placeholder="1200"
                type="number"
                {...form.register('odometerKm', {
                  setValueAs: (value: string) =>
                    value === '' ? undefined : Number(value),
                })}
              />
            </label>
          </div>

          {Object.keys(form.formState.errors).length > 0 && (
            <p className="text-primary mt-4 text-sm">
              Revisa los datos ingresados.
            </p>
          )}
          {createMutation.isError && (
            <p className="text-primary mt-4 text-sm">
              No fue posible registrar la moto. Revisa patente y VIN.
            </p>
          )}

          <button
            className="bg-accent text-background mt-6 rounded-xl px-5 py-3 text-sm font-black disabled:opacity-50"
            disabled={createMutation.isPending}
            type="submit"
          >
            {createMutation.isPending ? 'Guardando…' : 'Guardar NAVI'}
          </button>
        </form>
      )}

      {query.isError && (
        <p className="border-primary/30 bg-primary/10 mt-8 rounded-xl border p-4 text-sm">
          No pudimos cargar tus motos.
        </p>
      )}

      {!query.isLoading && query.data?.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon="bike"
            title="Aún no tienes motos registradas"
            description="Agrega tu primera NAVI para comenzar."
          />
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {query.data?.map((motorcycle) => (
          <article
            className="bg-surface rounded-2xl border border-white/10 p-6"
            key={motorcycle.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-accent font-mono text-xs">
                  {motorcycle.licensePlate ?? 'SIN PATENTE'}
                </p>
                <h2 className="mt-2 text-xl font-bold">
                  {motorcycle.nickname ??
                    `${motorcycle.make} ${motorcycle.model}`}
                </h2>
              </div>
              <span className="text-muted rounded-full bg-white/5 px-3 py-1 text-xs">
                {motorcycle.modelYear ?? 'Año —'}
              </span>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted">Color</dt>
                <dd className="mt-1 font-semibold">
                  {motorcycle.color ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Kilometraje</dt>
                <dd className="mt-1 font-semibold">
                  {motorcycle.odometerKm?.toLocaleString('es-CL') ?? '—'} km
                </dd>
              </div>
            </dl>
            <button
              className="text-muted hover:text-primary mt-6 text-xs font-semibold transition disabled:opacity-50"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(motorcycle.id)}
              type="button"
            >
              Quitar del garaje
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
