import type { BlogPost } from "../types";

export const post: BlogPost = {
  slug: "serving-and-storing-wine-in-nigeria",
  title: "How to store and serve wine in Nigeria's heat",
  excerpt:
    "Heat is wine's biggest enemy. Simple ways to keep bottles in good shape at home, chill them quickly, and serve every style at its best.",
  category: "Serving & storing",
  publishedAt: "2026-10-09",
  blocks: [
    {
      type: "p",
      text: "Wine is happiest cool, dark and still. Nigeria's climate asks for a little extra care, but you don't need a cellar — just a few good habits.",
    },
    { type: "h2", text: "Storing wine at home" },
    {
      type: "ul",
      items: [
        "**Keep it cool and steady.** Around 12–15°C is ideal. If you can't manage that, choose the coolest, most stable spot you have — an interior room away from windows, kitchens and generators. Long spells above about 25°C speed up ageing and can leave a wine flat and stewed.",
        "**Keep it dark.** Light, especially sunlight, can spoil wine — one reason many bottles are made of dark glass.",
        "**Lie corked bottles down.** It keeps the cork moist and tight. Screw-cap bottles can stand upright.",
        "**Avoid vibration and strong smells.** A shelf beside a speaker or a freezer isn't kind to wine.",
        "**Buy to drink.** Most wines are made to be enjoyed within a year or two of purchase. In a hot climate, don't plan to keep everyday bottles for years.",
        "**If you collect, invest in a wine fridge.** A dedicated unit set to about 12–14°C is the best protection for bottles you plan to keep. An ordinary fridge (3–5°C) is fine for a few days, not for months — it can dry out corks.",
      ],
    },
    { type: "h2", text: "Serving temperatures" },
    {
      type: "facts",
      title: "A guide to temperature",
      items: [
        { label: "Sparkling and Champagne", value: "6–8°C" },
        { label: "Light whites and rosé", value: "7–10°C" },
        { label: "Full-bodied whites", value: "10–13°C" },
        { label: "Light reds", value: "12–14°C" },
        { label: "Medium and full-bodied reds", value: "16–18°C" },
        { label: "Sweet and dessert wines", value: "6–10°C" },
      ],
    },
    {
      type: "callout",
      title: "'Room temperature' is too warm here",
      text: "The advice to serve reds at room temperature comes from cool European cellars and stone houses. In a warm Nigerian room a red can easily sit above 25°C and taste heavy and alcoholic. Put it in the fridge for 20–30 minutes before serving.",
    },
    { type: "h2", text: "Chilling a bottle quickly" },
    {
      type: "ol",
      items: [
        "**Ice bucket:** fill a bucket with ice and cold water, add a generous handful of salt, and stand the bottle in it for 15–20 minutes. This is faster than the fridge.",
        "**Freezer:** 20–30 minutes works — but set a timer. A forgotten bottle can freeze, expand and push out the cork.",
        "**Wet cloth:** wrap the bottle in a wet towel before it goes in the freezer or fridge; evaporation speeds up cooling.",
      ],
    },
    { type: "h2", text: "Opening and keeping what's left" },
    {
      type: "ul",
      items: [
        "**Sparkling wine:** chill it first, hold the bottle at a slight angle, keep your thumb on the cork and twist the bottle — not the cork — until it eases out with a sigh. A sealed bottle of fizz that's still cold is much safer to open than a warm one.",
        "**Still wine:** put the cork or screw cap back and keep it in the fridge. Most whites and rosés stay pleasant for a few days; reds too, if kept cool — take them out 20 minutes before drinking.",
        "**Leftover fizz:** a proper sparkling-wine stopper will keep the bubbles for a day or two.",
      ],
    },
    { type: "shop", productType: "red", label: "Browse our wines" },
  ],
};
