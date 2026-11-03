// Finglish (Persian written in Latin letters, «salam gheymatesh chande?») marker for the eval results.

/** The backend's threshold (`Pishkhan.Persian.Finglish.Detect`): at least 70% of the letters are Latin. */
export const FINGLISH_LATIN_SHARE = 0.7;

const isLatin = (c: string) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
// The same Arabic-script ranges the backend counts: U+0600–06FF, U+FB50–FDFF, U+FE70–FEFF.
const isPersian = (c: string) => (c >= "؀" && c <= "ۿ") || (c >= "ﭐ" && c <= "﷿") || (c >= "ﹰ" && c <= "﻿");

/** Share of letters that are Latin (0..1); 0 when the text has no letters. */
export function latinShare(text: string | null | undefined): number {
  let latin = 0;
  let persian = 0;
  for (const c of text ?? "") {
    if (isLatin(c)) latin++;
    else if (isPersian(c)) persian++;
  }
  const letters = latin + persian;
  return letters === 0 ? 0 : latin / letters;
}

/**
 * Whether an eval input reads as Finglish, by the letter-ratio half of the backend's check. The backend also needs a word
 * from its Finglish lexicon, so plain English input is marked here too; the run's own Finglish counts come from the
 * backend.
 */
export function looksFinglish(text: string | null | undefined): boolean {
  return latinShare(text) >= FINGLISH_LATIN_SHARE;
}
