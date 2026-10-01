import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { Button } from '../components/ui/Button';
import { Icon, type IconName } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../features/auth/auth-context';

interface NavItem {
  label: string;
  to: string;
  icon: IconName;
  end?: boolean;
}

const customerNav: NavItem[] = [
  { end: true, icon: 'chart', label: 'Inicio', to: '/app' },
  { icon: 'calendar', label: 'Citas', to: '/app/appointments' },
  { icon: 'history', label: 'Historial', to: '/app/history' },
  { icon: 'receipt', label: 'Boletas', to: '/app/billing' },
  { icon: 'tool', label: 'Servicios', to: '/app/services' },
];

const adminNav: NavItem[] = [
  { end: true, icon: 'chart', label: 'Panel', to: '/app/admin' },
  { icon: 'calendar', label: 'Agenda taller', to: '/app/admin/agenda' },
  { icon: 'users', label: 'Usuarios', to: '/app/admin/users' },
  { icon: 'tool', label: 'Servicios', to: '/app/admin/services' },
  { icon: 'settings', label: 'Configuración', to: '/app/admin/settings' },
];

export function AppShell() {
  const { logout, logoutEverywhere, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [logoutAllPending, setLogoutAllPending] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleLogoutEverywhere = async () => {
    setLogoutAllPending(true);
    try {
      await logoutEverywhere();
      setLogoutAllOpen(false);
      navigate('/', { replace: true });
    } finally {
      setLogoutAllPending(false);
    }
  };

  const initials = (user?.displayName ?? 'M')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="admin-grid-bg bg-background text-foreground min-h-screen">
      <header className="bg-background/75 sticky top-0 z-30 border-b border-white/8 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3.5 lg:px-6">
          {/* The logo always returns to the public landing page. */}
          <NavLink
            aria-label="Ir a la página principal"
            className="flex items-center gap-3"
            to="/"
          >
            <span className="bg-primary shadow-primary/20 grid size-9 place-items-center rounded-lg text-xs font-black text-white italic shadow-lg">
              M
            </span>
            <span className="hidden text-sm font-bold tracking-[0.18em] uppercase sm:block">
              Monopiston
            </span>
          </NavLink>

          <div className="flex items-center gap-3">
            {/* Return to the panel matching the active session. */}
            <NavLink
              className="text-muted hover:border-primary/50 hover:text-foreground flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold transition"
              to={isAdmin ? '/app/admin' : '/app'}
            >
              <Icon className="size-4" name="chart" />
              <span className="hidden sm:inline">
                {isAdmin ? 'Panel admin' : 'Mi panel'}
              </span>
            </NavLink>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right">
                <p className="text-sm font-semibold">{user?.displayName}</p>
                <p className="text-muted text-xs">{user?.email}</p>
              </div>
              <span
                className={`grid size-9 place-items-center rounded-full text-xs font-black ${
                  isAdmin
                    ? 'bg-primary text-white'
                    : 'text-foreground bg-white/10'
                }`}
              >
                {initials}
              </span>
            </div>
            {/* Closing every session is destructive (it ends this one too), so
                it lives behind a confirmation rather than next to plain "Salir". */}
            <button
              aria-label="Cerrar sesión en todos los dispositivos"
              className="text-muted hover:border-primary/50 hover:text-foreground flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold transition"
              onClick={() => setLogoutAllOpen(true)}
              title="Cerrar sesión en todos los dispositivos"
              type="button"
            >
              <Icon className="size-4" name="shield" />
            </button>
            <button
              className="text-muted hover:border-primary/50 hover:text-foreground flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold transition"
              onClick={() => void handleLogout()}
              type="button"
            >
              <Icon className="size-4" name="logout" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <Modal
        eyebrow="Seguridad"
        footer={
          <>
            <Button onClick={() => setLogoutAllOpen(false)} variant="ghost">
              Cancelar
            </Button>
            <Button
              loading={logoutAllPending}
              onClick={() => void handleLogoutEverywhere()}
              variant="danger"
            >
              Cerrar todas
            </Button>
          </>
        }
        onClose={() => setLogoutAllOpen(false)}
        open={logoutAllOpen}
        title="Cerrar sesión en todos los dispositivos"
      >
        <p className="text-muted text-sm leading-relaxed">
          Se cerrarán todas tus sesiones activas, incluida la de este
          dispositivo. Tendrás que volver a iniciar sesión en todas partes. Útil
          si perdiste un equipo o crees que alguien más tiene acceso a tu
          cuenta.
        </p>
      </Modal>

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Navegación principal"
          className="bg-background/92 fixed right-0 bottom-0 left-0 z-40 grid grid-cols-5 gap-1 border-t border-white/10 px-2 py-2 backdrop-blur-xl lg:sticky lg:top-[65px] lg:z-auto lg:flex lg:h-[calc(100vh-65px)] lg:flex-col lg:gap-1 lg:overflow-y-auto lg:border-t-0 lg:border-r lg:px-4 lg:py-6"
        >
          <p className="text-muted hidden px-3 pb-2 text-[0.62rem] font-semibold tracking-[0.18em] uppercase lg:block">
            {isAdmin ? 'Centro de operaciones' : 'Mi taller'}
          </p>
          {(isAdmin ? adminNav : customerNav).map((item) => (
            <NavItemLink item={item} key={item.to} />
          ))}

          {isAdmin && (
            <div className="mt-auto hidden rounded-xl border border-white/8 bg-white/[0.025] p-3 lg:block">
              <p className="text-muted text-[0.65rem] font-semibold tracking-wider uppercase">
                Sistema
              </p>
              <p className="mt-1.5 text-xs text-emerald-400">● Operativo</p>
            </div>
          )}
        </nav>

        <main className="min-w-0 px-4 pt-7 pb-24 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      className={({ isActive }) =>
        `flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[0.62rem] font-semibold whitespace-nowrap transition-all lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm ${
          isActive
            ? 'bg-primary/12 text-foreground shadow-[inset_2px_0_0_var(--color-primary)]'
            : 'text-muted hover:text-foreground hover:bg-white/[0.04]'
        }`
      }
      end={item.end ?? false}
      to={item.to}
    >
      <Icon className="size-4.5 shrink-0" name={item.icon} />
      <span className="max-w-full truncate">{item.label}</span>
    </NavLink>
  );
}
