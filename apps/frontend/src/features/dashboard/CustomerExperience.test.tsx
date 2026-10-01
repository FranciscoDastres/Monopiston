import type {
  CustomerDashboard,
  Invoice,
  ServiceHistoryRecord,
} from '@monopiston/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AuthContext } from '../auth/auth-context';
import { BillingPage } from '../billing/BillingPage';
import { ServiceHistoryPage } from '../history/ServiceHistoryPage';
import { DashboardPage } from './DashboardPage';

const appointmentId = '78c865ca-8224-4e9e-a2e2-a9eddf4fb844';
const invoiceId = '66057ff1-b8bd-4c46-86c6-8db091081aca';
const dashboard: CustomerDashboard = {
  activeAppointment: null,
  latestProgress: null,
  nextAppointment: null,
  nextMaintenance: {
    description: 'Revisar tensión y lubricación.',
    dueAt: '2026-09-23T12:00:00.000Z',
    dueOdometerKm: 5000,
    id: 'ebdefdf2-acad-46ff-b59e-c96e82084017',
    severity: 'warning',
    title: 'Revisión de cadena',
  },
  unpaidInvoices: 1,
};
const invoices: Invoice[] = [
  {
    amount: 24990,
    appointmentId,
    currency: 'CLP',
    documentKind: 'comprobante_interno',
    documentNumber: 'DRP-2026-78C865CA',
    id: invoiceId,
    issuedAt: '2026-06-23T12:00:00.000Z',
    ivaAmount: null,
    netAmount: null,
    paidAt: null,
    paymentStatus: 'pending',
    services: ['Mantención básica'],
    siiFolio: null,
    siiStatus: 'not_applicable',
  },
];
const history: ServiceHistoryRecord[] = [
  {
    appointmentId,
    completedAt: '2026-06-23T12:00:00.000Z',
    motorcycleLabel: 'Honda NAVI',
    progress: [],
    recommendations: [dashboard.nextMaintenance!],
    services: ['Mantención básica'],
    technicalSummary: 'La moto quedó operativa y sin fugas.',
    total: 24990,
    workPending: [],
    workPerformed: [
      {
        description: 'Se instaló aceite nuevo.',
        id: '984a5c7b-2163-47d7-964d-e882388e1a2c',
        title: 'Cambio de aceite',
      },
    ],
  },
];

afterEach(() => vi.unstubAllGlobals());

describe('customer experience', () => {
  it('renders the dashboard with maintenance and billing actions', async () => {
    mockApi({ '/v1/customer/dashboard': dashboard });
    renderPage(<DashboardPage />, true);
    expect(await screen.findByText('Revisión de cadena')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /ver mis boletas/i }),
    ).toHaveAttribute('href', '/app/billing');
  });

  it('expands the structured service history', async () => {
    mockApi({ '/v1/customer/history': history });
    renderPage(<ServiceHistoryPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: /mantención básica/i }),
    );
    expect(await screen.findByText('Cambio de aceite')).toBeInTheDocument();
    expect(
      screen.getByText('La moto quedó operativa y sin fugas.'),
    ).toBeInTheDocument();
  });

  it('shows invoice payment state and a direct PDF download', async () => {
    mockApi({ '/v1/invoices': invoices });
    renderPage(<BillingPage />);
    expect(await screen.findAllByText('Pendiente')).not.toHaveLength(0);
    expect(
      screen.getAllByRole('link', { name: /descargar pdf/i })[0],
    ).toHaveAttribute('href', `/v1/invoices/${invoiceId}/pdf`);
  });
});

function renderPage(element: React.ReactNode, withAuth = false) {
  const content = (
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        {element}
      </QueryClientProvider>
    </MemoryRouter>
  );
  return render(
    withAuth ? (
      <AuthContext.Provider
        value={{
          deleteAccount: async () => undefined,
          isLoading: false,
          logout: async () => undefined,
          logoutEverywhere: async () => undefined,
          signInAdmin: async () => {
            throw new Error();
          },
          signInAsDeveloper: async () => {
            throw new Error();
          },
          updateProfile: async () => {
            throw new Error();
          },
          user: {
            avatarUrl: null,
            displayName: 'Cliente NAVI',
            email: 'cliente@example.com',
            id: '9d8ce4e1-1e2b-4a98-beb6-c96e8d5e63f2',
            phone: null,
            role: 'customer',
          },
        }}
      >
        {content}
      </AuthContext.Provider>
    ) : (
      content
    ),
  );
}

function mockApi(responses: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => ({
      headers: { get: () => 'application/json' },
      json: async () => responses[input],
      ok: true,
      status: 200,
    })),
  );
}
