/** Shared date utilities — local-timezone aware. */

export function dayKeyLocal(dateInput: string | Date): string {
  const value = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfDayLocal(dateInput: string | Date): Date {
  const value = typeof dateInput === "string" ? new Date(dateInput) : new Date(dateInput);
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function addDaysLocal(dateInput: string | Date, days: number): Date {
  const value = startOfDayLocal(dateInput);
  value.setDate(value.getDate() + days);
  return value;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function monthKeyLocal(input: Date | string): string {
  const value = typeof input === "string" ? new Date(input) : input;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function countWords(value: string): number {
  const plainText = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plainText ? plainText.split(" ").length : 0;
}
