import { ProjectDetail } from '../project_detail';

describe('ProjectDetail', () => {
  it('assigns fields from data object', () => {
    const data = {
      id: 'PVT_1',
      title: 'Sprint 1',
      type: 'beta',
      owner: 'org',
      url: 'https://github.com/org/repo/projects/1',
      number: 1,
    };
    const p = new ProjectDetail(data);
    expect(p.id).toBe('PVT_1');
    expect(p.title).toBe('Sprint 1');
    expect(p.type).toBe('beta');
    expect(p.owner).toBe('org');
    expect(p.url).toBe('https://github.com/org/repo/projects/1');
    expect(p.number).toBe(1);
  });

  it('uses empty string or -1 for missing fields', () => {
    const p = new ProjectDetail({});
    expect(p.id).toBe('');
    expect(p.title).toBe('');
    expect(p.type).toBe('');
    expect(p.owner).toBe('');
    expect(p.url).toBe('');
    expect(p.number).toBe(-1);
  });
});
