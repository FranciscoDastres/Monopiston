import type {
  Appointment,
  AvailabilitySlot,
  Motorcycle,
  PaymentInitResponse,
  Service,
} from '@monopiston/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { apiClient } from '../../lib/api-client';
import {
  getNextBookableDate,
  getWorkshopMinutes,
  LAST_APPOINTMENT_KEY,
} from './appointment-helpers';

export function useBookingFlow() {
  const queryClient = useQueryClient();
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState(getNextBookableDate());
  const [selectedSlot, setSelectedSlot] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('+569');

  const motorcycles = useQuery({
    queryFn: () => apiClient.get<Motorcycle[]>('/v1/motorcycles'),
    queryKey: ['motorcycles'],
  });
  const ensureMotorcycle = useMutation({
    mutationFn: () => apiClient.post<Motorcycle>('/v1/motorcycles', {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['motorcycles'] }),
  });
  const motorcycleId = motorcycles.data?.[0]?.id ?? '';

  useEffect(() => {
    if (
      motorcycles.isSuccess &&
      motorcycles.data.length === 0 &&
      ensureMotorcycle.isIdle
    ) {
      ensureMotorcycle.mutate();
    }
  }, [ensureMotorcycle, motorcycles.data, motorcycles.isSuccess]);

  const services = useQuery({
    queryFn: () => apiClient.get<Service[]>('/v1/services'),
    queryKey: ['services'],
    staleTime: 5 * 60_000,
  });
  const availability = useQuery({
    enabled: serviceIds.length > 0 && Boolean(date),
    queryFn: () =>
      apiClient.get<AvailabilitySlot[]>(
        `/v1/availability?date=${date}&serviceIds=${serviceIds.join(',')}`,
      ),
    queryKey: ['availability', date, serviceIds],
  });

  // Atomic flow: create the appointment (held as pending_payment), then
  // immediately open the Flow order and redirect. The appointment id is kept in
  // localStorage so the receipt can be reconstructed when the user returns.
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
  const availableSlots = availability.data ?? [];
  const morningSlots = availableSlots.filter(
    (slot) => getWorkshopMinutes(slot.startsAt) < 14 * 60,
  );
  const afternoonSlots = availableSlots.filter(
    (slot) => getWorkshopMinutes(slot.startsAt) >= 15 * 60,
  );

  const toggleService = (id: string) => {
    setSelectedSlot('');
    createAppointment.reset();
    setServiceIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const selectDate = (nextDate: string) => {
    setDate(nextDate);
    setSelectedSlot('');
    createAppointment.reset();
  };

  const selectSlot = (slot: string) => {
    setSelectedSlot(slot);
    createAppointment.reset();
  };

  return {
    afternoonSlots,
    availability,
    availableSlots,
    createAppointment,
    date,
    morningSlots,
    motorcycleId,
    selectDate,
    selectedServices,
    selectedSlot,
    selectSlot,
    serviceIds,
    services,
    setWhatsappPhone,
    toggleService,
    totalMinutes,
    totalPrice,
    whatsappPhone,
  };
}
