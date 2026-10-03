import type { ReactNode } from 'react';

import FramerCarouselThumbnails from '@/components/ui/framer-thumnbails';

const photos = [
  {
    id: 'navi-taller',
    src: '/images/navi-service-hero.webp',
    title: 'Moto roja en el taller',
    width: 1920,
    height: 1081,
  },
  {
    id: 'navi-mural',
    src: '/images/navi-service-hero-2.webp',
    title: 'Honda NAVI roja frente a un mural',
    width: 1600,
    height: 900,
  },
  {
    id: 'navi-accesorios',
    src: '/images/navi-service-hero-3.webp',
    title: 'Honda NAVI con accesorios en un estudio',
    width: 1920,
    height: 1080,
  },
] as const;

export function HeroCarousel({ children }: { children: ReactNode }) {
  return (
    <FramerCarouselThumbnails
      ariaLabel="Servicio especializado Honda NAVI"
      autoPlay
      className="landing-hero"
      items={photos}
    >
      {children}
    </FramerCarouselThumbnails>
  );
}
