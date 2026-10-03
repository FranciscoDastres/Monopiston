import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { animate, LazyMotion, useMotionValue } from 'motion/react';
import * as m from 'motion/react-m';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/lib/utils';

interface CarouselItem {
  id: string;
  src: string;
  title: string;
  width: number;
  height: number;
}
interface CarouselProps {
  items: readonly CarouselItem[];
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
  autoPlay?: boolean;
  intervalMs?: number;
}
const loadMotionFeatures = () =>
  import('./carousel-motion-features').then((module) => module.default);
const motionQuery = '(prefers-reduced-motion: reduce)';
const controlClass =
  'hover:bg-primary grid size-11 shrink-0 place-items-center rounded-lg border border-white/20 bg-black/50 text-white transition-colors';

/** Thumbnail and drag interaction adapted to the workshop's existing hero. */
export default function FramerCarouselThumbnails({
  items,
  children,
  className,
  ariaLabel = 'Fotografías del taller',
  autoPlay = false,
  intervalMs = 6000,
}: CarouselProps) {
  const count = items.length;
  // Duplicate boundaries keep the loop moving in the same direction.
  const [position, setPosition] = useState(1);
  const index = count ? (((position - 1) % count) + count) % count : 0;
  const [dragging, setDragging] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.(motionQuery).matches ?? false,
  );
  const [playing, setPlaying] = useState(() => autoPlay && !reducedMotion);
  const [hovered, setHovered] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [inView, setInView] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef<HTMLButtonElement>(null);
  const previousWidth = useRef(0);
  const x = useMotionValue(0);
  const rotating =
    count > 1 && playing && !hovered && !dragging && pageVisible && inView;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setPosition(1);
    const measure = () =>
      setViewportWidth(viewport.getBoundingClientRect().width);
    x.set(-viewport.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [count, x]);

  useEffect(() => {
    const media = window.matchMedia?.(motionQuery);
    const handleMotionChange = () => {
      setReducedMotion(media?.matches ?? false);
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
    if (dragging || !viewportWidth || !count) return;
    const resized = previousWidth.current !== viewportWidth;
    previousWidth.current = viewportWidth;
    const settle = () => {
      if (position === 0) {
        x.set(-count * viewportWidth);
        setPosition(count);
      } else if (position === count + 1) {
        x.set(-viewportWidth);
        setPosition(1);
      }
    };
    const target = -position * viewportWidth;
    if (resized || reducedMotion) {
      x.set(target);
      settle();
      return;
    }
    let cancelled = false;
    const animation = animate(x, target, {
      type: 'spring',
      stiffness: 300,
      damping: 30,
      restDelta: 0.5,
    });
    void animation.then(() => {
      if (!cancelled) settle();
    });
    return () => {
      cancelled = true;
      animation.stop();
    };
  }, [count, dragging, position, reducedMotion, viewportWidth, x]);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setPosition(index + 2), intervalMs);
    return () => window.clearTimeout(timer);
  }, [index, intervalMs, rotating]);

  useEffect(() => {
    const rail = thumbnailsRef.current;
    const active = rail?.querySelector<HTMLButtonElement>(
      '[aria-current="true"]',
    );
    if (!rail || !active) return;
    rail.scrollTo?.({
      left: active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2,
      behavior: reducedMotion ? 'instant' : 'smooth',
    });
  }, [index, reducedMotion, viewportWidth]);

  const select = (nextIndex: number) => {
    setPlaying(false);
    setPosition(nextIndex + 1);
  };
  const step = (direction: number) => {
    setPlaying(false);
    setPosition(index + 1 + direction);
  };
  if (!count) return null;
  const track = [items[count - 1]!, ...items, items[0]!];

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <section
        aria-label={ariaLabel}
        aria-roledescription="carrusel"
        className={cn('relative isolate overflow-hidden', className)}
        onFocusCapture={(event) => {
          if (event.target !== rotationRef.current) setPlaying(false);
        }}
        onKeyDown={(event) => {
          if (
            (event.target as HTMLElement).closest('a, input, textarea, select')
          )
            return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            step(event.key === 'ArrowLeft' ? -1 : 1);
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            select(event.key === 'Home' ? 0 : count - 1);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        ref={sectionRef}
      >
        <div
          aria-label="Galería de fotografías"
          className="absolute inset-0 overflow-hidden outline-offset-[-4px]"
          ref={viewportRef}
          role="group"
          tabIndex={count > 1 ? 0 : undefined}
        >
          <m.div
            className="flex h-full cursor-grab touch-pan-y active:cursor-grabbing"
            drag={count > 1 ? 'x' : false}
            dragConstraints={{ left: -(count + 1) * viewportWidth, right: 0 }}
            dragElastic={0.15}
            dragMomentum={false}
            onDragStart={() => {
              setDragging(true);
              setPlaying(false);
            }}
            onDragEnd={(_event, info) => {
              const offset = info.offset.x;
              const velocity = info.velocity.x;
              if (Math.abs(velocity) > 500) step(velocity > 0 ? -1 : 1);
              else if (Math.abs(offset) > viewportWidth * 0.2)
                step(offset > 0 ? -1 : 1);
              setDragging(false);
            }}
            style={{ x }}
          >
            {track.map((item, trackIndex) => {
              const duplicate = trackIndex === 0 || trackIndex === count + 1;
              const active = !duplicate && trackIndex - 1 === index;
              return (
                <div
                  aria-hidden={!active}
                  aria-label={
                    duplicate
                      ? undefined
                      : `${trackIndex} de ${count}: ${item.title}`
                  }
                  aria-roledescription={duplicate ? undefined : 'diapositiva'}
                  className="h-full w-full shrink-0"
                  key={`${item.id}-${trackIndex}`}
                  role={duplicate ? undefined : 'group'}
                >
                  <img
                    alt=""
                    className="landing-hero-image pointer-events-none size-full object-cover select-none"
                    decoding="async"
                    draggable={false}
                    fetchPriority={item.id === items[0]!.id ? 'high' : 'low'}
                    height={item.height}
                    src={item.src}
                    width={item.width}
                  />
                </div>
              );
            })}
          </m.div>
        </div>
        <div className="landing-hero-overlay pointer-events-none absolute inset-0" />
        <div className="pointer-events-none relative min-h-[inherit]">
          {children ?? <div className="aspect-video min-h-80" />}
        </div>
        <div
          aria-label="Controles de fotografías"
          className="absolute inset-x-5 bottom-5 z-20 mx-auto flex max-w-7xl flex-col items-end gap-3 sm:inset-x-6 sm:flex-row sm:items-center sm:justify-end lg:inset-x-10"
          role="group"
        >
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <span
              aria-hidden="true"
              className="mr-auto text-xs font-semibold text-white/70 tabular-nums sm:mr-2"
            >
              {String(index + 1).padStart(2, '0')} /{' '}
              {String(count).padStart(2, '0')}
            </span>
            <button
              aria-label={playing ? 'Pausar carrusel' : 'Reanudar carrusel'}
              className={controlClass}
              disabled={count < 2}
              onClick={() => setPlaying((current) => !current)}
              ref={rotationRef}
              type="button"
            >
              {playing ? (
                <Pause aria-hidden size={18} />
              ) : (
                <Play aria-hidden size={18} />
              )}
            </button>
            <button
              aria-label="Fotografía anterior"
              className={controlClass}
              disabled={count < 2}
              onClick={() => step(-1)}
              type="button"
            >
              <ChevronLeft aria-hidden size={20} />
            </button>
            <button
              aria-label="Fotografía siguiente"
              className={controlClass}
              disabled={count < 2}
              onClick={() => step(1)}
              type="button"
            >
              <ChevronRight aria-hidden size={20} />
            </button>
          </div>
          <div
            className="carousel-thumbnails max-w-full overflow-x-auto p-1"
            ref={thumbnailsRef}
          >
            <div className="flex w-max items-center gap-1">
              {items.map((item, itemIndex) => (
                <m.button
                  animate={{ width: itemIndex === index ? 120 : 44 }}
                  aria-current={itemIndex === index ? 'true' : undefined}
                  aria-label={`Ver fotografía ${itemIndex + 1}: ${item.title}`}
                  className={cn(
                    'relative h-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors sm:h-16',
                    itemIndex === index
                      ? 'border-primary'
                      : 'border-white/30 hover:border-white/70',
                  )}
                  initial={false}
                  key={item.id}
                  onClick={() => select(itemIndex)}
                  transition={{
                    duration: reducedMotion ? 0 : 0.3,
                    ease: 'easeOut',
                  }}
                  type="button"
                >
                  <img
                    alt=""
                    className="pointer-events-none size-full object-cover select-none"
                    decoding="async"
                    draggable={false}
                    height={item.height}
                    src={item.src}
                    width={item.width}
                  />
                </m.button>
              ))}
            </div>
          </div>
        </div>
        <p
          aria-atomic="true"
          aria-live={rotating ? 'off' : 'polite'}
          className="sr-only"
        >
          Fotografía {index + 1} de {count}: {items[index]!.title}
        </p>
      </section>
    </LazyMotion>
  );
}
