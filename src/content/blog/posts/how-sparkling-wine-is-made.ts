import type { BlogPost } from "../types";

export const post: BlogPost = {
  slug: "how-sparkling-wine-is-made",
  title: "How sparkling wine is made",
  excerpt:
    "The bubbles in sparkling wine are carbon dioxide trapped by a second fermentation. Whether that happens in the bottle or in a tank shapes the style, the price and the fineness of the fizz.",
  category: "How it's made",
  publishedAt: "2026-10-09",
  blocks: [
    {
      type: "p",
      text: "Sparkling wine starts like any other: grapes are pressed and fermented into a still wine. The magic comes next — a **second fermentation** in a sealed container. The carbon dioxide yeast produces can't escape, so it dissolves into the wine and waits for you to open the bottle.",
    },
    {
      type: "facts",
      title: "Sparkling wine at a glance",
      items: [
        {
          label: "Where the fizz comes from",
          value: "A second fermentation that traps carbon dioxide",
        },
        {
          label: "Pressure in a Champagne bottle",
          value: "Roughly 5–6 atmospheres — more than double the pressure in a car tyre",
        },
        { label: "Main methods", value: "Traditional (in the bottle), tank, transfer, ancestral" },
        {
          label: "Base grapes",
          value: "Picked early for high acidity, then fermented dry and tart",
        },
      ],
    },
    { type: "h2", text: "The traditional method" },
    {
      type: "p",
      text: "Used for Champagne, Cava, Franciacorta and many of the world's best sparkling wines, this is the slow, hands-on route — and the one that gives fine bubbles and toasty, bready flavours.",
    },
    {
      type: "steps",
      items: [
        {
          title: "Make the base wine",
          text: "Grapes are picked early, while acidity is high, and fermented into a dry, rather tart still wine. Winemakers often blend several grapes, vineyards and years to build a consistent house style.",
        },
        {
          title: "Add the 'liqueur de tirage'",
          text: "A measured dose of sugar and yeast is stirred into the wine, which is then bottled and sealed with a crown cap, like a beer bottle.",
        },
        {
          title: "Second fermentation in the bottle",
          text: "Over weeks to months the yeast eats the sugar, adding a little more alcohol and producing carbon dioxide that stays dissolved in the wine under pressure.",
        },
        {
          title: "Age on the lees",
          text: "Spent yeast cells (lees) stay in the bottle, slowly breaking down and adding the biscuity, brioche notes sparkling wine is loved for. Champagne law, for example, requires non-vintage wines to age for at least 15 months in total, at least 12 of them on the lees.",
        },
        {
          title: "Riddling",
          text: "Bottles are tilted and turned a little at a time — traditionally by hand, now often by machine — until the sediment slides into the neck.",
        },
        {
          title: "Disgorgement",
          text: "The neck is frozen, the cap removed, and the pressure inside shoots out a plug of frozen sediment, leaving the wine brilliantly clear.",
        },
        {
          title: "Dosage and cork",
          text: "The bottle is topped up with wine and a little sugar syrup that sets the final sweetness, then sealed with the familiar cork and wire cage.",
        },
      ],
    },
    { type: "h2", text: "The tank method" },
    {
      type: "p",
      text: "Prosecco and many fresh, fruity sparkling wines are made by the tank method (Charmat or Martinotti). The second fermentation happens in a large pressurised stainless-steel tank; the wine is then chilled, filtered and bottled under pressure. It's faster and cheaper, and it keeps the fresh fruit and floral aromas rather than bready ones.",
    },
    {
      type: "p",
      text: "**Asti** and **Moscato d'Asti** take this further: the single fermentation in the tank is stopped early by chilling, leaving natural sweetness and low alcohol — typically around 5–7%.",
    },
    { type: "h2", text: "Other routes to bubbles" },
    {
      type: "ul",
      items: [
        "**Transfer method** — the second fermentation happens in the bottle, then the wine is emptied into a tank to be filtered and re-bottled.",
        "**Ancestral method (pét-nat)** — the wine is bottled before its first fermentation has finished, so the fizz forms in the bottle. Often cloudy, rustic and lightly sparkling.",
        "**Carbonation** — carbon dioxide is injected into still wine, as in soft drinks. It's the cheapest route; the bubbles are larger and fade faster.",
      ],
    },
    { type: "h2", text: "How sweet is it?" },
    {
      type: "facts",
      title: "Sweetness on the label (sugar per litre)",
      items: [
        { label: "Brut Nature", value: "0–3 g — bone dry" },
        { label: "Extra Brut", value: "Up to 6 g — very dry" },
        { label: "Brut", value: "Up to 12 g — dry, the most common style" },
        { label: "Extra Dry", value: "12–17 g — off-dry (sweeter than Brut, despite the name)" },
        { label: "Dry / Sec", value: "17–32 g — medium sweet" },
        { label: "Demi-Sec", value: "32–50 g — sweet" },
        { label: "Doux", value: "50 g+ — very sweet" },
      ],
    },
    {
      type: "callout",
      title: "Champagne is a place, not a style",
      text: "Only sparkling wine from the Champagne region of France, made under its rules, can be called Champagne. Everything else — Cava, Prosecco, Franciacorta, Cap Classique — is sparkling wine in its own right.",
    },
    { type: "shop", productType: "sparkling", label: "Shop sparkling wine" },
  ],
};
