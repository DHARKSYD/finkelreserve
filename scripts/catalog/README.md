# Catalog drafts and the importer

`starter-catalog.csv` is a starter set of **draft** wines. `scripts/import-catalog.mjs` loads a CSV
like it as products that are **inactive and have zero stock** — nothing appears in the shop until you
review it in Admin → Products and switch it on.

```bash
node --env-file=.env scripts/import-catalog.mjs scripts/catalog/starter-catalog.csv            # validate + preview, writes nothing
node --env-file=.env scripts/import-catalog.mjs scripts/catalog/starter-catalog.csv --commit   # create the drafts
```

`--commit` makes you type the database host back before it writes, and skips any product whose slug
already exists. Check that host is your Finkel Reserve project.

## Before you publish a draft

- **Supply:** only publish wines you can actually get and deliver. Prices in the starter file are market
  benchmarks (see `review_notes` / `benchmark_source` in the CSV), not your cost or your final price.
- **Facts from the label:** vintage, ABV, bottle size and grapes. Descriptions are written at the level
  of the grape and style; edit them to match the bottle in your hand.
- **Photos:** add your own, or the producer's/importer's official packshot with their permission. Don't
  copy another retailer's photos or descriptions — they're that retailer's copyrighted work. Until a
  photo is added the site shows a placeholder bottle in the wine's colour.

## CSV columns

| Column                                                                                                             | Notes                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `producer`, `wine_type`, `bottle_size`, `price_ngn`, `description`                                         | Required. `wine_type` (the column name is historical — it holds any product type): wines `red` `white` `rose` `sparkling` `dessert` `fortified`; whiskey & spirits `whiskey` `cognac` `gin` `vodka` `rum` `tequila` `liqueur`; fine beverages `beer` `non_alcoholic` `mixers`. `bottle_size`: 200ml, 375ml, 500ml, 700ml, 750ml, 1L, 1.5L, 3L. `price_ngn`: whole naira, the price of ONE bottle. |
| `bottles_per_box`, `box_discount_percent` | Optional box packaging. Blank `bottles_per_box` = a box of 6 (like the product form); `0` = not sold by the box; otherwise 2–48. `box_discount_percent` = % off the price of those bottles when a customer buys a box (`10` = ten percent; blank = no discount). Needs the box migration applied first. |
| `country`, `region`, `grape_variety`, `vintage`, `abv`                                                             | Optional. `grape_variety` (or key ingredients) separated by `;`. Blank vintage = non-vintage. `abv` up to 80.                                                                 |
| `details`, `tasting_notes`, `food_pairing`                                                                         | Optional free text.                                                                                                                      |
| `appearance`, `nose`, `palate`, `finish`, `serving_notes`, `cellaring_notes`, `producer_notes`, `winemaking_notes` | Optional — the "About this bottle" section on the product page shows only what's filled in.                                                |
| `highlights`, `tags`                                                                                               | Separated by `;`.                                                                                                                        |
| `image_urls`                                                                                                       | `https://` URLs separated by `\|`. Only use images you have the right to use.                                                            |
| `benchmark_source`, `review_notes`                                                                                 | Notes for you — shown in the preview, never written to the database.                                                                     |

One row per wine and bottle size. Slug is made from the name (plus vintage).
