import type {
  Appointment,
  AvailabilitySlot,
  Motorcycle,
  Service,
} from '@monopiston/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppointmentsPage } from './AppointmentsPage';

const appointment: Appointment = {
  endsAt: '2099-01-15T14:00:00.000Z',
  id: '78c865ca-8224-4e9e-a2e2-a9eddf4fb844',
  motorcycle: {
    id: '0ed4fc0c-ea93-4dc7-9af0-cba493e67491',
    label: 'La Roja',
  },
  services: [
    {
      currency: 'CLP',
      id: '984a5c7b-2163-47d7-964d-e882388e1a2c',
      name: 'Mantención básica',
      unitPrice: 24990,
    },
  ],
  startsAt: '2099-01-15T13:00:00.000Z',
  status: 'requested',
  total: 24990,
  whatsappPhone: '+56912345678',
};
const motorcycle: Motorcycle = {
  color: 'Rojo',
  createdAt: '2026-06-01T12:00:00.000Z',
  id: appointment.motorcycle.id,
  licensePlate: 'ABCD12',
  make: 'Honda',
  model: 'NAVI',
  modelYear: 2024,
  nickname: appointment.motorcycle.label,
  notes: null,
  odometerKm: 1200,
  updatedAt: '2026-06-01T12:00:00.000Z',
  vin: null,
};
const service: Service = {
  code: 'DIAGNOSTICO',
  currency: 'CLP',
  description: 'Diagnóstico inicial',
  durationMinutes: 45,
  id: appointment.services[0]!.id,
  name: 'Diagnóstico general',
  price: 15000,
};
const availableSlot: AvailabilitySlot = {
  endsAt: '2026-06-22T14:15:00.000Z',
  startsAt: '2026-06-22T13:30:00.000Z',
};

describe('AppointmentsPage', () => {
  it('confirms cancellation of a future customer appointment', async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const isCancellation =
        input === `/v1/appointments/${appointment.id}/cancel` &&
        init?.method === 'PATCH';
      const payload = isCancellation
        ? { ...appointment, status: 'cancelled' }
        : input === '/v1/appointments'
          ? [appointment]
          : [];

      return {
        headers: { get: () => 'application/json' },
        json: async () => payload,
        ok: true,
        status: isCancellation ? 200 : 200,
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AppointmentsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Cancelar cita de La Roja',
      }),
    );
    fireEvent.change(
      screen.getByLabelText('Motivo de cancelación (opcional)'),
      { target: { value: 'Cambio de planes' } },
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar cancelación' }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/v1/appointments/${appointment.id}/cancel`,
        expect.objectContaining({
          body: JSON.stringify({ reason: 'Cambio de planes' }),
          method: 'PATCH',
        }),
      ),
    );

    vi.unstubAllGlobals();
  });

  it('books a slot, requires a WhatsApp phone and redirects to Flow to pay', async () => {
    const paymentPath = `/v1/appointments/${appointment.id}/payment`;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const isCreation =
        input === '/v1/appointments' && init?.method === 'POST';
      const isPayment = input === paymentPath && init?.method === 'POST';
      const payload = isCreation
        ? {
            ...appointment,
            endsAt: availableSlot.endsAt,
            startsAt: availableSlot.startsAt,
          }
        : isPayment
          ? { redirectUrl: 'https://sandbox.flow.cl/app/web/pay.php?token=abc' }
          : input === '/v1/motorcycles'
            ? [motorcycle]
            : input === '/v1/services'
              ? [service]
              : input.startsWith('/v1/availability?')
                ? [availableSlot]
                : [];

      return {
        headers: { get: () => 'application/json' },
        json: async () => payload,
        ok: true,
        status: isCreation ? 201 : 200,
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AppointmentsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole('checkbox', { name: /diagnóstico general/i }),
    );
    const slotButton = await screen.findByRole('button', { name: '09:30' });
    fireEvent.click(slotButton);

    const confirmButton = screen.getByRole('button', {
      name: 'Confirmar y pagar',
    });
    // Disabled until a valid Chilean WhatsApp number is provided.
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('WhatsApp para coordinación'), {
      target: { value: '+56912345678' },
    });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/v1/appointments',
        expect.objectContaining({
          body: JSON.stringify({
            motorcycleId: motorcycle.id,
            serviceIds: [service.id],
            startsAt: availableSlot.startsAt,
            whatsappPhone: '+56912345678',
          }),
          method: 'POST',
        }),
      ),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        paymentPath,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'https://sandbox.flow.cl/app/web/pay.php?token=abc',
      ),
    );

    vi.unstubAllGlobals();
  });
});
