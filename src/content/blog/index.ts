import type { BlogCategory, BlogPost } from "./types";
import { post as howWineIsMade } from "./posts/how-wine-is-made";
import { post as howRedWineIsMade } from "./posts/how-red-wine-is-made";
import { post as howWhiteWineIsMade } from "./posts/how-white-wine-is-made";
import { post as howRoseWineIsMade } from "./posts/how-rose-wine-is-made";
import { post as howSparklingWineIsMade } from "./posts/how-sparkling-wine-is-made";
import { post as servingAndStoringWine } from "./posts/serving-and-storing-wine-in-nigeria";
import { post as wineAndNigerianFood } from "./posts/wine-and-nigerian-food";

/**
 * The order here is the order shown (the first article is featured on the index).
 * Add new articles at the top if you want them featured.
 */
export const POSTS: BlogPost[] = [
  howWineIsMade,
  howRedWineIsMade,
  howWhiteWineIsMade,
  howRoseWineIsMade,
  howSparklingWineIsMade,
  servingAndStoringWine,
  wineAndNigerianFood,
];

export const CATEGORIES: BlogCategory[] = ["How it's made", "Serving & storing", "Food & wine"];

export const getPost = (slug: string): BlogPost | undefined => POSTS.find((p) => p.slug === slug);

/** Other posts, same category first — for "Keep reading". */
export function relatedPosts(slug: string, count = 3): BlogPost[] {
  const current = getPost(slug);
  const others = POSTS.filter((p) => p.slug !== slug);
  const sameCategory = others.filter((p) => p.category === current?.category);
  return [...sameCategory, ...others.filter((p) => !sameCategory.includes(p))].slice(0, count);
}
