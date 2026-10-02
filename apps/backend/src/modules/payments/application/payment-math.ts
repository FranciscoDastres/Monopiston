import type { PaymentSettings } from '@monopiston/contracts';

const IVA_RATE = 0.19;

// Amounts are whole CLP pesos (the `*_cents` columns hold pesos, not cents).
export function computeChargeAmount(
  total: number,
  settings: PaymentSettings,
): number {
  switch (settings.mode) {
    case 'total':
      return total;
    case 'deposit_fixed':
      return Math.min(settings.depositFixed, total);
    case 'deposit_pct':
      return Math.round((total * settings.depositPercent) / 100);
  }
}

// Chilean prices are IVA-inclusive: net = gross / 1.19, iva = gross - net.
export function computeTaxBreakdown(gross: number): {
  iva: number;
  net: number;
} {
  const net = Math.round(gross / (1 + IVA_RATE));
  return { iva: gross - net, net };
}
