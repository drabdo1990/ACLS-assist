import type { RejectError, SendResult } from './upload';
import type { Lang } from '../i18n/lang';
import { translate } from '../i18n/translate';

export interface Message {
  tone: 'good' | 'warn' | 'crit';
  text: string;
}

export function rejectionMessage(error: RejectError, lang: Lang = 'en'): string {
  switch (error) {
    case 'key':
      return translate(lang, 'upload.reject.key');
    case 'schema':
    case 'version':
      return translate(lang, 'upload.reject.update');
    case 'size':
      return translate(lang, 'upload.reject.size');
  }
}

export function testResultMessage(r: SendResult | 'not_enrolled', lang: Lang = 'en'): Message {
  if (r === 'not_enrolled') return { tone: 'warn', text: translate(lang, 'upload.test.notEnrolled') };
  switch (r.status) {
    case 'sent':
      return { tone: 'good', text: translate(lang, 'upload.test.sent') };
    case 'sent_unconfirmed':
      return {
        tone: 'warn',
        text: translate(lang, 'upload.test.sentUnconfirmed'),
      };
    case 'rejected':
      return { tone: 'crit', text: `${rejectionMessage(r.error, lang)}.` };
    case 'failed':
      if (r.reason === 'offline') return { tone: 'warn', text: translate(lang, 'upload.test.offline') };
      if (r.reason === 'not_json') {
        return {
          tone: 'crit',
          text: translate(lang, 'upload.test.notJson'),
        };
      }
      return { tone: 'crit', text: translate(lang, 'upload.test.failed', { reason: r.reason }) };
  }
}
