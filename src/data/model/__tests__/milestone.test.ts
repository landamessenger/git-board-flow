import { Milestone } from '../milestone';

describe('Milestone', () => {
  it('assigns id, title and description from constructor', () => {
    const m = new Milestone(1, 'v1.0', 'First release');
    expect(m.id).toBe(1);
    expect(m.title).toBe('v1.0');
    expect(m.description).toBe('First release');
  });
});
