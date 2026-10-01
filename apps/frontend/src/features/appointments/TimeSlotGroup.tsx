import type { AvailabilitySlot } from '@monopiston/contracts';

import { slotTimeFormatter } from './appointment-formatters';

export function TimeSlotGroup({
  label,
  onSelect,
  selectedSlot,
  slots,
}: {
  label: string;
  onSelect: (slot: string) => void;
  selectedSlot: string;
  slots: AvailabilitySlot[];
}) {
  if (slots.length === 0) return null;

  return (
    <div>
      <p className="text-muted text-xs font-semibold tracking-[0.08em] uppercase">
        {label}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((slot) => (
          <button
            aria-pressed={selectedSlot === slot.startsAt}
            className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
              selectedSlot === slot.startsAt
                ? 'border-primary bg-primary text-white shadow-[0_8px_20px_rgba(230,0,35,.22)]'
                : 'hover:border-primary/60 hover:bg-primary/10 border-white/10 bg-white/[0.035]'
            }`}
            key={slot.startsAt}
            onClick={() => onSelect(slot.startsAt)}
            type="button"
          >
            {slotTimeFormatter.format(new Date(slot.startsAt))}
          </button>
        ))}
      </div>
    </div>
  );
}
