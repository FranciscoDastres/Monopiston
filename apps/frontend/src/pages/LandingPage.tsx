import type { HealthResponse } from '@monopiston/contracts';
import { useEffect, useState, type MouseEvent } from 'react';

import { BookingModal } from '../features/appointments/BookingModal';
import { LoginModal } from '../features/auth/LoginModal';
import { Footer } from '../features/landing/Footer';
import { Icon, type IconName } from '../features/landing/Icon';
import { TopBar } from '../features/landing/TopBar';
import { WhatsAppButton } from '../features/landing/WhatsAppButton';

type ApiState = 'checking' | 'online' | 'offline';

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
  number: string;
  title: string;
}> = [
  {
    description:
      'Aceite, frenos, transmisión y puntos críticos revisados con una pauta clara.',
    icon: 'tool',
    number: '01',
    title: 'Mantención preventiva',
  },
  {
    description:
      'Identificamos el origen del problema y te explicamos el trabajo antes de comenzar.',
    icon: 'spark',
    number: '02',
    title: 'Diagnóstico integral',
  },
  {
    description:
      'Atención enfocada en resolver ajustes frecuentes sin sacrificar el estándar técnico.',
    icon: 'clock',
    number: '03',
    title: 'Servicio express',
  },
];

// Hero carousel slides. They share one NAVI photo with a different color filter
// per slide (so the bike shows in distinct colors). Swap `image` per slide for
// real photos in /images when available.
const HERO_IMAGE = '/images/navi-service-hero.webp';
const heroSlides: Array<{
  eyebrow: string;
  filter: string;
  image: string;
  position: string;
  subtitle: string;
  titleAccent: string;
  titleTop: string;
}> = [
  {
    eyebrow: 'Especialistas en Honda NAVI',
    filter: 'none',
    image: HERO_IMAGE,
    position: '62% center',
    subtitle:
      'Agenda mantenciones, sigue cada avance y conserva el historial completo de tu moto en un solo lugar.',
    titleAccent: 'volver a rodar.',
    titleTop: 'Tu NAVI lista para',
  },
  {
    eyebrow: 'Servicio experto',
    filter: 'hue-rotate(135deg) saturate(1.3)',
    image: HERO_IMAGE,
    position: '45% center',
    subtitle:
      'Mantención y diagnóstico con precio claro, para que tu NAVI nunca se detenga.',
    titleAccent: 'menos preocupaciones.',
    titleTop: 'Más kilómetros,',
  },
  {
    eyebrow: 'Lo divertido de la ciudad',
    filter: 'hue-rotate(255deg) saturate(1.25)',
    image: HERO_IMAGE,
    position: '78% center',
    subtitle:
      'Reserva online en un minuto y vuelve a la calle con tu NAVI a punto.',
    titleAccent: 'súbete a tu NAVI.',
    titleTop: 'La ciudad es tuya,',
  },
];

export function LandingPage() {
  const [apiState, setApiState] = useState<ApiState>('checking');
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [heroSlide, setHeroSlide] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const checkApi = async () => {
      try {
        const response = await fetch(`${API_URL}/health/live`, {
          signal: controller.signal,
        });
        const health = (await response.json()) as HealthResponse;
        setApiState(
          response.ok && health.status === 'ok' ? 'online' : 'offline',
        );
      } catch {
        if (!controller.signal.aborted) setApiState('offline');
      }
    };

    void checkApi();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      return;
    }
    const timer = window.setInterval(() => {
      setHeroSlide((current) => (current + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [heroSlide]);

  const goToSlide = (index: number) =>
    setHeroSlide((index + heroSlides.length) % heroSlides.length);
  const currentHeroSlide = heroSlides[heroSlide]!;

  const systemLabel =
    apiState === 'online'
      ? 'Sistema operativo'
      : apiState === 'offline'
        ? 'API sin conexión'
        : 'Verificando sistema';

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
      className="bg-background text-foreground min-h-screen overflow-x-clip"
      onClick={handleAnchorIntercept}
    >
      <BookingModal onClose={() => setBookingOpen(false)} open={bookingOpen} />
      <LoginModal onClose={() => setLoginOpen(false)} open={loginOpen} />
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/95 backdrop-blur-xl">
        <TopBar onMenuClick={() => setMenuOpen(true)} />

        <div className="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center px-5 sm:px-8 lg:px-12">
          <span aria-hidden="true" />
          <nav
            aria-label="Navegación de portada"
            className="hidden items-center justify-center gap-7 lg:flex"
          >
            <a className="landing-nav-link" href="#servicios">
              Servicios
            </a>
            <a className="landing-nav-link" href="#clientes">
              Clientes
            </a>
            <a className="landing-nav-link" href="#nosotros">
              Acerca de nosotros
            </a>
          </nav>

          <div className="flex items-center justify-end gap-3 sm:gap-4">
            <span
              className="hidden items-center gap-2 text-xs text-[#b8b8b8] md:flex"
              role="status"
            >
              <span
                className={`size-2 rounded-full ${
                  apiState === 'online'
                    ? 'bg-success shadow-[0_0_10px_var(--color-success)]'
                    : apiState === 'offline'
                      ? 'bg-primary'
                      : 'bg-warning animate-pulse'
                }`}
              />
              {systemLabel}
            </span>
            <a
              className="landing-secondary-button hidden sm:inline-flex"
              href={LOGIN_URL}
            >
              <Icon name="user" />
              Mi cuenta
            </a>
          </div>
        </div>
      </header>

      <div
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 transition duration-300 ${
          menuOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <button
          aria-label="Cerrar menú"
          className="absolute inset-0 size-full bg-black/75 backdrop-blur-[3px]"
          onClick={() => setMenuOpen(false)}
          tabIndex={menuOpen ? 0 : -1}
          type="button"
        />
        <aside
          aria-label="Menú principal"
          className={`absolute top-[108px] right-0 bottom-0 w-full max-w-sm border-l border-white/10 bg-[#0c0c0c] p-6 shadow-2xl transition-transform duration-300 sm:p-8 ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
            Navegación
          </p>
          <h2 className="mt-3 text-2xl">Todo para tu Navi</h2>
          <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
            {menuItems.map((item) => (
              <a
                className="group flex items-center gap-4 py-5"
                href={item.href}
                key={item.label}
                onClick={() => setMenuOpen(false)}
                tabIndex={menuOpen ? 0 : -1}
              >
                <span className="group-hover:border-primary group-hover:bg-primary grid size-11 shrink-0 place-items-center border border-white/10 bg-white/[0.04] text-white transition">
                  <Icon name={item.icon} />
                </span>
                <span>
                  <span className="font-display block text-sm font-bold tracking-[0.05em] uppercase">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs text-[#8f8f8f]">
                    {item.description}
                  </span>
                </span>
                <span className="text-primary ml-auto text-xl transition-transform group-hover:translate-x-1">
                  →
                </span>
              </a>
            ))}
          </div>
          <p className="mt-8 text-sm leading-6 text-[#9c9c9c]">
            Atención especializada para Honda Navi, con información clara antes,
            durante y después del servicio.
          </p>
        </aside>
      </div>

      <main id="top">
        <section
          aria-label="Destacados"
          aria-roledescription="carrusel"
          className="landing-hero relative isolate min-h-[calc(100svh-108px)] overflow-hidden"
        >
          {heroSlides.map((slide, index) => (
            <div
              aria-hidden="true"
              className={`absolute inset-0 -z-20 bg-cover bg-no-repeat transition-opacity duration-700 ${
                index === heroSlide ? 'opacity-100' : 'opacity-0'
              }`}
              key={index}
              style={{
                backgroundColor: '#171717',
                backgroundImage: `url('${slide.image}')`,
                backgroundPosition: slide.position,
                filter: slide.filter,
              }}
            />
          ))}
          <div className="landing-hero-overlay absolute inset-0 -z-10" />
          <div className="absolute inset-y-0 left-0 -z-10 hidden w-2/3 bg-[linear-gradient(105deg,rgba(0,0,0,.7),transparent)] lg:block" />

          <div className="bg-primary absolute top-6 right-6 z-10 hidden rounded-md px-3 py-2 shadow-lg sm:block">
            <span className="font-display text-sm font-black tracking-[0.18em] text-white">
              HONDA
            </span>
          </div>

          <button
            aria-label="Imagen anterior"
            className="absolute top-1/2 left-3 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/30 text-2xl leading-none text-white backdrop-blur transition hover:border-white hover:bg-black/55 sm:left-6"
            onClick={() => goToSlide(heroSlide - 1)}
            type="button"
          >
            ‹
          </button>
          <button
            aria-label="Imagen siguiente"
            className="absolute top-1/2 right-3 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/30 bg-black/30 text-2xl leading-none text-white backdrop-blur transition hover:border-white hover:bg-black/55 sm:right-6"
            onClick={() => goToSlide(heroSlide + 1)}
            type="button"
          >
            ›
          </button>

          <div className="mx-auto flex min-h-[calc(100svh-108px)] max-w-7xl items-end px-5 pt-20 pb-20 sm:px-6 lg:items-center lg:px-10 lg:py-24">
            <div className="max-w-3xl">
              <p className="text-primary mb-5 flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] uppercase sm:text-xs">
                <span className="bg-primary h-0.5 w-10" />
                {currentHeroSlide.eyebrow}
              </p>
              <h1 className="max-w-3xl text-[clamp(2.9rem,8vw,6.6rem)] leading-[0.9] font-extrabold tracking-[-0.045em] text-[#f4f4f4]">
                {currentHeroSlide.titleTop}
                <span className="text-primary block">
                  {currentHeroSlide.titleAccent}
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-[#c9c9c9] sm:text-lg sm:leading-8">
                {currentHeroSlide.subtitle}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a className="landing-primary-button" href={BOOKING_URL}>
                  <Icon name="calendar" />
                  Agendar una cita
                  <span aria-hidden="true">→</span>
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-medium text-[#d0d0d0]">
                {[
                  'Agenda 24/7',
                  'Seguimiento en vivo',
                  'Historial digital',
                ].map((item) => (
                  <span className="flex items-center gap-2" key={item}>
                    <span className="text-primary">
                      <Icon name="check" />
                    </span>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute right-6 bottom-6 z-10 flex gap-2">
            {heroSlides.map((slide, index) => (
              <button
                aria-current={index === heroSlide}
                aria-label={`Ir a la imagen ${index + 1}`}
                className={`h-2 rounded-full transition-all ${
                  index === heroSlide
                    ? 'bg-primary w-6'
                    : 'w-2 bg-white/50 hover:bg-white'
                }`}
                key={slide.position}
                onClick={() => goToSlide(index)}
                type="button"
              />
            ))}
          </div>
        </section>

        <section className="bg-[#f2f2f0] text-[#151515]" id="servicios">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-10">
            <div className="max-w-2xl">
              <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
                Servicios
              </h2>
              <p className="mt-5 text-lg leading-7 text-[#5a5a5a]">
                Cada uno con precio y duración a la vista. Eliges, agendas y
                listo.
              </p>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden border border-black/10 bg-black/10 md:grid-cols-3">
              {serviceCards.map((service) => (
                <article
                  className="group bg-[#f8f8f6] p-7 transition hover:bg-white sm:p-9"
                  key={service.number}
                >
                  <div className="flex items-start justify-between">
                    <span className="group-hover:bg-primary group-hover:border-primary grid size-12 place-items-center border border-black/10 text-[#1a1a1a] transition group-hover:text-white">
                      <Icon name={service.icon} />
                    </span>
                    <span className="font-display text-xs font-bold tracking-[0.14em] text-[#a4a4a4]">
                      {service.number}
                    </span>
                  </div>
                  <h3 className="mt-14 text-xl leading-tight">
                    {service.title}
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-[#686868]">
                    {service.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0b0b0b]" id="clientes">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-28 lg:px-10">
            <div className="max-w-2xl">
              <h2 className="text-4xl leading-[1.05] font-semibold tracking-tight text-white sm:text-6xl">
                Nuestros clientes
              </h2>
              <p className="mt-5 text-lg leading-7 text-[#a4a4a4]">
                Lo que dicen quienes ya confían el cuidado de su NAVI con
                nosotros.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {[
                {
                  context: 'NAVI 2023',
                  name: 'Camila Rojas',
                  quote:
                    'Reservé en un minuto y me fueron avisando cada avance. Mi moto quedó impecable.',
                },
                {
                  context: 'NAVI 2022',
                  name: 'Diego Fuentes',
                  quote:
                    'Precios claros desde el inicio, sin sorpresas. La atención fue rápida y honesta.',
                },
                {
                  context: 'NAVI 2024',
                  name: 'Valentina Soto',
                  quote:
                    'Pude agendar online y revisar el historial de mi moto cuando quise. Muy recomendados.',
                },
              ].map((testimonial) => (
                <figure
                  className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                  key={testimonial.name}
                >
                  <div
                    aria-hidden="true"
                    className="text-primary flex gap-0.5 text-sm"
                  >
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span key={index}>★</span>
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 leading-7 text-[#d6d6d6]">
                    “{testimonial.quote}”
                  </blockquote>
                  <figcaption className="mt-5 border-t border-white/10 pt-4">
                    <p className="font-semibold text-white">
                      {testimonial.name}
                    </p>
                    <p className="text-muted text-xs">{testimonial.context}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0a0a0a]" id="nosotros">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 sm:py-24 lg:px-10">
            <div className="max-w-3xl">
              <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
                Acerca de nosotros
              </p>
              <h2 className="mt-4 text-3xl leading-tight sm:text-5xl">
                Especialistas en tu Honda NAVI
              </h2>
              <p className="mt-6 text-lg leading-8 text-[#c9c9c9]">
                Somos un taller dedicado al servicio técnico de motocicletas
                Honda NAVI. Trabajamos con atención cercana y precios claros: te
                explicamos qué necesita tu moto, cuánto demora y cuánto cuesta
                antes de empezar.
              </p>
              <p className="text-muted mt-4 leading-8">
                Estamos partiendo, y por eso cada cliente importa: cuidamos tu
                NAVI como si fuera nuestra y te mantenemos informado en cada
                paso.
              </p>
            </div>
          </div>
        </section>
      </main>

      <WhatsAppButton />

      <Footer />
    </div>
  );
}
