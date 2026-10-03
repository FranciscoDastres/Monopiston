import { BrandLogo } from '../../components/brand/BrandLogo';
import { Icon } from '../../components/ui/Icon';
import { CONTACT } from '../../config/contact';

/** Keep the brand legible; utility details progressively appear with space. */
export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="bg-background text-foreground border-b border-white/15">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:h-[88px] sm:px-6 lg:px-10">
        <a aria-label="Inicio — Taller Mono Pistón" href="/">
          <BrandLogo />
        </a>
        <div className="flex items-center justify-end gap-5 lg:gap-8">
          <a
            className="hidden text-right sm:block"
            href={`tel:${CONTACT.whatsappNumber}`}
          >
            <span className="text-muted block text-xs">Contáctanos</span>
            <span className="block text-sm font-bold">
              {CONTACT.phoneDisplay}
            </span>
          </a>
          <div className="hidden border-l border-white/20 pl-8 text-right lg:block">
            <span className="text-muted block text-xs">
              Horario de atención
            </span>
            <span className="block text-sm font-semibold">
              {CONTACT.hours.weekday}
            </span>
            <span className="text-muted block text-xs">
              {CONTACT.hours.saturday}
            </span>
          </div>
          <button
            aria-label="Abrir menú"
            className="text-foreground flex size-11 items-center justify-center rounded-lg border border-white/20 transition hover:bg-white/10 sm:w-auto sm:gap-3 sm:px-4"
            onClick={onMenuClick}
            type="button"
          >
            <Icon name="menu" />
            <span className="hidden text-xs font-semibold sm:inline">Menú</span>
          </button>
        </div>
      </div>
    </div>
  );
}
