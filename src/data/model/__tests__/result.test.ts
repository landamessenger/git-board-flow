import { Result } from '../result';

describe('Result', () => {
  it('uses defaults for missing fields', () => {
    const r = new Result({});
    expect(r.id).toBe('');
    expect(r.success).toBe(false);
    expect(r.executed).toBe(false);
    expect(r.steps).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.reminders).toEqual([]);
    expect(r.payload).toBeUndefined();
  });

  it('assigns provided fields', () => {
    const r = new Result({
      id: 'Task1',
      success: true,
      executed: true,
      steps: ['Step 1'],
      payload: { key: 'value' },
      reminders: ['Reminder'],
      errors: [],
    });
    expect(r.id).toBe('Task1');
    expect(r.success).toBe(true);
    expect(r.executed).toBe(true);
    expect(r.steps).toEqual(['Step 1']);
    expect(r.payload).toEqual({ key: 'value' });
    expect(r.reminders).toEqual(['Reminder']);
  });
});
