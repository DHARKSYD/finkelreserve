/**
 * Nigerian mobile number → E.164 (`+234…`), or null if it isn't one.
 *
 * Accepts the ways people actually type them: 0803 123 4567, 08031234567,
 * 2348031234567, +234 803 123 4567, (0803) 123-4567. Landlines and foreign
 * numbers return null — this is used to decide whether we can send an SMS,
 * not to validate every phone field on the site.
 */
export function normalizeNgMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = input.replace(/[\s\-().]/g, "");
  // NG mobiles are 070x/080x/081x/090x/091x + 7 more digits (11 digits with the leading 0).
  const m = compact.match(/^(?:\+?234|0)([789][01]\d{8})$/);
  return m ? `+234${m[1]}` : null;
}
