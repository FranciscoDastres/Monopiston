/**
 * Single source of truth for the workshop's public contact details, reused by
 * the top bar and the WhatsApp button.
 */
export const CONTACT = {
  /** Workshop address. */
  address: {
    area: 'Comuna de Santiago, Región Metropolitana',
    street: 'Rosas 2871',
  },
  /** Human-readable attention hours, shown on two lines. */
  hours: {
    saturday: 'Sáb · 09:30–14:00',
    weekday: 'Lun a Vie · 09:30–18:30',
  },
  /** Contact email for inquiries and data requests (placeholder). */
  email: 'contacto@monopiston.cl',
  /** Phone shown under "Contáctanos". */
  phoneDisplay: '+56 9 7319 6187',
  /** WhatsApp number in international format, digits only (for wa.me links). */
  whatsappNumber: '56973196187',
} as const;

/** Builds a wa.me link, optionally with a prefilled message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${CONTACT.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
