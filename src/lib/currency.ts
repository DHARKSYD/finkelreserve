// The store sells in Naira only — prices in the database are already NGN.
// (An earlier version of this app stored USD "seed" prices and multiplied
// by a hardcoded exchange rate at display time. That's a real bug for a
// Naira-only business — the rate drifts and was never updated — so it's
// gone. If you ever need multi-currency display, convert at read time
// from a live rate, not a constant.)

export const formatNGN = (amountNgn: number) => `₦${Math.round(amountNgn).toLocaleString("en-NG")}`;
