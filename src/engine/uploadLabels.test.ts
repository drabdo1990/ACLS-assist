import { describe, expect, it } from 'vitest';
import { rejectionMessage, testResultMessage } from './uploadLabels';

describe('testResultMessage', () => {
  it('maps every outcome to a tone and text', () => {
    expect(testResultMessage({ status: 'sent' })).toMatchObject({ tone: 'good' });
    expect(testResultMessage({ status: 'sent_unconfirmed' })).toMatchObject({ tone: 'warn' });
    expect(testResultMessage({ status: 'rejected', error: 'key' }).text).toContain('Enrollment invalid');
    expect(testResultMessage({ status: 'rejected', error: 'version' }).text).toContain('Update');
    expect(testResultMessage({ status: 'failed', reason: 'offline' }).text).toContain('offline');
    expect(testResultMessage({ status: 'failed', reason: 'not_json' }).text).toContain('Anyone');
    expect(testResultMessage({ status: 'failed', reason: 'network' }).tone).toBe('crit');
    expect(testResultMessage('not_enrolled').tone).toBe('warn');
  });
  it('sent_unconfirmed explains that the reply cannot be read', () => {
    expect(testResultMessage({ status: 'sent_unconfirmed' }).text).toMatch(/not confirmed|can't read/i);
  });
  it('rejection messages for the stored state', () => {
    expect(rejectionMessage('key')).toBe('Enrollment invalid — contact admin');
    expect(rejectionMessage('schema')).toBe('Update app');
    expect(rejectionMessage('version')).toBe('Update app');
    expect(rejectionMessage('size')).toContain('too large');
  });

  it('translates rejection and test result messages to Arabic', () => {
    expect(rejectionMessage('key', 'ar')).toBe('التسجيل غير صالح — اتصل بالمسؤول');
    expect(rejectionMessage('version', 'ar')).toBe('حدّث التطبيق');
    expect(rejectionMessage('size', 'ar')).toBe('السجل كبير جداً بالنسبة للجدول — اتصل بالمسؤول');
    expect(testResultMessage('not_enrolled', 'ar')).toEqual({ tone: 'warn', text: 'هذا الجهاز غير مسجل بعد.' });
    expect(testResultMessage({ status: 'sent' }, 'ar')).toEqual({
      tone: 'good',
      text: 'تم التسليم والتأكيد ✓ — يجب أن يظهر صف تجريبي في الجدول الآن.',
    });
    expect(testResultMessage({ status: 'rejected', error: 'key' }, 'ar')).toEqual({
      tone: 'crit',
      text: 'التسجيل غير صالح — اتصل بالمسؤول.',
    });
  });
});
