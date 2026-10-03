import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import { HeroCarousel } from './HeroCarousel';

describe('HeroCarousel', () => {
  let media: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    media = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const advance = () => act(() => vi.advanceTimersByTime(6000));
  const expectSlide = (number: number, filename: string) => {
    const slide = screen.getByRole('group', {
      name: new RegExp(`^${number} de 3:`),
    });
    expect(slide.querySelector('img')).toHaveAttribute(
      'src',
      `/images/${filename}`,
    );
    expect(
      screen.getByRole('button', {
        name: new RegExp(`^Ver fotografía ${number}:`),
      }),
    ).toHaveAttribute('aria-current', 'true');
  };

  it('rotates through three actual photographs and returns to the first', () => {
    render(<HeroCarousel>Contenido del taller</HeroCarousel>);
    expectSlide(1, 'navi-service-hero.webp');
    advance();
    expectSlide(2, 'navi-service-hero-2.webp');
    advance();
    expectSlide(3, 'navi-service-hero-3.webp');
    advance();
    expectSlide(1, 'navi-service-hero.webp');
  });

  it('supports pause, direct selection and navigation across both ends', () => {
    render(<HeroCarousel>Contenido del taller</HeroCarousel>);
    const pause = screen.getByRole('button', { name: 'Pausar carrusel' });
    fireEvent.focus(pause);
    fireEvent.click(pause);
    advance();
    expectSlide(1, 'navi-service-hero.webp');
    fireEvent.click(
      screen.getByRole('button', { name: 'Fotografía anterior' }),
    );
    expectSlide(3, 'navi-service-hero-3.webp');
    fireEvent.click(
      screen.getByRole('button', { name: 'Fotografía siguiente' }),
    );
    expectSlide(1, 'navi-service-hero.webp');
    fireEvent.click(screen.getByRole('button', { name: /^Ver fotografía 2:/ }));
    advance();
    expectSlide(2, 'navi-service-hero-2.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar carrusel' }));
    advance();
    expectSlide(3, 'navi-service-hero-3.webp');
  });

  it('pauses on hover and stops when a visitor focuses the content', () => {
    render(
      <HeroCarousel>
        <a href="#servicios">Ver servicios</a>
      </HeroCarousel>,
    );
    const carousel = screen.getByRole('region', {
      name: 'Servicio especializado Honda NAVI',
    });
    fireEvent.mouseEnter(carousel);
    advance();
    expectSlide(1, 'navi-service-hero.webp');
    fireEvent.mouseLeave(carousel);
    advance();
    expectSlide(2, 'navi-service-hero-2.webp');
    fireEvent.focus(screen.getByRole('link', { name: 'Ver servicios' }));
    fireEvent.blur(screen.getByRole('link', { name: 'Ver servicios' }));
    advance();
    expectSlide(2, 'navi-service-hero-2.webp');
    expect(
      screen.getByRole('button', { name: 'Reanudar carrusel' }),
    ).toBeInTheDocument();
  });

  it('starts paused with reduced motion and allows an explicit opt-in', () => {
    media.matches = true;
    render(<HeroCarousel>Contenido del taller</HeroCarousel>);
    advance();
    expectSlide(1, 'navi-service-hero.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar carrusel' }));
    advance();
    expectSlide(2, 'navi-service-hero-2.webp');
    const change = media.addEventListener.mock.calls[0]?.[1] as
      (() => void) | undefined;
    if (!change) throw new Error('Missing motion preference listener');
    act(() => change());
    advance();
    expectSlide(2, 'navi-service-hero-2.webp');
  });

  it('suspends rotation in a hidden tab and resumes when visible', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    render(<HeroCarousel>Contenido del taller</HeroCarousel>);
    hidden.mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    advance();
    expectSlide(1, 'navi-service-hero.webp');
    hidden.mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    advance();
    expectSlide(2, 'navi-service-hero-2.webp');
  });

  it('stops outside the viewport and cleans up when leaving the page', () => {
    let observeVisibility: (entries: { isIntersecting: boolean }[]) => void;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn(function (callback) {
        observeVisibility = callback;
        return { observe: vi.fn(), disconnect };
      }),
    );
    const { unmount } = render(
      <HeroCarousel>Contenido del taller</HeroCarousel>,
    );
    act(() => observeVisibility([{ isIntersecting: false }]));
    advance();
    expectSlide(1, 'navi-service-hero.webp');
    act(() => observeVisibility([{ isIntersecting: true }]));
    advance();
    expectSlide(2, 'navi-service-hero-2.webp');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
