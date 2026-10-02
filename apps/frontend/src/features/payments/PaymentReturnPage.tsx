import type {
  PaymentInitResponse,
  PaymentStatusView,
} from '@monopiston/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { formatCLP } from '../../components/ui/money';
import { apiClient } from '../../lib/api-client';
import { LAST_APPOINTMENT_KEY } from '../appointments/appointment-helpers';

const TERMINAL: PaymentStatusView['status'][] = [
  'paid',
  'failed',
  'expired',
  'cancelled',
];

export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const [appointmentId] = useState(
    () =>
      params.get('appointmentId') ??
      window.localStorage.getItem(LAST_APPOINTMENT_KEY) ??
      '',
  );

  const status = useQuery({
    enabled: Boolean(appointmentId),
    queryFn: () =>
      apiClient.get<PaymentStatusView>(`/v1/payments/${appointmentId}/status`),
    queryKey: ['payment-status', appointmentId],
    // Poll while the webhook settles the payment, then stop once terminal.
    refetchInterval: (query) =>
      query.state.data && TERMINAL.includes(query.state.data.status)
        ? false
        : 2_000,
  });

  const retry = useMutation({
    mutationFn: () =>
      apiClient.post<PaymentInitResponse>(
        `/v1/appointments/${appointmentId}/payment`,
        {},
      ),
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
  });

  useEffect(() => {
    if (status.data?.status === 'paid') {
      window.localStorage.removeItem(LAST_APPOINTMENT_KEY);
    }
  }, [status.data?.status]);

  const view = status.data;
  const paid = view?.status === 'paid';
  const failed = view
    ? ['failed', 'expired', 'cancelled'].includes(view.status)
    : false;

  return (
    <section className="mx-auto max-w-xl py-10">
      <h1 className="text-2xl font-black">Comprobante de pago</h1>

      {!appointmentId && (
        <p className="text-muted mt-4 text-sm">
          No encontramos la cita asociada al pago. Revisa tus citas en el panel.
        </p>
      )}

      {appointmentId && !view && (
        <p className="text-muted mt-4 text-sm">Verificando el pago…</p>
      )}

      {view && !paid && !failed && (
        <div
          className="border-accent/20 bg-surface mt-6 rounded-2xl border p-6"
          role="status"
        >
          <p className="text-sm font-bold">Procesando tu pago…</p>
          <p className="text-muted mt-1 text-xs">
            Estamos confirmando la transacción con Flow. Esto puede tardar unos
            segundos.
          </p>
        </div>
      )}

      {paid && view && (
        <div
          className="border-success/30 bg-success/10 mt-6 rounded-2xl border p-6"
          role="status"
        >
          <p className="text-success text-lg font-black">¡Cita confirmada!</p>
          <p className="text-muted mt-1 text-sm">
            Pago recibido por {formatCLP(view.amount)}. Te coordinaremos por
            WhatsApp.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {view.invoiceId && (
              <a
                className="bg-primary rounded-xl px-4 py-2 text-sm font-bold text-white"
                download
                href={`/v1/invoices/${view.invoiceId}/pdf`}
              >
                Descargar boleta
              </a>
            )}
            <Link
              className="border-accent/30 rounded-xl border px-4 py-2 text-sm font-bold"
              to="/app/billing"
            >
              Ver boletas
            </Link>
          </div>
        </div>
      )}

      {failed && (
        <div
          className="border-primary/30 bg-primary/10 mt-6 rounded-2xl border p-6"
          role="alert"
        >
          <p className="text-primary text-lg font-black">
            Tu cita no fue confirmada
          </p>
          <p className="text-muted mt-1 text-sm">
            El pago no se completó, por lo que la reserva no quedó confirmada.
            Puedes reintentar el pago.
          </p>
          <button
            className="bg-primary mt-5 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            disabled={retry.isPending}
            onClick={() => retry.mutate()}
            type="button"
          >
            {retry.isPending ? 'Redirigiendo…' : 'Reintentar pago'}
          </button>
        </div>
      )}
    </section>
  );
}
