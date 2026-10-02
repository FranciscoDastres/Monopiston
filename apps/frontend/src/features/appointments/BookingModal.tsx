import type {
  Appointment,
  AvailabilitySlot,
  Motorcycle,
  PaymentInitResponse,
  Service,
} from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { AppointmentCalendar } from './AppointmentCalendar';
import {
  getMaxBookableDate,
  getNextBookableDate,
  getToday,
  getWorkshopMinutes,
  isValidChileanPhone,
  LAST_APPOINTMENT_KEY,
  parseLocalDate,
} from './appointment-helpers';

const selectedDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'full',
});
const slotTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  hourCycle: 'h23',
  minute: '2-digit',
  timeZone: 'America/Santiago',
});

interface BookingModalProps {
  onClose: () => void;
  open: boolean;
}

/**
 * In-place appointment booking. Opens as an overlay over the current page
 * (no navigation). The workshop only services Honda NAVI, so there is no
 * motorcycle picker: the customer's NAVI is used, creating one if needed.
 */
export function BookingModal({ onClose, open }: BookingModalProps) {
  const { isLoading: authLoading, signInAsDeveloper, user } = useAuth();
  const queryClient = useQueryClient();
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(getNextBookableDate());
  const [selectedSlot, setSelectedSlot] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('+569');

  // Sign in transparently in local development when there is no session yet.
  useEffect(() => {
    if (import.meta.env.DEV && open && !user && !authLoading) {
      void signInAsDeveloper().catch(() => undefined);
    }
  }, [open, user, authLoading, signInAsDeveloper]);

  const services = useQuery({
    enabled: open,
    queryFn: () => apiClient.get<Service[]>('/v1/services'),
    queryKey: ['services'],
    staleTime: 5 * 60_000,
  });
  const motorcycles = useQuery({
    enabled: open && Boolean(user),
    queryFn: () => apiClient.get<Motorcycle[]>('/v1/motorcycles'),
    queryKey: ['motorcycles'],
  });
  const ensureMotorcycle = useMutation({
    mutationFn: () => apiClient.post<Motorcycle>('/v1/motorcycles', {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['motorcycles'] }),
  });
  const availability = useQuery({
    enabled: open && serviceIds.length > 0 && Boolean(date),
    queryFn: () =>
      apiClient.get<AvailabilitySlot[]>(
        `/v1/availability?date=${date}&serviceIds=${serviceIds.join(',')}`,
      ),
    queryKey: ['availability', date, serviceIds],
  });

  const motorcycleId = motorcycles.data?.[0]?.id ?? '';

  // Auto-provision the customer's Honda NAVI when they have none yet.
  useEffect(() => {
    if (
      open &&
      user &&
      motorcycles.isSuccess &&
      motorcycles.data.length === 0 &&
      ensureMotorcycle.isIdle
    ) {
      ensureMotorcycle.mutate();
    }
  }, [open, user, motorcycles.isSuccess, motorcycles.data, ensureMotorcycle]);

  const createAppointment = useMutation({
    mutationFn: async () => {
      const appointment = await apiClient.post<Appointment>(
        '/v1/appointments',
        {
          motorcycleId,
          serviceIds,
          startsAt: selectedSlot,
          whatsappPhone,
        },
      );
      window.localStorage.setItem(LAST_APPOINTMENT_KEY, appointment.id);
      const { redirectUrl } = await apiClient.post<PaymentInitResponse>(
        `/v1/appointments/${appointment.id}/payment`,
        {},
      );
      return redirectUrl;
    },
    onSuccess: (redirectUrl) => {
      window.location.assign(redirectUrl);
    },
  });

  const selectedServices = useMemo(
    () =>
      services.data?.filter((service) => serviceIds.includes(service.id)) ?? [],
    [serviceIds, services.data],
  );
  const totalPrice = selectedServices.reduce(
    (total, service) => total + service.price,
    0,
  );
  const totalMinutes = selectedServices.reduce(
    (total, service) => total + service.durationMinutes,
    0,
  );
  const estimatedReadyAt =
    selectedSlot && totalMinutes > 0
      ? new Date(new Date(selectedSlot).getTime() + totalMinutes * 60_000)
      : null;
  const availableSlots = availability.data ?? [];
  const morningSlots = availableSlots.filter(
    (slot) => getWorkshopMinutes(slot.startsAt) < 14 * 60,
  );
  const afternoonSlots = availableSlots.filter(
    (slot) => getWorkshopMinutes(slot.startsAt) >= 15 * 60,
  );

  if (!open) return null;

  const toggleService = (id: string) => {
    setSelectedSlot('');
    createAppointment.reset();
    setServiceIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const preparingSession = !user || (motorcycles.isSuccess && !motorcycleId);

  // Production customers enter through Google; never call the development endpoint.
  if (!user && !authLoading && !import.meta.env.DEV) {
    return (
      <Modal
        onClose={onClose}
        open={open}
        title="Agendar una cita"
        eyebrow="Tu Honda NAVI"
      >
        <p className="text-muted text-sm">
          Accede con tu cuenta de Google para reservar y conservar el historial
          de tu moto.
        </p>
        <Button
          className="mt-6 w-full"
          onClick={() =>
            window.location.assign(
              `${import.meta.env.VITE_API_URL ?? ''}/v1/auth/google?returnTo=/app/appointments`,
            )
          }
        >
          Acceder con Google
        </Button>
      </Modal>
    );
  }

  return (
    <div
      aria-label="Agendar una cita"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="bg-surface relative my-auto w-full max-w-4xl rounded-3xl border border-white/10 p-6 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Cerrar"
          className="text-muted hover:border-primary hover:text-foreground absolute top-5 right-5 grid size-10 place-items-center rounded-full border border-white/10 text-lg transition"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>

        <p className="text-accent text-sm font-semibold">Agenda online</p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">
          Reserva para tu Honda NAVI
        </h2>
        <p className="text-muted mt-2 text-sm">
          Elige los servicios y un bloque de 45 minutos. Tu NAVI ya está
          registrada.
        </p>

        {createAppointment.isSuccess ? (
          <div className="border-success/30 bg-success/10 mt-8 rounded-2xl border p-6 text-center">
            <p className="text-success text-lg font-bold">¡Cita reservada!</p>
            <p className="text-muted mt-2 text-sm">
              Te esperamos para tu Honda NAVI. Puedes seguir el avance desde tu
              panel.
            </p>
            <button
              className="bg-primary mt-6 rounded-xl px-6 py-3 text-sm font-bold text-white"
              onClick={onClose}
              type="button"
            >
              Listo
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
              <section>
                <h3 className="text-sm font-bold tracking-[0.04em] uppercase">
                  1. Servicios
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {services.data?.map((service) => (
                    <label
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        serviceIds.includes(service.id)
                          ? 'border-accent bg-accent/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                      key={service.id}
                    >
                      <input
                        checked={serviceIds.includes(service.id)}
                        className="sr-only"
                        onChange={() => toggleService(service.id)}
                        type="checkbox"
                      />
                      <span className="font-semibold">{service.name}</span>
                      <span className="text-muted mt-2 block text-xs">
                        {service.durationMinutes} min · $
                        {service.price.toLocaleString('es-CL')}
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold tracking-[0.04em] uppercase">
                    2. Fecha y horario
                  </h3>
                  <span className="border-primary/30 bg-primary/10 text-primary rounded-full border px-3 py-1 text-xs font-semibold">
                    09:30–18:00
                  </span>
                </div>

                <div className="mt-4 grid gap-5 md:grid-cols-[minmax(260px,.85fr)_1.15fr]">
                  <AppointmentCalendar
                    maxDate={getMaxBookableDate()}
                    minDate={getToday()}
                    onChange={(nextDate) => {
                      setDate(nextDate);
                      setSelectedSlot('');
                      createAppointment.reset();
                    }}
                    value={date}
                  />

                  <div>
                    <p className="font-display text-sm font-bold capitalize">
                      {selectedDateFormatter.format(parseLocalDate(date))}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      La colación de 14:00 a 15:00 no admite reservas.
                    </p>

                    {serviceIds.length === 0 ? (
                      <div className="mt-4 rounded-xl border border-dashed border-white/15 p-5 text-center">
                        <p className="text-sm font-semibold">
                          Selecciona al menos un servicio
                        </p>
                      </div>
                    ) : availability.isFetching ? (
                      <div
                        aria-label="Buscando horarios"
                        className="mt-4 grid grid-cols-3 gap-2"
                      >
                        {Array.from({ length: 6 }).map((_, index) => (
                          <span
                            className="h-11 animate-pulse rounded-xl bg-white/5"
                            key={index}
                          />
                        ))}
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="mt-4 space-y-5">
                        <SlotGroup
                          label="Mañana"
                          onSelect={(slot) => {
                            setSelectedSlot(slot);
                            createAppointment.reset();
                          }}
                          selectedSlot={selectedSlot}
                          slots={morningSlots}
                        />
                        <div className="text-muted flex items-center gap-3 text-[10px] font-semibold tracking-[0.12em] uppercase">
                          <span className="h-px flex-1 bg-white/10" />
                          Colación · 14:00–15:00
                          <span className="h-px flex-1 bg-white/10" />
                        </div>
                        <SlotGroup
                          label="Tarde"
                          onSelect={(slot) => {
                            setSelectedSlot(slot);
                            createAppointment.reset();
                          }}
                          selectedSlot={selectedSlot}
                          slots={afternoonSlots}
                        />
                      </div>
                    ) : (
                      <div className="border-primary/20 bg-primary/5 mt-4 rounded-xl border p-4">
                        <p className="text-sm font-semibold">
                          No quedan horarios este día.
                        </p>
                        <p className="text-muted mt-1 text-xs">
                          Elige otra fecha en el calendario.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <aside className="border-accent/20 bg-background h-fit rounded-2xl border p-5">
              <h3 className="font-bold">Resumen</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Servicios</dt>
                  <dd>{selectedServices.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Duración</dt>
                  <dd>{totalMinutes} min</dd>
                </div>
                {estimatedReadyAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Lista aprox.</dt>
                    <dd className="font-semibold">
                      {slotTimeFormatter.format(estimatedReadyAt)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
                  <dt className="font-semibold">Total</dt>
                  <dd className="text-primary font-black">
                    ${totalPrice.toLocaleString('es-CL')}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <label
                  className="text-muted block text-xs font-semibold"
                  htmlFor="booking-whatsapp"
                >
                  WhatsApp para coordinación
                </label>
                <input
                  autoComplete="tel"
                  className="border-accent/30 bg-surface mt-2 w-full rounded-xl border px-4 py-2.5 text-sm"
                  id="booking-whatsapp"
                  inputMode="tel"
                  onChange={(event) => setWhatsappPhone(event.target.value)}
                  placeholder="+56 9 1234 5678"
                  type="tel"
                  value={whatsappPhone}
                />
              </div>

              {createAppointment.isError && (
                <p className="text-primary mt-4 text-sm" role="alert">
                  No pudimos iniciar el pago. Revisa el horario y tu número.
                </p>
              )}

              <button
                className="bg-primary mt-5 w-full rounded-xl px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={
                  preparingSession ||
                  serviceIds.length === 0 ||
                  !selectedSlot ||
                  !isValidChileanPhone(whatsappPhone) ||
                  createAppointment.isPending
                }
                onClick={() => createAppointment.mutate()}
                type="button"
              >
                {createAppointment.isPending
                  ? 'Redirigiendo al pago…'
                  : preparingSession
                    ? 'Preparando…'
                    : 'Confirmar y pagar'}
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function SlotGroup({
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
      <div className="mt-2 grid grid-cols-3 gap-2">
        {slots.map((slot) => (
          <button
            aria-pressed={selectedSlot === slot.startsAt}
            className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition ${
              selectedSlot === slot.startsAt
                ? 'border-primary bg-primary text-white'
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
