import type { RejectError, SendResult } from './upload';

export interface Message {
  tone: 'good' | 'warn' | 'crit';
  text: string;
}

export function rejectionMessage(error: RejectError): string {
  switch (error) {
    case 'key':
      return 'Enrollment invalid — contact admin';
    case 'schema':
    case 'version':
      return 'Update app';
    case 'size':
      return 'A record was too large for the sheet — contact admin';
  }
}

export function testResultMessage(r: SendResult | 'not_enrolled'): Message {
  if (r === 'not_enrolled') return { tone: 'warn', text: 'This device is not enrolled yet.' };
  switch (r.status) {
    case 'sent':
      return { tone: 'good', text: 'Delivered and confirmed ✓ — a TEST row should now be in the sheet.' };
    case 'sent_unconfirmed':
      return {
        tone: 'warn',
        text: "Sent, but this browser can't read the reply, so delivery is not confirmed. Check the sheet for a TEST row.",
      };
    case 'rejected':
      return { tone: 'crit', text: `${rejectionMessage(r.error)}.` };
    case 'failed':
      if (r.reason === 'offline') return { tone: 'warn', text: "You're offline — try again when connected." };
      if (r.reason === 'not_json') {
        return {
          tone: 'crit',
          text: 'The script answered with an error page. Check the deployment is set to "Anyone" and is the latest version.',
        };
      }
      return { tone: 'crit', text: `Could not reach the script (${r.reason}).` };
  }
}
