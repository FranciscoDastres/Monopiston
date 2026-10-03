import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Icon } from '../../components/ui/Icon';

const slides = [
  {
    src: '/images/navi-service-hero.webp',
    description: 'Moto roja en el taller',
    width: 1920,
    height: 1081,
  },
  {
    src: '/images/navi-service-hero-2.webp',
    description: 'Honda NAVI roja frente a un mural',
    width: 1600,
    height: 900,
  },
  {
    src: '/images/navi-service-hero-3.webp',
    description: 'Honda NAVI con accesorios en un estudio',
    width: 1920,
    height: 1080,
  },
] as const;

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const controlClass =
  'hover:bg-primary grid size-11 shrink-0 place-items-center rounded border border-white/20 text-white transition-colors';

export function HeroCarousel({ children }: { children: ReactNode }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [playing, setPlaying] = useState(
    () => !window.matchMedia?.(reducedMotionQuery).matches,
  );
  const [hovered, setHovered] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [inView, setInView] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const rotationButtonRef = useRef<HTMLButtonElement>(null);
  const rotating = playing && !hovered && pageVisible && inView;

  useEffect(() => {
    const media = window.matchMedia?.(reducedMotionQuery);
    const handleMotionChange = () => {
      if (media?.matches) setPlaying(false);
    };
    const handleVisibility = () => setPageVisible(!document.hidden);
    media?.addEventListener('change', handleMotionChange);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      media?.removeEventListener('change', handleMotionChange);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!sectionRef.current || typeof IntersectionObserver === 'undefined')
      return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(
      () => setActiveSlide((current) => (current + 1) % slides.length),
      6000,
    );
    return () => window.clearTimeout(timer);
  }, [activeSlide, rotating]);

  const selectSlide = (index: number) => {
    setActiveSlide((index + slides.length) % slides.length);
    setPlaying(false);
  };

  return (
    <section
      aria-label="Servicio especializado Honda NAVI"
      aria-roledescription="carrusel"
      className="landing-hero relative isolate overflow-hidden"
      onFocusCapture={(event) => {
        if (event.target !== rotationButtonRef.current) setPlaying(false);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      ref={sectionRef}
    >
      <div aria-live={rotating ? 'off' : 'polite'}>
        {slides.map((slide, index) => (
          <div
            aria-hidden={index !== activeSlide}
            aria-label={`${index + 1} de ${slides.length}: ${slide.description}`}
            aria-roledescription="diapositiva"
            className="landing-hero-slide absolute inset-0 -z-20"
            key={slide.src}
            role="group"
          >
            <img
              alt=""
              className="landing-hero-image size-full object-cover"
              decoding="async"
              fetchPriority={index === 0 ? 'high' : 'low'}
              height={slide.height}
              src={slide.src}
              width={slide.width}
            />
          </div>
        ))}
      </div>
      <div className="landing-hero-overlay pointer-events-none absolute inset-0 -z-10" />
      {children}
      <div
        aria-label="Controles de fotografías"
        className="absolute inset-x-5 bottom-4 mx-auto flex max-w-7xl justify-end sm:inset-x-6 lg:inset-x-10"
        role="group"
      >
        <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/60 p-2">
          <button
            aria-label={playing ? 'Pausar carrusel' : 'Reanudar carrusel'}
            className={controlClass}
            onClick={() => setPlaying((current) => !current)}
            ref={rotationButtonRef}
            type="button"
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button
            aria-label="Fotografía anterior"
            className={controlClass}
            onClick={() => selectSlide(activeSlide - 1)}
            type="button"
          >
            <Icon name="chevron-left" />
          </button>
          {slides.map((slide, index) => (
            <button
              aria-current={index === activeSlide ? 'true' : undefined}
              aria-label={`Ver fotografía ${index + 1}: ${slide.description}`}
              className="grid size-8 place-items-center rounded"
              key={slide.src}
              onClick={() => selectSlide(index)}
              type="button"
            >
              <span
                className={`h-1.5 rounded-full transition-all ${index === activeSlide ? 'bg-primary w-6' : 'w-2 bg-white/50'}`}
              />
            </button>
          ))}
          <button
            aria-label="Fotografía siguiente"
            className={controlClass}
            onClick={() => selectSlide(activeSlide + 1)}
            type="button"
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>
    </section>
  );
}
