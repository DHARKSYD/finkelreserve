import type { BlogPost } from "../types";

export const post: BlogPost = {
  slug: "how-wine-is-made",
  title: "How wine is made: from grape to glass",
  excerpt:
    "Every wine starts as grape juice and a little yeast. Follow the journey from vineyard to bottle — and see where red, white, rosé and sparkling wine go their separate ways.",
  category: "How it's made",
  publishedAt: "2026-10-09",
  blocks: [
    {
      type: "p",
      text: "At its heart, wine is fermented grape juice. Yeast eats the natural sugar in the juice and turns it into alcohol and carbon dioxide. Everything else — the colour, the style, the price — comes from the decisions made before, during and after that one reaction.",
    },
    {
      type: "facts",
      title: "Wine in a nutshell",
      items: [
        {
          label: "Main ingredient",
          value: "Wine grapes — smaller, sweeter and thicker-skinned than table grapes",
        },
        { label: "The key reaction", value: "Sugar + yeast → alcohol + carbon dioxide" },
        { label: "Vintage", value: "The year the grapes were harvested" },
        {
          label: "Grape to bottle",
          value:
            "A few months for a fresh white; a year or several for serious reds and sparkling wines",
        },
      ],
    },
    { type: "h2", text: "The five steps every wine shares" },
    {
      type: "steps",
      items: [
        {
          title: "Harvest",
          text: "Grapes are picked when sugar, acidity and flavour are in balance — by hand or by machine, often in the cool of the morning so they arrive fresh. For sparkling wine they're picked a little earlier, to keep the acidity high.",
        },
        {
          title: "Sort and crush",
          text: "Bunches are sorted to remove under-ripe or damaged fruit. Most are destemmed and gently crushed to free the juice (some white wines skip the crush and go straight to the press).",
        },
        {
          title: "Ferment",
          text: "Yeast turns sugar into alcohol. Winemakers steer the result with temperature, vessel and timing — cooler and slower keeps delicate aromas; warmer and longer builds weight and colour. It takes from several days to a few weeks.",
        },
        {
          title: "Press and mature",
          text: "The young wine is separated from skins, seeds and yeast, then settles and matures in stainless steel, concrete or oak barrels. Oak adds spice and softens texture; steel keeps wines fresh and fruity.",
        },
        {
          title: "Blend, clarify and bottle",
          text: "Batches are blended for balance, clarified so the wine is bright, and bottled — usually with a small amount of sulphur dioxide, which protects wine from spoiling and browning. Some bottles rest for months or years before release.",
        },
      ],
    },
    { type: "h2", text: "Where the styles split" },
    {
      type: "ul",
      items: [
        "**Red wine** ferments together with the skins of dark grapes, which supply its colour and tannin.",
        "**White wine** is pressed first, so it ferments as clear juice.",
        "**Rosé** gets just a short spell on the skins — enough to turn pale pink.",
        "**Sparkling wine** goes through a second fermentation that traps carbon dioxide in the bottle or a sealed tank.",
        "**Sweet wine** keeps some natural sugar, either because fermentation is stopped early or because the grapes were so sugary the yeast couldn't finish the job.",
      ],
    },
    {
      type: "callout",
      title: "It starts in the vineyard",
      text: "Soil, climate and slope — what winemakers call terroir — shape the grapes before the winemaker does anything. It's why the same grape can taste so different in South Africa, Chile and France.",
    },
    {
      type: "p",
      text: "Want the detail on one style? Our guides to **red**, **white**, **rosé** and **sparkling** wine each take it step by step.",
    },
  ],
};
