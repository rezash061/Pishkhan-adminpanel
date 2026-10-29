import { getDate, getMonth, newDate } from "date-fns-jalali";
import { toLatinDigits } from "./format";

/** Iran has used a fixed UTC+03:30 offset since daylight saving was abolished in 2022. */
const TEHRAN_OFFSET_MINUTES = 210;

/**
 * Parses a Jalali date typed as `1405/08/07` (Persian or Latin digits, `/` or `-`) into the UTC instant of
 * midnight in Tehran on that day. Returns null when the text is not a valid date.
 */
export function parseJalaliDate(text: string, endOfDay = false): Date | null {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(toLatinDigits(text.trim()));
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const local = newDate(y, m - 1, d);
  // Reject overflow such as 1404/12/31 rolling into the next year.
  if (Number.isNaN(local.getTime()) || getMonth(local) !== m - 1 || getDate(local) !== d) return null;
  // newDate builds a local-time Date; re-read its Gregorian fields and anchor them to Tehran midnight.
  const utc = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()) - TEHRAN_OFFSET_MINUTES * 60_000;
  return new Date(endOfDay ? utc + 86_400_000 - 1 : utc);
}
