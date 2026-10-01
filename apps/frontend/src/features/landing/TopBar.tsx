import { type ReactNode } from 'react';

import { CONTACT } from '../../config/contact';
import { BrandLogo } from './BrandLogo';
import { FacebookIcon, InstagramIcon } from './social-icons';

/**
 * Honda-inspired utility bar on a neutral lead background:
 * centered brand, menu on the left and social links,
 * the contact phone and the attention hours — using the full width.
 */
export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div className="bg-background text-foreground border-b border-white/15">
      <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center px-5 sm:px-8 lg:px-12">
        <button
          aria-label="Abrir menú"
          className="text-foreground flex min-h-11 items-center gap-3 justify-self-start px-2 transition hover:bg-white/10"
          onClick={onMenuClick}
          type="button"
        >
          <MenuIcon />
          <span className="hidden text-xs font-semibold sm:inline">Menú</span>
        </button>

        <a aria-label="Inicio" className="justify-self-center" href="#top">
          <BrandLogo />
        </a>

        <div className="flex items-center justify-end gap-5 sm:gap-8">
          <div className="flex items-center gap-2">
            <SocialLink href={CONTACT.social.facebook} label="Facebook">
              <FacebookIcon />
            </SocialLink>
            <SocialLink href={CONTACT.social.instagram} label="Instagram">
              <InstagramIcon />
            </SocialLink>
          </div>

          <a
            className="hidden text-right sm:block"
            href={`tel:${CONTACT.whatsappNumber}`}
          >
            <span className="text-muted block text-[11px] font-semibold tracking-[0.14em] uppercase">
              Contáctanos
            </span>
            <span className="block text-sm font-bold">
              {CONTACT.phoneDisplay}
            </span>
          </a>

          <div className="hidden border-l border-white/20 pl-5 text-right sm:pl-8 md:block">
            <span className="text-muted block text-[11px] font-semibold tracking-[0.14em] uppercase">
              Horario de atención
            </span>
            <span className="block text-sm font-bold">
              {CONTACT.hours.weekday}
            </span>
            <span className="text-muted block text-xs font-semibold">
              {CONTACT.hours.saturday}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  return (
    <a
      aria-label={`Síguenos en ${label}`}
      className="text-foreground grid size-9 place-items-center rounded-full border border-white/20 transition hover:border-white/40 hover:bg-white/10"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="18"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
