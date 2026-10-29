import type { BlogPost } from "../types";

export const post: BlogPost = {
  slug: "wine-and-nigerian-food",
  title: "Pairing wine with Nigerian food",
  excerpt:
    "Jollof, suya, pepper soup, grilled fish — a practical guide to what to pour with the dishes you actually eat.",
  category: "Food & wine",
  publishedAt: "2026-10-09",
  blocks: [
    {
      type: "p",
      text: "Classic pairing rules were written for European dinner tables. Nigerian food is bolder, spicier and more varied — but the underlying principles still work, and a few small tweaks make for brilliant matches.",
    },
    { type: "h2", text: "Four principles that work for almost everything" },
    {
      type: "ol",
      items: [
        "**Heat loves a little sweetness and a lower alcohol.** Alcohol and tannin make chilli taste hotter. Off-dry whites, rosé and fruity, soft reds calm the burn instead of fanning it.",
        "**Bubbles love fried and salty food.** Fizz's acidity and fine bubbles cut through oil and refresh the palate between bites.",
        "**Match weight with weight.** Rich, heavy stews suit fuller wines; delicate fish and light snacks suit lighter ones.",
        "**Acidity is your friend.** A crisp, zesty white lifts rich, oily or grilled dishes the way a squeeze of lime does.",
      ],
    },
    { type: "h2", text: "Dish by dish" },
    {
      type: "facts",
      title: "Starting points to try",
      items: [
        {
          label: "Jollof rice",
          value: "A dry or off-dry rosé, or a light, fruity red served slightly cool.",
        },
        {
          label: "Suya",
          value:
            "A juicy, soft red such as Shiraz or Merlot, or an off-dry rosé. Go easy on heavy, tannic reds with a lot of yaji (pepper).",
        },
        {
          label: "Pepper soup",
          value:
            "Cold sparkling wine, or an off-dry white such as Chenin Blanc or Riesling, to soothe the heat.",
        },
        {
          label: "Grilled or fried fish",
          value: "Sauvignon Blanc, Pinot Grigio or a dry sparkling wine.",
        },
        {
          label: "Egusi, ogbono and other rich soups",
          value:
            "A round, fruity red such as Merlot, or a fuller white like a lightly oaked Chardonnay.",
        },
        {
          label: "Fried rice and chicken",
          value: "Chardonnay or a light red — or sparkling wine, for a festive table.",
        },
        { label: "Moi moi and akara", value: "Sparkling wine or a crisp white." },
        {
          label: "Asun and nkwobi (spicy goat)",
          value:
            "Bubbles, or an off-dry white; if you want red, pick a soft one with little tannin.",
        },
        {
          label: "Small chops",
          value: "Sparkling wine is the easy answer for a mixed, fried, salty platter.",
        },
        {
          label: "Puff-puff and chin chin",
          value: "A lightly sweet sparkling wine such as Asti, or a dessert wine.",
        },
      ],
    },
    {
      type: "callout",
      title: "Taste, then adjust",
      text: "These are starting points, not rules. Spice levels, sauces and cooking styles vary from kitchen to kitchen — and the best pairing is the one you enjoy. If a match isn't working, change the temperature or the glass before you give up on it.",
    },
    { type: "shop", productType: "rose", label: "Shop rosé" },
    { type: "shop", productType: "sparkling", label: "Shop sparkling wine" },
  ],
};
