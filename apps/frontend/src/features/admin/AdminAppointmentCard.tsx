import type { AdminAppointment, Appointment } from '@monopiston/contracts';

import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { APPOINTMENT_STATUS_META } from '../../components/ui/status-meta';
import { agendaDateFormatter, agendaTimeFormatter } from './agenda-dates';

export function AdminAppointmentCard({
  appointment,
  onRegisterWork,
  onUpdateStatus,
  statusPending,
}: {
  appointment: AdminAppointment;
  onRegisterWork: (appointment: AdminAppointment) => void;
  onUpdateStatus: (id: string, status: Appointment['status']) => void;
  statusPending: boolean;
}) {
  const cancelled = ['cancelled', 'no_show'].includes(appointment.status);
  const requested = appointment.status === 'requested';
  const contactPhone = appointment.whatsappPhone ?? appointment.customer.phone;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
        <div className="flex min-w-[150px] items-center gap-3 lg:w-48">
          <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-xl">
            <Icon className="size-5" name="calendar" />
          </span>
          <div>
            <p className="font-semibold tabular-nums">
              {agendaTimeFormatter.format(new Date(appointment.startsAt))}
            </p>
            <p className="text-muted mt-0.5 text-xs">
              hasta {agendaTimeFormatter.format(new Date(appointment.endsAt))}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 border-white/8 lg:border-l lg:pl-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold tracking-normal normal-case">
              {appointment.customer.displayName}
            </h2>
            <Badge tone={APPOINTMENT_STATUS_META[appointment.status].tone}>
              {APPOINTMENT_STATUS_META[appointment.status].label}
            </Badge>
          </div>
          <p className="text-muted mt-1 truncate text-xs">
            {appointment.services.map((service) => service.name).join(', ')}
          </p>
          <p className="text-muted mt-1 text-xs">
            {agendaDateFormatter.format(new Date(appointment.startsAt))}
          </p>
          <p className="text-muted mt-1 flex flex-wrap gap-x-3 text-xs">
            <span className="inline-flex items-center gap-1">
              <Icon className="size-3.5" name="mail" />
              {appointment.customer.email}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon className="size-3.5" name="phone" />
              {contactPhone ?? 'Sin teléfono'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {contactPhone ? (
            <a
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/8 px-3.5 text-[0.7rem] font-semibold tracking-wide text-emerald-400 uppercase transition hover:bg-emerald-400/15"
              href={toWhatsAppUrl(
                contactPhone,
                appointment.customer.displayName,
                appointment.startsAt,
              )}
              rel="noreferrer"
              target="_blank"
            >
              <Icon className="size-4" name="phone" />
              WhatsApp
            </a>
          ) : (
            <span className="text-muted px-2 text-xs">Sin teléfono</span>
          )}
          {requested && (
            <Button
              disabled={statusPending}
              icon="check"
              onClick={() => onUpdateStatus(appointment.id, 'confirmed')}
              size="sm"
            >
              Confirmar
            </Button>
          )}
          {appointment.status === 'confirmed' && (
            <Button
              disabled={statusPending}
              icon="tool"
              onClick={() => onUpdateStatus(appointment.id, 'in_service')}
              size="sm"
            >
              Iniciar trabajo
            </Button>
          )}
          {appointment.status === 'in_service' && (
            <Button
              disabled={statusPending}
              icon="check"
              onClick={() => onUpdateStatus(appointment.id, 'ready')}
              size="sm"
            >
              Lista para retiro
            </Button>
          )}
          {!cancelled && canCancel(appointment.status) && (
            <Button
              disabled={statusPending}
              onClick={() => onUpdateStatus(appointment.id, 'cancelled')}
              size="sm"
              variant="danger"
            >
              Cancelar
            </Button>
          )}
          {!cancelled &&
            !['completed', 'no_show'].includes(appointment.status) && (
              <Button
                icon="tool"
                onClick={() => onRegisterWork(appointment)}
                size="sm"
                variant="secondary"
              >
                Registrar atención
              </Button>
            )}
        </div>
      </div>
    </Card>
  );
}

function toWhatsAppUrl(
  phone: string,
  customerName: string,
  startsAt: string,
): string {
  const rawDigits = phone.replace(/\D/g, '').replace(/^0+/, '');
  const digits = rawDigits.length === 9 ? `56${rawDigits}` : rawDigits;
  const message = `Hola ${customerName}, te contactamos de Taller Mono Pistón por tu cita del ${agendaDateFormatter.format(new Date(startsAt))}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function canCancel(status: Appointment['status']): boolean {
  return ['requested', 'confirmed', 'checked_in'].includes(status);
}
