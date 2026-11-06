const DEFAULT_TIME_SLOTS = ['09:00-10:30', '10:30-12:00', '14:30-16:00', '16:00-17:30'];

// Les horaires varient selon les cycles (une maternelle ne suit pas ceux du
// supérieur) : les lignes de la grille viennent des créneaux réels, sinon un
// créneau hors des plages habituelles serait enregistré mais jamais affiché.
export const timeSlotsOf = (schedules: { start_time: string; end_time: string }[]): string[] => {
  if (schedules.length === 0) return DEFAULT_TIME_SLOTS;
  const slots = new Set(schedules.map((s) => timeSlotOf(s)));
  return Array.from(slots).sort();
};

export const timeSlotOf = (schedule: { start_time: string; end_time: string }): string =>
  `${schedule.start_time.substring(0, 5)}-${schedule.end_time.substring(0, 5)}`;
