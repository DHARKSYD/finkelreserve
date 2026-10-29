import type { BlogPost } from "../types";

export const post: BlogPost = {
  slug: "how-red-wine-is-made",
  title: "How red wine is made",
  excerpt:
    "Colour, tannin and structure all come from one decision: fermenting the juice together with the grape skins. Here's red wine, step by step.",
  category: "How it's made",
  publishedAt: "2026-10-09",
  blocks: [
    {
      type: "p",
      text: "Red wine gets its colour — and most of its grip — from the skins of dark-skinned grapes. Unlike white wine, the juice is fermented **together with** its skins, and that single choice explains much of what makes a red taste like a red.",
    },
    {
      type: "facts",
      title: "Red wine at a glance",
      items: [
        {
          label: "Colour comes from",
          value: "The skins of dark grapes (the juice itself is almost clear)",
        },
        { label: "Fermentation", value: "Warmer than white wine — typically around 24–32°C" },
        {
          label: "Time on the skins",
          value: "From about a week to a month or more, depending on the style",
        },
        { label: "Ageing", value: "From a few months in tank to two years or more in oak" },
      ],
    },
    { type: "h2", text: "Step by step" },
    {
      type: "steps",
      items: [
        {
          title: "Harvest and sort",
          text: "Dark grapes are picked ripe and sorted so only good fruit goes forward. Ripeness matters more for reds than for any other style: it sets the sugar (and so the alcohol), the tannin and the flavour.",
        },
        {
          title: "Destem and crush",
          text: "Most reds are destemmed — stems can add a bitter, green edge — and lightly crushed. Some producers keep whole bunches in the mix for lift and spice.",
        },
        {
          title: "Ferment on the skins",
          text: "As yeast ferments, carbon dioxide pushes the skins to the surface in a thick 'cap'. Once or several times a day the winemaker pumps wine over it or punches it down, which extracts colour, flavour and tannin and keeps the cap healthy.",
        },
        {
          title: "Macerate",
          text: "After fermentation some wines stay on the skins for extra days or weeks for more structure. Lighter, fruitier reds are drawn off sooner.",
        },
        {
          title: "Press",
          text: "The free-run wine is drained off. What's left of the skins is pressed to give 'press wine' — darker and more tannic — and the winemaker decides how much to blend back in.",
        },
        {
          title: "Malolactic fermentation",
          text: "A second, bacterial process turns sharp malic acid (think green apples) into softer lactic acid (think milk). Almost all reds go through it, which makes them rounder and smoother.",
        },
        {
          title: "Age",
          text: "In stainless steel or concrete for a fresh, fruit-forward style, or in oak barrels, which add vanilla, toast and spice and let a trace of oxygen in to soften the tannins.",
        },
        {
          title: "Blend, clarify and bottle",
          text: "Grapes, vineyards or barrels are blended for balance, the wine is clarified and bottled, and many wines rest further in bottle before they're released.",
        },
      ],
    },
    { type: "h2", text: "Why reds taste the way they do" },
    {
      type: "ul",
      items: [
        "**Tannin** comes from skins, seeds and oak. It's the drying, grippy feeling on your gums — and it's what makes a red such a good partner for rich, savoury food.",
        "**Body** reflects alcohol, extraction and ageing: a light Pinot Noir feels very different from a Shiraz or a Cabernet Sauvignon.",
        "**Oak** brings vanilla, spice and toast. Unoaked reds taste purer and fruitier.",
        "**Climate** matters: warm regions ripen grapes fully, giving riper, rounder, higher-alcohol wines; cooler regions give lighter, fresher, more savoury ones.",
      ],
    },
    {
      type: "callout",
      title: "What about sweet reds?",
      text: "Sweet reds keep some natural grape sugar. It's done either by stopping fermentation early — by chilling and filtering the wine — or by adding grape spirit, as in port. The 'natural sweet' reds many people love start life exactly like any other red.",
    },
    { type: "shop", productType: "red", label: "Shop red wine" },
  ],
};
