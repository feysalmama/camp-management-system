import { describe, it, expect } from 'vitest';
import { csv, nextStatuses } from '../src/lib/workflow';
describe('Workflow and exports', () => {
  it('gives viewers no status actions', () => expect(nextStatuses('open', 'viewer')).toEqual([]));
  it('reserves closure for managers', () => {
    expect(nextStatuses('resolved', 'camp-manager')).not.toContain('closed');
    expect(nextStatuses('resolved', 'supervisor')).toContain('closed');
  });
  it('never offers transitions for closed incidents', () =>
    expect(nextStatuses('closed', 'company-admin')).toEqual([]));
  it('escapes quotes, newlines and spreadsheet formulas in CSV', () => {
    const output = csv([{ title: '=HYPERLINK("evil")', detail: 'A,"B"\nC' }]);
    expect(output).toContain('"\'=HYPERLINK(""evil"")"');
    expect(output).toContain('"A,""B""\nC"');
  });
});
