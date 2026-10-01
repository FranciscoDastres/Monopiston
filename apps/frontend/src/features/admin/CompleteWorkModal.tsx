import type {
  AdminAppointment,
  ReportPreset,
  ReportPresetKind,
} from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../lib/api-client';

const textareaClass =
  'bg-background focus:border-accent min-h-20 w-full resize-y rounded-xl border border-white/10 px-3 py-2 text-sm outline-none';
const inputClass =
  'bg-background focus:border-accent w-full rounded-xl border border-white/10 px-3 py-2.5 text-sm outline-none';

export function CompleteWorkModal({
  appointment,
  onClose,
}: {
  appointment: AdminAppointment;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [technicalSummary, setTechnicalSummary] = useState('');
  const [performedText, setPerformedText] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [recommendationsText, setRecommendationsText] = useState('');
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [maintenanceKm, setMaintenanceKm] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid'>(
    'pending',
  );
  const [saveAsPresets, setSaveAsPresets] = useState(false);

  const reportPresets = useQuery({
    queryFn: () => apiClient.get<ReportPreset[]>('/v1/admin/report-presets'),
    queryKey: ['admin', 'report-presets'],
    staleTime: 5 * 60_000,
  });
  const presetsByKind = (kind: ReportPresetKind) =>
    reportPresets.data?.filter((preset) => preset.kind === kind) ?? [];

  const completeWork = useMutation({
    mutationFn: async (appointmentId: string) => {
      const performed = parseItems(performedText);
      const pending = parseItems(pendingText);
      const recommendationItems = parseItems(recommendationsText);
      const recommendations = recommendationItems.map((item) => ({
        ...item,
        ...(maintenanceDate && {
          dueAt: new Date(`${maintenanceDate}T12:00:00`).toISOString(),
        }),
        ...(maintenanceKm && { dueOdometerKm: Number(maintenanceKm) }),
        severity: 'warning' as const,
      }));
      await apiClient.post(
        `/v1/admin/appointments/${appointmentId}/complete-work`,
        {
          paymentStatus,
          pending,
          performed,
          recommendations,
          technicalSummary,
        },
      );
      // Persist the answers used as reusable presets so particular cases become
      // selectable next time. The backend dedupes by (kind, title).
      if (saveAsPresets) {
        await Promise.all([
          ...performed.map((item) =>
            apiClient.post('/v1/admin/report-presets', {
              ...item,
              kind: 'performed',
            }),
          ),
          ...pending.map((item) =>
            apiClient.post('/v1/admin/report-presets', {
              ...item,
              kind: 'pending',
            }),
          ),
          ...recommendationItems.map((item) =>
            apiClient.post('/v1/admin/report-presets', {
              ...item,
              kind: 'recommendation',
              severity: 'warning',
            }),
          ),
        ]);
      }
    },
    onSuccess: async () => {
      onClose();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'appointments'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] }),
        queryClient.invalidateQueries({
          queryKey: ['admin', 'report-presets'],
        }),
      ]);
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      eyebrow="Informe técnico"
      title={`Finalizar atención · ${appointment.customer.displayName}`}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-muted mb-1.5 block text-xs font-semibold uppercase">
            Resumen técnico
          </span>
          <textarea
            className={textareaClass}
            onChange={(event) => setTechnicalSummary(event.target.value)}
            placeholder="Diagnóstico general y resultado de la atención"
            value={technicalSummary}
          />
        </label>
        <div className="block">
          <span className="text-muted mb-1.5 block text-xs font-semibold uppercase">
            Trabajo realizado
          </span>
          <PresetPicker
            presets={presetsByKind('performed')}
            onPick={(preset) =>
              setPerformedText((current) => appendPresetLine(current, preset))
            }
          />
          <textarea
            className={`${textareaClass} mt-2`}
            onChange={(event) => setPerformedText(event.target.value)}
            placeholder={'Un trabajo por línea. Formato: Título | Descripción'}
            value={performedText}
          />
        </div>
        <div className="block">
          <span className="text-muted mb-1.5 block text-xs font-semibold uppercase">
            Trabajo pendiente
          </span>
          <PresetPicker
            presets={presetsByKind('pending')}
            onPick={(preset) =>
              setPendingText((current) => appendPresetLine(current, preset))
            }
          />
          <textarea
            className={`${textareaClass} mt-2`}
            onChange={(event) => setPendingText(event.target.value)}
            placeholder="Opcional: Título | Descripción"
            value={pendingText}
          />
        </div>
        <div className="block">
          <span className="text-muted mb-1.5 block text-xs font-semibold uppercase">
            Recomendaciones futuras
          </span>
          <PresetPicker
            presets={presetsByKind('recommendation')}
            onPick={(preset) =>
              setRecommendationsText((current) =>
                appendPresetLine(current, preset),
              )
            }
          />
          <textarea
            className={`${textareaClass} mt-2`}
            onChange={(event) => setRecommendationsText(event.target.value)}
            placeholder="Opcional: Título | Descripción"
            value={recommendationsText}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-muted mb-1.5 block text-xs font-semibold uppercase">
              Fecha recomendada
            </span>
            <input
              className={inputClass}
              onChange={(event) => setMaintenanceDate(event.target.value)}
              type="date"
              value={maintenanceDate}
            />
          </label>
          <label>
            <span className="text-muted mb-1.5 block text-xs font-semibold uppercase">
              Kilometraje recomendado
            </span>
            <input
              className={inputClass}
              min="0"
              onChange={(event) => setMaintenanceKm(event.target.value)}
              type="number"
              value={maintenanceKm}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-muted mb-1.5 block text-xs font-semibold uppercase">
            Estado de pago
          </span>
          <select
            className={inputClass}
            onChange={(event) =>
              setPaymentStatus(event.target.value as 'pending' | 'paid')
            }
            value={paymentStatus}
          >
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            checked={saveAsPresets}
            onChange={(event) => setSaveAsPresets(event.target.checked)}
            type="checkbox"
          />
          <span className="text-muted">
            Guardar estas respuestas como presets reutilizables
          </span>
        </label>
        {completeWork.isError && (
          <p className="text-sm text-red-400" role="alert">
            No fue posible finalizar la atención. Revisa los datos e inténtalo
            nuevamente.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose} variant="ghost">
            Cancelar
          </Button>
          <Button
            disabled={
              parseItems(performedText).length === 0 ||
              technicalSummary.trim().length < 3
            }
            loading={completeWork.isPending}
            onClick={() => completeWork.mutate(appointment.id)}
          >
            Finalizar y emitir comprobante
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function PresetPicker({
  onPick,
  presets,
}: {
  onPick: (preset: ReportPreset) => void;
  presets: ReportPreset[];
}) {
  if (presets.length === 0) return null;
  return (
    <select
      aria-label="Respuestas predefinidas"
      className={inputClass}
      onChange={(event) => {
        const preset = presets.find((item) => item.id === event.target.value);
        if (preset) onPick(preset);
        event.target.selectedIndex = 0;
      }}
      value=""
    >
      <option value="">+ Agregar respuesta predefinida…</option>
      {presets.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.title}
        </option>
      ))}
    </select>
  );
}

/** Append a preset as a new `Título | Descripción` line, skipping duplicates. */
function appendPresetLine(current: string, preset: ReportPreset): string {
  const line = `${preset.title} | ${preset.description}`;
  const lines = current.split('\n').map((value) => value.trim());
  if (lines.includes(line)) return current;
  const trimmed = current.trimEnd();
  return trimmed ? `${trimmed}\n${line}` : line;
}

function parseItems(
  value: string,
): Array<{ title: string; description: string }> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...descriptionParts] = line.split('|');
      const normalizedTitle = title?.trim() ?? line;
      const description = descriptionParts.join('|').trim() || normalizedTitle;
      return { description, title: normalizedTitle };
    });
}
