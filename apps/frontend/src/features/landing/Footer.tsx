import { Link } from 'react-router-dom';

import { BrandLogo } from '../../components/brand/BrandLogo';
import { Icon } from '../../components/ui/Icon';
import { BRAND } from '../../config/brand';
import { CONTACT, whatsappLink } from '../../config/contact';

const legalLinks = [
  { label: 'Bases legales', to: '/legal/bases-legales' },
  { label: 'Consultas', to: '/legal/consultas' },
  { label: 'Política de privacidad', to: '/legal/privacidad' },
  { label: 'Términos y condiciones', to: '/legal/terminos' },
];

/**
 * Site footer: brand, legal links, contact phone and attention hours, plus a
 * discreet address and social links. Intentionally low-key but informative.
 */
export function Footer() {
  return (
    <footer className="bg-lead-deep text-muted border-t border-white/10">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-10">
        <div className="flex flex-col items-center gap-6 text-center">
          <a aria-label="Inicio — Taller Mono Pistón" href="/">
            <BrandLogo size="lg" stacked />
          </a>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
            {legalLinks.map((link, index) => (
              <span className="flex items-center gap-4" key={link.to}>
                {index > 0 && (
                  <span aria-hidden="true" className="text-white/15">
                    |
                  </span>
                )}
                <Link className="hover:text-foreground transition" to={link.to}>
                  {link.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>

        <div className="mt-12 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-2 sm:gap-12">
          <div className="flex items-start gap-4 sm:justify-end sm:text-right">
            <Icon className="text-primary mt-1 size-6 shrink-0" name="phone" />
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-white uppercase">
                Contáctenos
              </p>
              <a
                className="hover:text-foreground mt-2 block text-lg font-bold text-white transition"
                href={whatsappLink()}
                rel="noreferrer"
                target="_blank"
              >
                {CONTACT.phoneDisplay}
              </a>
              <a
                className="hover:text-foreground mt-1 block text-sm transition"
                href={`mailto:${CONTACT.email}`}
              >
                {CONTACT.email}
              </a>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white uppercase">
              Horario de atención
            </p>
            <p className="mt-2 text-sm">{CONTACT.hours.weekday}</p>
            <p className="text-sm">{CONTACT.hours.saturday}</p>
          </div>
        </div>

        <p className="text-muted mt-12 border-t border-white/10 pt-8 text-center text-[11px]">
          © {new Date().getFullYear()} {BRAND.name} · Servicio técnico Honda
          NAVI · {BRAND.location}, Chile.
        </p>
      </div>
    </footer>
  );
}
