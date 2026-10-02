/* eslint-disable react-refresh/only-export-components -- route config defines lazy components alongside the router export */
import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import { LandingPage } from '../pages/LandingPage';
import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';

// Heavy areas are code-split: the public landing no longer ships the /app,
// admin and legal bundles, shrinking the initial download.
const AppShell = lazy(() =>
  import('./AppShell').then((m) => ({ default: m.AppShell })),
);
const AccountPage = lazy(() =>
  import('../features/account/AccountPage').then((m) => ({
    default: m.AccountPage,
  })),
);
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
);
const AppointmentsPage = lazy(() =>
  import('../features/appointments/AppointmentsPage').then((m) => ({
    default: m.AppointmentsPage,
  })),
);
const AppointmentTimelinePage = lazy(() =>
  import('../features/appointments/AppointmentTimelinePage').then((m) => ({
    default: m.AppointmentTimelinePage,
  })),
);
const ServicesPage = lazy(() =>
  import('../features/services/ServicesPage').then((m) => ({
    default: m.ServicesPage,
  })),
);
const ServiceHistoryPage = lazy(() =>
  import('../features/history/ServiceHistoryPage').then((m) => ({
    default: m.ServiceHistoryPage,
  })),
);
const BillingPage = lazy(() =>
  import('../features/billing/BillingPage').then((m) => ({
    default: m.BillingPage,
  })),
);
const PaymentReturnPage = lazy(() =>
  import('../features/payments/PaymentReturnPage').then((m) => ({
    default: m.PaymentReturnPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import('../features/admin/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
);
const AdminAppointmentsPage = lazy(() =>
  import('../features/admin/AdminAppointmentsPage').then((m) => ({
    default: m.AdminAppointmentsPage,
  })),
);
const AdminUsersPage = lazy(() =>
  import('../features/admin/AdminUsersPage').then((m) => ({
    default: m.AdminUsersPage,
  })),
);
const AdminServicesPage = lazy(() =>
  import('../features/admin/AdminServicesPage').then((m) => ({
    default: m.AdminServicesPage,
  })),
);
const WorkshopSettingsPage = lazy(() =>
  import('../features/admin/WorkshopSettingsPage').then((m) => ({
    default: m.WorkshopSettingsPage,
  })),
);
const LegalPage = lazy(() =>
  import('../features/legal/LegalPage').then((m) => ({ default: m.LegalPage })),
);

export const router = createBrowserRouter([
  { element: <LandingPage />, path: '/' },
  { element: <LegalPage />, path: '/legal/:doc' },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        path: '/app',
        children: [
          { element: <DashboardPage />, index: true },
          { element: <AccountPage />, path: 'account' },
          { element: <AppointmentsPage />, path: 'appointments' },
          { element: <AppointmentTimelinePage />, path: 'appointments/:id' },
          { element: <ServiceHistoryPage />, path: 'history' },
          { element: <BillingPage />, path: 'billing' },
          { element: <PaymentReturnPage />, path: 'pago/retorno' },
          { element: <ServicesPage />, path: 'services' },
          {
            element: <AdminRoute />,
            children: [
              { element: <AdminDashboardPage />, path: 'admin' },
              { element: <AdminAppointmentsPage />, path: 'admin/agenda' },
              { element: <AdminUsersPage />, path: 'admin/users' },
              { element: <AdminServicesPage />, path: 'admin/services' },
              { element: <WorkshopSettingsPage />, path: 'admin/settings' },
            ],
          },
        ],
      },
    ],
  },
]);
