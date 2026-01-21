export function normalizePhone(input: string) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 9) {
    return `252${digits}`;
  }
  if (digits.startsWith("252") && digits.length === 12) {
    return digits;
  }
  return null;
}
