import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';

import { Icon, type IconName } from '../components/ui/Icon';
import { BRAND } from '../config/brand';
import { CONTACT, whatsappLink } from '../config/contact';
import { Footer } from '../features/landing/Footer';
import { HeroCarousel } from '../features/landing/HeroCarousel';
import { TopBar } from '../features/landing/TopBar';
import { WhatsAppButton } from '../features/landing/WhatsAppButton';

// Booking and sign-in download only when the visitor opens them.
const BookingModal = lazy(() =>
  import('../features/appointments/BookingModal').then((module) => ({
    default: module.BookingModal,
  })),
);
const LoginModal = lazy(() =>
  import('../features/auth/LoginModal').then((module) => ({
    default: module.LoginModal,
  })),
);

const API_URL = import.meta.env.VITE_API_URL ?? '';
const LOGIN_URL = `${API_URL}/v1/auth/google?returnTo=/app`;
const BOOKING_URL = `${API_URL}/v1/auth/google?returnTo=/app/appointments`;

const menuItems: Array<{
  description: string;
  href: string;
  icon: IconName;
  label: string;
}> = [
  {
    description: 'Mantención y cuidado especializado',
    href: '#servicios',
    icon: 'tool',
    label: 'Servicios',
  },
  {
    description: 'Sigue el trabajo de tu moto',
    href: LOGIN_URL,
    icon: 'clock',
    label: 'Estado en vivo',
  },
  {
    description: 'Revisa servicios y kilometraje',
    href: LOGIN_URL,
    icon: 'history',
    label: 'Historial',
  },
];

const serviceCards: Array<{
  description: string;
  icon: IconName;
  title: string;
}> = [
  {
    description:
      'Aceite, frenos, transmisión y puntos críticos revisados con una pauta clara.',
    icon: 'tool',
    title: 'Mantención preventiva',
  },
  {
    description:
      'Identificamos el origen del problema y te explicamos el trabajo antes de comenzar.',
    icon: 'spark',
    title: 'Diagnóstico integral',
  },
  {
    description:
      'Atención enfocada en resolver ajustes frecuentes sin sacrificar el estándar técnico.',
    icon: 'clock',
    title: 'Servicio express',
  },
];

const customerFeatures: Array<{
  description: string;
  icon: IconName;
  title: string;
}> = [
  {
    description:
      'Elige los servicios, revisa su precio y reserva un horario disponible.',
    icon: 'calendar',
    title: 'Agenda cuando lo necesites',
  },
  {
    description:
      'Consulta el estado de tu cita y las novedades del trabajo desde tu cuenta.',
    icon: 'clock',
    title: 'Sigue cada avance',
  },
  {
    description:
      'Encuentra los servicios realizados, las recomendaciones y tus boletas en un solo lugar.',
    icon: 'history',
    title: 'Conserva tu historial',
  },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = menuRef.current;
    if (menuOpen) dialog?.showModal();
    else if (dialog?.open) dialog.close();
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleAnchorIntercept = (event: MouseEvent<HTMLDivElement>) => {
    const href = (event.target as HTMLElement)
      .closest('a')
      ?.getAttribute('href');
    if (href === BOOKING_URL) {
      event.preventDefault();
      setBookingOpen(true);
    } else if (href === LOGIN_URL) {
      event.preventDefault();
      setLoginOpen(true);
    }
  };

  return (
    <div
      className="bg-background text-foreground min-h-screen"
      onClick={handleAnchorIntercept}
    >
      <Suspense
        fallback={
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-black/70 text-sm text-white"
            role="status"
          >
            Abriendo…
          </div>
        }
      >
        {bookingOpen && (
          <BookingModal onClose={() => setBookingOpen(false)} open />
        )}
        {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} open />}
      </Suspense>

      <header className="bg-background sticky top-0 z-50 border-b border-white/15">
        <TopBar onMenuClick={() => setMenuOpen(true)} />
        <div className="bg-primary flex min-h-12 items-center justify-center gap-6 px-5 sm:gap-14">
          <a
            className="flex min-h-12 items-center gap-2 text-xs font-bold text-white sm:text-sm"
            href={BOOKING_URL}
          >
            <Icon name="calendar" />
            Agendar una cita
          </a>
          <span aria-hidden="true" className="h-5 w-px bg-white/30" />
          <a
            className="flex min-h-12 items-center gap-2 text-xs font-bold text-white sm:text-sm"
            href={LOGIN_URL}
          >
            <Icon name="user" />
            Mi cuenta
          </a>
        </div>
      </header>

      <dialog
        aria-label="Menú principal"
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 text-white backdrop:bg-black/70"
        onCancel={() => setMenuOpen(false)}
        onClose={() => setMenuOpen(false)}
        ref={menuRef}
      >
        <button
          aria-label="Cerrar menú"
          className="absolute inset-0 size-full"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
        <aside className="bg-lead-deep absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto border-l border-white/10 p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl">Tu Honda NAVI</h2>
            <button
              aria-label="Cerrar navegación"
              className="grid size-11 place-items-center rounded-lg border border-white/20"
              onClick={() => setMenuOpen(false)}
              type="button"
            >
              <Icon name="close" />
            </button>
          </div>
          <nav className="mt-8 divide-y divide-white/10 border-y border-white/10">
            {menuItems.map((item) => (
              <a
                className="group flex items-center gap-4 py-5"
                href={item.href}
                key={item.label}
                onClick={() => setMenuOpen(false)}
              >
                <span className="group-hover:bg-primary grid size-11 shrink-0 place-items-center border border-white/15 transition">
                  <Icon name={item.icon} />
                </span>
                <span>
                  <span className="font-display block text-sm font-bold">
                    {item.label}
                  </span>
                  <span className="text-muted mt-1 block text-xs">
                    {item.description}
                  </span>
                </span>
              </a>
            ))}
          </nav>
          <p className="text-muted mt-8 text-sm">
            Atención especializada para Honda NAVI, con información clara antes,
            durante y después del servicio.
          </p>
        </aside>
      </dialog>

      <main id="top">
        <HeroCarousel>
          <div className="landing-hero-content mx-auto flex max-w-7xl items-end px-5 pt-56 pb-40 sm:items-center sm:px-6 sm:pt-20 sm:pb-28 lg:px-10">
            <div className="pointer-events-auto max-w-2xl">
              <p className="text-muted mb-5 text-sm font-semibold">
                Especialistas en Honda NAVI · {BRAND.location}
              </p>
              <h1 className="text-foreground max-w-2xl text-[clamp(2.2rem,4.5vw,4rem)] leading-[1.05] font-extrabold tracking-[-0.035em]">
                Tu NAVI lista para
                <br />
                volver a rodar.
              </h1>
              <p className="text-muted mt-6 max-w-lg text-base leading-7 sm:text-lg">
                Agenda mantenciones, sigue cada avance y conserva el historial
                de tu moto con {BRAND.name}.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="landing-primary-button" href={BOOKING_URL}>
                  <Icon name="calendar" />
                  Agendar una cita
                </a>
                <a className="landing-secondary-button" href="#servicios">
                  Ver servicios
                </a>
              </div>
              <div className="text-muted mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs">
                {[
                  'Agenda online',
                  'Seguimiento del servicio',
                  'Historial digital',
                ].map((item) => (
                  <span className="flex items-center gap-2" key={item}>
                    <Icon className="text-accent size-4" name="check" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </HeroCarousel>

        <nav
          aria-label="Navegación de portada"
          className="bg-lead-nav sticky top-[var(--landing-header-height)] z-30 border-y border-white/15"
        >
          <div className="mx-auto grid min-h-14 max-w-4xl grid-cols-3 items-center text-center">
            <a
              className="landing-nav-link flex min-h-14 items-center justify-center px-2"
              href="#servicios"
            >
              Servicios
            </a>
            <a
              className="landing-nav-link flex min-h-14 items-center justify-center px-2"
              href="#clientes"
            >
              Tu moto
            </a>
            <a
              className="landing-nav-link flex min-h-14 items-center justify-center px-2"
              href="#nosotros"
            >
              El taller
            </a>
          </div>
        </nav>

        <section className="bg-background" id="servicios">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-10">
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-5xl">Servicios para tu NAVI</h2>
              <p className="text-muted mt-5 text-lg">
                Cada uno con precio y duración a la vista. Eliges, agendas y
                listo.
              </p>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-white/15 bg-white/15 md:grid-cols-3">
              {serviceCards.map((service) => (
                <article className="bg-surface p-7 sm:p-8" key={service.title}>
                  <Icon className="text-accent size-7" name={service.icon} />
                  <h3 className="mt-6 text-xl">{service.title}</h3>
                  <p className="text-muted mt-4 text-sm leading-6">
                    {service.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-lead-deep" id="clientes">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-10">
            <h2 className="max-w-2xl text-3xl sm:text-5xl">
              Tu moto, siempre al día
            </h2>
            <p className="text-muted mt-5 max-w-2xl text-lg">
              Tu cuenta reúne lo que necesitas antes, durante y después de cada
              visita.
            </p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {customerFeatures.map((feature) => (
                <article
                  className="border-t border-white/20 pt-6"
                  key={feature.title}
                >
                  <Icon className="text-accent size-6" name={feature.icon} />
                  <h3 className="mt-4 text-lg">{feature.title}</h3>
                  <p className="text-muted mt-3 text-sm leading-6">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-background" id="nosotros">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-6 sm:py-24 md:grid-cols-[280px_minmax(0,1fr)] lg:gap-16 lg:px-10">
            <img
              alt={`Emblema de ${BRAND.name}`}
              className="mx-auto h-auto w-64 max-w-full"
              decoding="async"
              height="454"
              loading="lazy"
              src={BRAND.logo}
              width="512"
            />
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-4xl">{BRAND.name}</h2>
              <p className="text-muted mt-5 text-lg leading-8">
                Somos un taller dedicado al servicio técnico de motocicletas
                Honda NAVI. Te explicamos qué necesita tu moto, cuánto demora y
                cuánto cuesta antes de empezar.
              </p>
              <p className="text-muted mt-4 leading-7">
                Trabajamos con atención cercana y cuidamos cada detalle para que
                vuelvas a rodar con confianza.
              </p>
              <p className="mt-6 flex items-center gap-2 text-sm">
                <Icon className="text-accent size-5 shrink-0" name="bike" />
                {CONTACT.address.street}, {BRAND.location}
              </p>
              <a
                className="landing-secondary-button mt-6"
                href={whatsappLink()}
                rel="noreferrer"
                target="_blank"
              >
                <Icon name="phone" />
                Hablar con el taller
              </a>
            </div>
          </div>
        </section>
      </main>
      <WhatsAppButton />
      <Footer />
    </div>
  );
}
