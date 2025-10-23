import { parsePhoneNumberFromString, formatIncompletePhoneNumber } from 'libphonenumber-js';

export function formatPhoneNumber(phoneNumber: string): string {
  const parsed = parsePhoneNumberFromString(phoneNumber, 'BR');
  if (parsed) {
    return parsed.formatNational();
  }
  return phoneNumber;
}

export function normalizePhoneInput(input: string): string {
  return formatIncompletePhoneNumber(input, 'BR');
}

export function validatePhone(phoneNumber: string): boolean {
  const parsed = parsePhoneNumberFromString(phoneNumber, 'BR');
  return parsed ? parsed.isValid() : false;
}