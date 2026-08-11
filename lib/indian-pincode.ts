/** Map Indic / fullwidth digits to ASCII 0-9. */
function toAsciiDigits(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code >= 0x30 && code <= 0x39) {
      out += ch;
      continue;
    }

    const digitBases = [
      0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6,
      0x0d66, 0xff10,
    ];
    let mapped: string | null = null;
    for (const base of digitBases) {
      if (code >= base && code <= base + 9) {
        mapped = String(code - base);
        break;
      }
    }
    if (mapped !== null) {
      out += mapped;
    }
  }
  return out;
}

/** Strip formatting and keep the last 6 digits when autofill adds prefixes. */
export function normalizeIndianPincode(raw: string): string {
  let digits = toAsciiDigits(raw.trim());
  if (digits.length > 6) {
    digits = digits.slice(-6);
  }
  return digits;
}

/** India Post uses 6 digits; the first digit is never 0. */
export function isValidIndianPincode(raw: string): boolean {
  const pincode = normalizeIndianPincode(raw);
  return /^[1-9]\d{5}$/.test(pincode);
}

export function pincodeValidationMessage(raw: string): string | null {
  if (!raw.trim()) {
    return "Pincode is required.";
  }
  if (!isValidIndianPincode(raw)) {
    return "Enter a valid 6-digit Indian pincode.";
  }
  return null;
}
