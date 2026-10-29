const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]!);
}

/** Inputs accept Persian and Arabic digits; convert before sending to the backend. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

/** Money is stored in Rial; staff see Toman (Rial ÷ 10), like sellers do. */
export function formatToman(rial: number): string {
  return `${formatNumber(Math.round(rial / 10))} تومان`;
}

const jalaliDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const jalaliDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** Jalali date and time in Asia/Tehran, for example `۱۴۰۵/۰۸/۰۷، ۱۴:۰۵`. */
export function formatJalaliDateTime(iso: string | Date): string {
  return jalaliDateTime.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatJalaliDate(iso: string | Date): string {
  return jalaliDate.format(typeof iso === "string" ? new Date(iso) : iso);
}

/** Masks an Iranian mobile number for display: 09121234567 → 0912***4567. */
export function maskPhone(phone: string): string {
  const latin = toLatinDigits(phone);
  return latin.length < 8 ? "***" : `${latin.slice(0, 4)}***${latin.slice(-4)}`;
}
