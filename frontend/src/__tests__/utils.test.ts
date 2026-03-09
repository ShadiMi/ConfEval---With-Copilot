/**
 * Unit tests for utility functions in src/lib/utils.ts
 */
import { cn, formatDate, formatDateTime, getRoleLabel, getStatusColor, truncate, extractErrorMessage } from '@/lib/utils';

describe('cn (classname merger)', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves tailwind conflicts', () => {
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'extra');
    expect(result).toBe('base extra');
  });
});

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    expect(result).toBe('Jun 15, 2024');
  });

  it('uses custom format', () => {
    const result = formatDate('2024-01-01', 'yyyy-MM-dd');
    expect(result).toBe('2024-01-01');
  });

  it('handles Date objects', () => {
    const result = formatDate(new Date(2024, 0, 1));
    expect(result).toBe('Jan 1, 2024');
  });
});

describe('formatDateTime', () => {
  it('includes time', () => {
    const result = formatDateTime('2024-06-15T14:30:00Z');
    expect(result).toMatch(/Jun 15, 2024/);
    expect(result).toMatch(/\d+:\d+\s*(AM|PM)/);
  });
});

describe('getRoleLabel', () => {
  it('maps student', () => {
    expect(getRoleLabel('student')).toBe('Student');
  });

  it('maps internal_reviewer', () => {
    expect(getRoleLabel('internal_reviewer')).toBe('Internal Reviewer');
  });

  it('maps external_reviewer', () => {
    expect(getRoleLabel('external_reviewer')).toBe('External Reviewer');
  });

  it('maps admin', () => {
    expect(getRoleLabel('admin')).toBe('Administrator');
  });

  it('returns raw value for unknown role', () => {
    expect(getRoleLabel('wizard')).toBe('wizard');
  });
});

describe('getStatusColor', () => {
  it('returns warning for pending', () => {
    expect(getStatusColor('pending')).toBe('badge-warning');
  });

  it('returns success for approved', () => {
    expect(getStatusColor('approved')).toBe('badge-success');
  });

  it('returns danger for rejected', () => {
    expect(getStatusColor('rejected')).toBe('badge-danger');
  });

  it('returns gray for unknown', () => {
    expect(getStatusColor('unknown')).toBe('badge-gray');
  });
});

describe('truncate', () => {
  it('does not truncate short strings', () => {
    expect(truncate('short', 100)).toBe('short');
  });

  it('truncates and appends ellipsis', () => {
    const long = 'a'.repeat(200);
    const result = truncate(long, 10);
    expect(result).toHaveLength(13); // 10 + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('uses default length of 100', () => {
    const str = 'b'.repeat(150);
    const result = truncate(str);
    expect(result).toHaveLength(103);
  });
});

describe('extractErrorMessage', () => {
  it('extracts string detail', () => {
    const err = { response: { data: { detail: 'Not found' } } };
    expect(extractErrorMessage(err)).toBe('Not found');
  });

  it('extracts array detail', () => {
    const err = { response: { data: { detail: [{ msg: 'Field required' }] } } };
    expect(extractErrorMessage(err)).toBe('Field required');
  });

  it('falls back to error.message', () => {
    const err = { message: 'Network Error' };
    expect(extractErrorMessage(err)).toBe('Network Error');
  });

  it('uses default fallback', () => {
    expect(extractErrorMessage({})).toBe('An error occurred');
  });

  it('uses custom fallback', () => {
    expect(extractErrorMessage({}, 'Oops')).toBe('Oops');
  });
});
