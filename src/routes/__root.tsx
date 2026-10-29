import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/config";

// Used only if the settings fetch below fails or the seed row somehow
// doesn't exist — not the source of truth. src/lib/queries/settings.ts /
// the store_settings table is that. See src/lib/config.ts for why these
// specific fallback strings exist at all.
const FALLBACK_TITLE = "Finkel Reserve — Fine Wines, Whiskeys & Beverages, Curated for Nigeria";
const FALLBACK_DESCRIPTION =
  "Fine wines, whiskeys and premium beverages for Nigeria — curated bottles, trusted provenance, and unforgettable moments, delivered nationwide.";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const FALLBACK_OG_IMAGE = `${SITE_URL}/og-image.png`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Direct query, not queryClient.ensureQueryData — this project has no
  // <DehydrateRouter>/hydration boundary (see product.$slug.tsx's loader for
  // the same reasoning), so a server-populated query cache wouldn't survive
  // to the client anyway. Matches the existing convention exactly.
  //
  // store_settings isn't in generated types.ts yet (documented types.ts gap —
  // see the audit doc), hence the cast — same pattern as
  // src/lib/queries/settings.ts, just inlined since this is the only query
  // in this file.
  loader: async () => {
    const db = supabase as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
      from: (table: "store_settings") => any;
    };
    const { data } = await db
      .from("store_settings")
      .select("seo_title, seo_description, store_name, og_image_url")
      .eq("id", true)
      .maybeSingle();

    return {
      settings: data
        ? {
            seoTitle: data.seo_title as string,
            seoDescription: data.seo_description as string,
            storeName: data.store_name as string,
            ogImageUrl: data.og_image_url as string | null,
          }
        : null,
    };
  },
  head: ({ loaderData }) => ({
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700;800;900&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: loaderData?.settings?.seoTitle ?? FALLBACK_TITLE },
      {
        name: "description",
        content: loaderData?.settings?.seoDescription ?? FALLBACK_DESCRIPTION,
      },
      { name: "author", content: loaderData?.settings?.storeName ?? "Finkel Reserve" },
      { name: "theme-color", content: "#f7f2e9" },
      { property: "og:title", content: loaderData?.settings?.seoTitle ?? FALLBACK_TITLE },
      {
        property: "og:description",
        content: loaderData?.settings?.seoDescription ?? FALLBACK_DESCRIPTION,
      },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: loaderData?.settings?.ogImageUrl || FALLBACK_OG_IMAGE,
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Finkel Reserve — fine wines, whiskey and beverages" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@finkelreserve" },
      {
        name: "twitter:image",
        content: loaderData?.settings?.ogImageUrl || FALLBACK_OG_IMAGE,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
