import type { BlogPost } from "../types";

export const post: BlogPost = {
  slug: "how-rose-wine-is-made",
  title: "How rosé wine is made",
  excerpt:
    "Rosé isn't a mix of red and white. It's dark grapes with only a brief spell on their skins — and the length of that spell decides the colour.",
  category: "How it's made",
  publishedAt: "2026-10-09",
  blocks: [
    {
      type: "p",
      text: "A common myth: rosé is red and white wine blended together. In practice it's made from **dark-skinned grapes** with just a little skin contact. Colour seeps from the skins into the juice over time, so a few hours gives a pale blush and a day or two gives a deeper pink.",
    },
    {
      type: "facts",
      title: "Rosé at a glance",
      items: [
        {
          label: "Colour comes from",
          value: "Brief contact with dark grape skins — hours, not days",
        },
        {
          label: "Grapes",
          value: "Grenache, Cinsault, Syrah, Pinot Noir, Sangiovese and many more",
        },
        { label: "Fermentation", value: "Cool, like white wine" },
        { label: "Styles", value: "From pale and bone-dry to deep pink and fruity or sweet" },
      ],
    },
    { type: "h2", text: "Three ways to make rosé" },
    {
      type: "steps",
      items: [
        {
          title: "Skin contact (maceration)",
          text: "Crushed dark grapes sit with their skins for a few hours up to a day or two. When the winemaker likes the colour, the juice is drained off and fermented like a white wine. This is the classic route to the pale, dry rosés of Provence and beyond.",
        },
        {
          title: "Direct press",
          text: "Dark grapes are pressed straight away, as for white wine. The juice picks up only a whisper of colour, giving the very palest pinks.",
        },
        {
          title: "Saignée ('bleeding')",
          text: "Some juice is drawn off a tank of fermenting red wine early on. The tank left behind becomes more concentrated red, and the juice that was bled off is fermented separately as a deeper, fuller rosé.",
        },
      ],
    },
    { type: "h2", text: "After that, it's made like a white" },
    {
      type: "p",
      text: "Once the juice is off the skins, rosé follows the white wine path: cool fermentation in stainless steel to keep the fruit and floral aromas, then early bottling for freshness. That's why most rosés are meant to be drunk young and chilled.",
    },
    {
      type: "callout",
      title: "The famous exception",
      text: "In most regions, still rosé isn't made by mixing red and white wine. Champagne is the well-known exception: pink Champagne can be made by blending in a little still red wine.",
    },
    {
      type: "p",
      text: "Serve rosé well chilled — around 8–10°C — and don't wait for a special occasion; it's one of the most versatile wines at the table.",
    },
    { type: "shop", productType: "rose", label: "Shop rosé" },
  ],
};
