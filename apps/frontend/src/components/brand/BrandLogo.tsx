import { BRAND } from '../../config/brand';

const sizes = {
  sm: { image: 'h-11 w-12', name: 'text-sm' },
  md: { image: 'h-14 w-16 sm:h-16 sm:w-[72px]', name: 'text-base sm:text-lg' },
  lg: { image: 'h-24 w-28', name: 'text-xl' },
};

/** Shared workshop identity for the public site and authenticated pages. */
export function BrandLogo({
  size = 'md',
  stacked = false,
  className = '',
}: {
  size?: keyof typeof sizes;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`text-foreground inline-flex shrink-0 items-center gap-3 ${stacked ? 'flex-col text-center' : ''} ${className}`}
    >
      <img
        alt={BRAND.name}
        className={`shrink-0 object-contain ${sizes[size].image}`}
        decoding="async"
        height="454"
        src={BRAND.logo}
        width="512"
      />
      <span aria-hidden="true" className="font-display leading-tight">
        <span className="text-muted block text-[10px] font-semibold tracking-[0.14em] uppercase">
          Taller
        </span>
        <span
          className={`block font-extrabold whitespace-nowrap ${sizes[size].name}`}
        >
          Mono Pistón
        </span>
      </span>
    </span>
  );
}
