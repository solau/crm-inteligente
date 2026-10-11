import { calculateLeadPriority } from '../priorityLogic';

describe('calculateLeadPriority', () => {
  const refDate = new Date('2026-10-10T12:00:00Z');

  test('deve classificar como ALTA quando >= 26 participantes e evento dentro de 60 dias', () => {
    // 30 dias no futuro
    const eventDate = new Date('2026-11-10T12:00:00Z');
    const priority = calculateLeadPriority({
      expectedGuests: 50,
      eventDate,
      referenceDate: refDate
    });
    expect(priority).toBe('ALTA');
  });

  test('deve classificar como MEDIA quando 15 a 25 participantes com data futura', () => {
    const eventDate = new Date('2026-11-20T12:00:00Z');
    const priority = calculateLeadPriority({
      expectedGuests: 20,
      eventDate,
      referenceDate: refDate
    });
    expect(priority).toBe('MEDIA');
  });

  test('deve classificar como MEDIA quando >= 26 participantes mas data > 60 dias', () => {
    const eventDate = new Date('2027-02-15T12:00:00Z');
    const priority = calculateLeadPriority({
      expectedGuests: 80,
      eventDate,
      referenceDate: refDate
    });
    expect(priority).toBe('MEDIA');
  });

  test('deve classificar como EM_NUTRICAO quando sem data prevista', () => {
    const priority = calculateLeadPriority({
      expectedGuests: 40,
      eventDate: null,
      referenceDate: refDate
    });
    expect(priority).toBe('EM_NUTRICAO');
  });

  test('deve classificar como OUTRAS quando menos de 15 convidados', () => {
    const eventDate = new Date('2026-11-05T12:00:00Z');
    const priority = calculateLeadPriority({
      expectedGuests: 10,
      eventDate,
      referenceDate: refDate
    });
    expect(priority).toBe('OUTRAS');
  });
});
