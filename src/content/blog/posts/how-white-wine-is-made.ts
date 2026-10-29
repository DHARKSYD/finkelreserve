import type { BlogPost } from "../types";

export const post: BlogPost = {
  slug: "how-white-wine-is-made",
  title: "How white wine is made",
  excerpt:
    "White wine is pressed before it ferments, then kept cool to hold on to its aromas. Here's how crisp, zesty and creamy whites come about.",
  category: "How it's made",
  publishedAt: "2026-10-09",
  blocks: [
    {
      type: "p",
      text: "White wine is usually made from white grapes, though a few are made from dark grapes pressed so quickly the juice stays clear. The big difference from red is simple: the juice is separated from the skins **before** fermentation, so no colour or tannin is picked up.",
    },
    {
      type: "facts",
      title: "White wine at a glance",
      items: [
        { label: "Colour", value: "Pale straw to deep gold — none from the skins" },
        { label: "Fermentation", value: "Cooler than red — typically around 12–18°C" },
        { label: "Usual vessel", value: "Stainless steel; oak for richer styles" },
        {
          label: "Time to bottle",
          value: "From a few months for fresh styles to a year or more for oaked ones",
        },
      ],
    },
    { type: "h2", text: "Step by step" },
    {
      type: "steps",
      items: [
        {
          title: "Pick fresh",
          text: "Grapes are harvested for their acidity and aroma — often in the cool of the morning — and handled gently, because white wine has nothing to hide behind.",
        },
        {
          title: "Press first",
          text: "Grapes are pressed whole or crushed and drained, and the juice runs off the skins immediately.",
        },
        {
          title: "Settle",
          text: "The cloudy juice rests so solids sink to the bottom. Clearer juice makes cleaner, brighter flavours.",
        },
        {
          title: "Ferment cool",
          text: "Yeast is added (or arrives naturally) and the juice ferments slowly in a cool tank or barrel. Keeping it cool preserves the delicate fruit and floral aromas that make whites so fragrant.",
        },
        {
          title: "Lees and malolactic (optional)",
          text: "Chardonnay often rests on its lees — spent yeast cells — and may go through malolactic fermentation for a creamy texture. Sauvignon Blanc usually skips it to stay zesty.",
        },
        {
          title: "Clarify and bottle",
          text: "The wine is chilled to drop out harmless tartrate crystals, filtered until bright, and bottled early to keep it fresh.",
        },
      ],
    },
    { type: "h2", text: "White wine styles" },
    {
      type: "ul",
      items: [
        "**Crisp and zesty** — Sauvignon Blanc, Pinot Grigio: stainless steel, no oak, bottled young.",
        "**Rich and creamy** — oaked Chardonnay: fermented in barrel, stirred on its lees and put through malolactic fermentation.",
        "**Aromatic and off-dry** — Riesling, Moscato, Gewürztraminer: fermentation is stopped early, or the grapes are so ripe some sugar is left, balancing the acidity.",
        "**Sweet dessert wines** — made from very ripe, dried or noble-rot-affected grapes whose sugar is so concentrated the yeast can't finish it.",
      ],
    },
    {
      type: "callout",
      title: "Serve it cold, not frozen",
      text: "Most whites are at their best around 7–10°C. Straight from a deep freeze they taste of very little; a little warmer and the aromas open up.",
    },
    { type: "shop", productType: "white", label: "Shop white wine" },
  ],
};
