// Starter catalog. Swap in real product photography, verified sourcing, and
// review every price before launch — the Unsplash placeholders and prices
// here are reasonable defaults for development, not Finkel Reserve' actual
// current lineup, and the producer names below are illustrative, not real
// wineries Finkel Reserve has a sourcing relationship with.
//
// created_at is expressed as "days ago" here and resolved to a real
// timestamp in scripts/seed.mjs, so "new arrival" sorting looks right
// immediately after seeding.

export const SEED_PRODUCTS = [
  {
    slug: "cascade-hills-cabernet-sauvignon-2019",
    name: "Cascade Hills Cabernet Sauvignon",
    description: "A full-bodied red with dark fruit, cedar, and a long, structured finish.",
    details:
      "Aged 14 months in French oak. Blackcurrant and blackberry up front, giving way to cedar, tobacco leaf, and a touch of vanilla. Firm tannins built for the table, not just the glass.",
    price: 38000,
    old_price: 45000,
    producer: "Cascade Hills Estate",
    wine_type: "red",
    region: "Stellenbosch",
    country: "South Africa",
    grape_variety: ["Cabernet Sauvignon"],
    vintage: 2019,
    abv: 14.0,
    tasting_notes: "Blackcurrant, blackberry, cedar, tobacco leaf, a whisper of vanilla oak.",
    food_pairing: "Grilled suya, jollof rice with beef, aged cheddar.",
    images: [
      "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml", "1.5L"],
    badge: "hot",
    highlights: [
      "14 months in French oak",
      "Single-estate Stellenbosch fruit",
      "Decant 30 minutes before serving",
    ],
    stock: 60,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 1,
  },
  {
    slug: "brightwater-sauvignon-blanc-2023",
    name: "Brightwater Sauvignon Blanc",
    description: "Crisp and zesty, with citrus, gooseberry, and a clean mineral finish.",
    details:
      "Cool-climate fruit picked early for freshness. Bright acidity with grapefruit, gooseberry, and cut grass, finishing clean and dry.",
    price: 22000,
    old_price: null,
    producer: "Brightwater Vineyards",
    wine_type: "white",
    region: "Marlborough",
    country: "New Zealand",
    grape_variety: ["Sauvignon Blanc"],
    vintage: 2023,
    abv: 12.5,
    tasting_notes: "Grapefruit, gooseberry, fresh-cut grass, a clean mineral edge.",
    food_pairing: "Grilled fish, pepper soup, goat cheese salad.",
    images: [
      "https://images.unsplash.com/photo-1566633806327-68e152aaf26d?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml"],
    badge: "new",
    highlights: [
      "Cool-climate fruit",
      "Serve well chilled, 8–10°C",
      "No oak — pure fruit expression",
    ],
    stock: 54,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 2,
  },
  {
    slug: "maison-verrier-rose-2023",
    name: "Maison Verrier Rosé",
    description: "Pale, dry, and elegant — strawberry and citrus with a refreshing finish.",
    details:
      "Direct-press rosé from early-harvest Grenache and Cinsault. Pale salmon in the glass, dry on the palate, with red berry and a saline finish.",
    price: 26000,
    old_price: null,
    producer: "Maison Verrier",
    wine_type: "rose",
    region: "Provence",
    country: "France",
    grape_variety: ["Grenache", "Cinsault"],
    vintage: 2023,
    abv: 12.5,
    tasting_notes: "Strawberry, white peach, citrus zest, a saline finish.",
    food_pairing: "Grilled prawns, light pasta, charcuterie boards.",
    images: [
      "https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml"],
    badge: null,
    highlights: ["Direct-press method", "Dry style, not sweet", "Best served ice-cold"],
    stock: 40,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 3,
  },
  {
    slug: "domaine-lucas-brut-nv",
    name: "Domaine Lucas Brut",
    description: "A classic-method sparkling with fine bubbles, brioche, and green apple.",
    details:
      "Traditional-method sparkling, aged on lees for 18 months. Fine, persistent bubbles with brioche, green apple, and a dry, elegant finish.",
    price: 42000,
    old_price: null,
    producer: "Domaine Lucas",
    wine_type: "sparkling",
    region: "Champagne",
    country: "France",
    grape_variety: ["Chardonnay", "Pinot Noir"],
    vintage: null,
    abv: 12.0,
    tasting_notes: "Green apple, brioche, toasted almond, a fine persistent mousse.",
    food_pairing: "Small chops, jollof rice, celebrations of any kind.",
    images: [
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1592483648228-b35146a4330c?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["375ml", "750ml"],
    badge: "hot",
    highlights: ["Traditional method", "18 months on lees", "Non-vintage house blend"],
    stock: 35,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 1,
  },
  {
    slug: "iron-gate-malbec-2020",
    name: "Iron Gate Malbec",
    description: "Rich and velvety, with plum, violet, and a smoky, spiced finish.",
    details:
      "High-altitude Mendoza fruit. Deep purple in the glass, with ripe plum, violet, and dark chocolate, framed by soft, velvety tannins.",
    price: 32000,
    old_price: 36000,
    producer: "Iron Gate Cellars",
    wine_type: "red",
    region: "Mendoza",
    country: "Argentina",
    grape_variety: ["Malbec"],
    vintage: 2020,
    abv: 14.5,
    tasting_notes: "Ripe plum, violet, dark chocolate, a smoky spiced finish.",
    food_pairing: "Grilled ribs, suya, peppered goat meat.",
    images: [
      "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml", "1.5L"],
    badge: "sale",
    highlights: ["High-altitude Mendoza fruit", "12 months in oak", "Great with grilled meats"],
    stock: 48,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 5,
  },
  {
    slug: "whistling-ridge-chardonnay-2022",
    name: "Whistling Ridge Chardonnay",
    description: "Buttery and rounded, with baked apple, vanilla, and a creamy texture.",
    details:
      "Barrel-fermented and aged 9 months in French oak, with partial malolactic fermentation for a rounded, creamy texture.",
    price: 29000,
    old_price: null,
    producer: "Whistling Ridge",
    wine_type: "white",
    region: "Sonoma County",
    country: "United States",
    grape_variety: ["Chardonnay"],
    vintage: 2022,
    abv: 13.5,
    tasting_notes: "Baked apple, vanilla, toasted oak, a creamy, rounded texture.",
    food_pairing: "Roast chicken, creamy pasta, grilled prawns.",
    images: [
      "https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml"],
    badge: null,
    highlights: [
      "9 months in French oak",
      "Partial malolactic fermentation",
      "Rounded, food-friendly style",
    ],
    stock: 38,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 6,
  },
  {
    slug: "monte-alto-primitivo-2021",
    name: "Monte Alto Primitivo",
    description: "Bold and jammy, with ripe blackberry, black pepper, and a warm finish.",
    details:
      "Puglia's sun-soaked Primitivo, showing ripe blackberry and fig, with black pepper spice and a warm, generous finish.",
    price: 27000,
    old_price: null,
    producer: "Monte Alto",
    wine_type: "red",
    region: "Puglia",
    country: "Italy",
    grape_variety: ["Primitivo"],
    vintage: 2021,
    abv: 14.0,
    tasting_notes: "Ripe blackberry, fig, black pepper, a warm generous finish.",
    food_pairing: "Jollof rice, grilled sausage, tomato-based stews.",
    images: [
      "https://images.unsplash.com/photo-1560148218-1a83060f7b32?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml"],
    badge: "new",
    highlights: ["Sun-ripened Puglia fruit", "Generous, food-friendly body", "Great everyday red"],
    stock: 52,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 2,
  },
  {
    slug: "clearwater-riesling-2022",
    name: "Clearwater Riesling",
    description: "Off-dry and aromatic, with white peach, lime, and a floral lift.",
    details:
      "Mosel-style off-dry Riesling, low in alcohol with vibrant acidity, white peach, lime zest, and a floral, honeyed edge.",
    price: 24000,
    old_price: null,
    producer: "Clearwater Estate",
    wine_type: "white",
    region: "Mosel",
    country: "Germany",
    grape_variety: ["Riesling"],
    vintage: 2022,
    abv: 9.5,
    tasting_notes: "White peach, lime zest, honeysuckle, a bright mineral finish.",
    food_pairing: "Spicy jollof, suya, Asian-inspired dishes.",
    images: [
      "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml"],
    badge: null,
    highlights: ["Off-dry, low alcohol", "Pairs beautifully with spice", "Vibrant natural acidity"],
    stock: 30,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 9,
  },
  {
    slug: "harrow-house-pinot-noir-2021",
    name: "Harrow House Pinot Noir",
    description: "Silky and elegant, with red cherry, rose petal, and soft, fine tannins.",
    details:
      "Estate-grown Pinot Noir aged 11 months in older French oak. Bright red cherry and rose petal aromatics with a silky, elegant palate.",
    price: 41000,
    old_price: null,
    producer: "Harrow House",
    wine_type: "red",
    region: "Willamette Valley",
    country: "United States",
    grape_variety: ["Pinot Noir"],
    vintage: 2021,
    abv: 13.5,
    tasting_notes: "Red cherry, rose petal, forest floor, silky fine tannins.",
    food_pairing: "Grilled salmon, roast duck, mushroom dishes.",
    images: [
      "https://images.unsplash.com/photo-1568292928838-6a14c4de5d0c?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml"],
    badge: "limited",
    highlights: [
      "Estate-grown fruit",
      "11 months in older French oak",
      "Elegant, food-friendly style",
    ],
    stock: 22,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 4,
  },
  {
    slug: "sable-coast-chenin-blanc-2023",
    name: "Sable Coast Chenin Blanc",
    description: "Fresh and layered, with green apple, quince, and a saline minerality.",
    details:
      "Old-vine Chenin Blanc from coastal vineyards. Green apple and quince, layered with honeysuckle and a distinct saline minerality.",
    price: 21000,
    old_price: null,
    producer: "Sable Coast",
    wine_type: "white",
    region: "Western Cape",
    country: "South Africa",
    grape_variety: ["Chenin Blanc"],
    vintage: 2023,
    abv: 13.0,
    tasting_notes: "Green apple, quince, honeysuckle, saline minerality.",
    food_pairing: "Grilled tilapia, jollof rice, soft cheeses.",
    images: [
      "https://images.unsplash.com/photo-1547595628-c61a29f496f0?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml"],
    badge: null,
    highlights: ["Old-vine fruit", "Great value everyday white", "Versatile food pairing"],
    stock: 45,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 7,
  },
  {
    slug: "casa-del-sol-tempranillo-2020",
    name: "Casa del Sol Tempranillo Reserva",
    description: "Structured and savory, with cherry, leather, and dried herb complexity.",
    details:
      "Reserva-style Tempranillo aged 18 months in American and French oak. Cherry and dried fig, with leather, tobacco, and dried herb complexity.",
    price: 35000,
    old_price: 40000,
    producer: "Casa del Sol",
    wine_type: "red",
    region: "Rioja",
    country: "Spain",
    grape_variety: ["Tempranillo"],
    vintage: 2020,
    abv: 14.0,
    tasting_notes: "Cherry, dried fig, leather, tobacco, dried herbs.",
    food_pairing: "Roast lamb, peppered beef, aged manchego.",
    images: [
      "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml", "1.5L"],
    badge: "sale",
    highlights: [
      "Reserva — 18 months in oak",
      "Structured, age-worthy style",
      "Classic Rioja character",
    ],
    stock: 28,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 10,
  },
  {
    slug: "goldleaf-late-harvest-2019",
    name: "Goldleaf Late Harvest",
    description: "Lusciously sweet, with honeyed apricot, orange peel, and balanced acidity.",
    details:
      "Botrytis-affected late-harvest dessert wine. Honeyed apricot and orange peel, with balancing acidity that keeps it from feeling cloying.",
    price: 30000,
    old_price: null,
    producer: "Goldleaf Estate",
    wine_type: "dessert",
    region: "Tokaj",
    country: "Hungary",
    grape_variety: ["Furmint"],
    vintage: 2019,
    abv: 11.0,
    tasting_notes: "Honeyed apricot, orange peel, dried mango, balanced bright acidity.",
    food_pairing: "Chin chin, puff puff, blue cheese, fruit tarts.",
    images: [
      "https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["375ml"],
    badge: null,
    highlights: [
      "Botrytis-affected fruit",
      "Small-batch production",
      "Serve chilled as a dessert pairing",
    ],
    stock: 18,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 12,
  },
  {
    slug: "solano-tawny-port-style-nv",
    name: "Solano Reserve Tawny",
    description: "Rich and nutty, with dried fig, toffee, and a warm, lingering finish.",
    details:
      "Fortified wine aged in barrel for a nutty, oxidative character. Dried fig, toffee, and orange peel, with a warm, lingering finish.",
    price: 33000,
    old_price: null,
    producer: "Solano Reserve",
    wine_type: "fortified",
    region: "Douro",
    country: "Portugal",
    grape_variety: ["Touriga Nacional", "Tinta Roriz"],
    vintage: null,
    abv: 19.5,
    tasting_notes: "Dried fig, toffee, orange peel, toasted walnut, a warm lingering finish.",
    food_pairing: "Dark chocolate, roasted nuts, aged cheese.",
    images: [
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["375ml", "750ml"],
    badge: null,
    highlights: [
      "Barrel-aged for oxidative character",
      "Keeps well after opening",
      "Excellent with dessert or alone",
    ],
    stock: 20,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 14,
  },
  {
    slug: "north-field-merlot-2021",
    name: "North Field Merlot",
    description: "Soft and approachable, with plum, red cherry, and gentle, rounded tannins.",
    details:
      "An easy-drinking, approachable Merlot with ripe plum and red cherry, soft rounded tannins, and a smooth finish.",
    price: 23000,
    old_price: null,
    producer: "North Field Vineyards",
    wine_type: "red",
    region: "Coastal Region",
    country: "South Africa",
    grape_variety: ["Merlot"],
    vintage: 2021,
    abv: 13.5,
    tasting_notes: "Ripe plum, red cherry, soft vanilla, a smooth rounded finish.",
    food_pairing: "Jollof rice, roast chicken, mild stews.",
    images: [
      "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?auto=format&fit=crop&w=1200&q=80",
    ],
    bottle_sizes: ["750ml"],
    badge: null,
    highlights: [
      "Approachable, everyday style",
      "Soft, rounded tannins",
      "Great introduction to red wine",
    ],
    stock: 55,
    bottles_per_box: 6, // demo: sold by the box of 6 …
    box_discount_percent: 10, // … at 10% off
    daysAgo: 3,
  },
];
