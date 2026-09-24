/** Read optional add-ons from a Raindrop character note without changing legacy notes. */
export function getCharacterAddOns(note: unknown): string[] {
  if (typeof note !== 'string' || !note) return [];

  try {
    const parsed = JSON.parse(note);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.add_ons)) return [];
    return parsed.add_ons.filter(
      (addOn: unknown): addOn is string => typeof addOn === 'string' && addOn.trim().length > 0
    );
  } catch {
    return [];
  }
}
