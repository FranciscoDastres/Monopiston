import type { AdminAppointment, ServiceBay } from '@monopiston/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AdminAppointmentsPage } from './AdminAppointmentsPage';

const primaryServiceBay: ServiceBay = {
  description: 'Bahía principal',
  id: '439afc20-8e91-4196-9043-10a3eaf9f3b2',
  name: 'Bahía 1',
};
const appointment: AdminAppointment = {
  customer: {
    displayName: 'Cliente Agenda',
    email: 'cliente@example.com',
    id: '9d8ce4e1-1e2b-4a98-beb6-c96e8d5e63f2',
    // Account has no phone (Google sign-in); the booking WhatsApp is the only number.
    phone: null,
  },
  endsAt: '2026-06-20T14:00:00.000Z',
  id: '78c865ca-8224-4e9e-a2e2-a9eddf4fb844',
  motorcycle: {
    id: '0ed4fc0c-ea93-4dc7-9af0-cba493e67491',
    label: 'La Roja',
  },
  serviceBay: primaryServiceBay,
  services: [
    {
      currency: 'CLP',
      id: '984a5c7b-2163-47d7-964d-e882388e1a2c',
      name: 'Mantención básica',
      unitPrice: 24990,
    },
  ],
  startsAt: '2026-06-20T13:00:00.000Z',
  status: 'requested',
  total: 24990,
  whatsappPhone: '+56987654321',
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AdminAppointmentsPage', () => {
  it('navigates daily and weekly workshop ranges', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-20T12:00:00.000Z'));
    const fetchMock = vi.fn(async () => ({
      headers: { get: () => 'application/json' },
      json: async () => [],
      ok: true,
      status: 200,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminAppointmentsPage />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/v1/admin/appointments?from=2026-06-20&to=2026-06-21',
        expect.any(Object),
      ),
    );
    expect(
      await screen.findByText('No hay citas en este periodo'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Semana' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/v1/admin/appointments?from=2026-06-15&to=2026-06-22',
        expect.any(Object),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Semana siguiente' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/v1/admin/appointments?from=2026-06-22&to=2026-06-29',
        expect.any(Object),
      ),
    );
  });

  it('confirms an appointment and exposes its WhatsApp action', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-06-20T12:00:00.000Z'));
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      const payload: unknown =
        init?.method === 'PATCH'
          ? { ...appointment, status: 'confirmed' }
          : input.startsWith('/v1/admin/appointments?')
            ? [appointment]
            : [];
      return {
        headers: { get: () => 'application/json' },
        json: async () => payload,
        ok: true,
        status: 200,
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminAppointmentsPage />
      </QueryClientProvider>,
    );

    const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
    // The action must use the WhatsApp number entered at booking, not the
    // (absent) account phone.
    expect(whatsapp).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/56987654321'),
    );
    expect(screen.getByText('+56987654321')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/v1/admin/appointments/${appointment.id}/status`,
        expect.objectContaining({
          body: JSON.stringify({ status: 'confirmed' }),
          method: 'PATCH',
        }),
      ),
    );
  });
});
