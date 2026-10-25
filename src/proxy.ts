import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

// Vérifie /l/<slug>[/a/<ref>] avant le rendu : la page est diffusée en streaming,
// donc seul ce point peut encore renvoyer un vrai 404 ou une redirection 308.

const SLUG = /^\/l\/([a-z0-9-]{1,80})(\/.*)?$/;
const ITEM = /^\/a\/([^/]{1,40})\/?$/;

let client: ReturnType<typeof createClient<Database>> | undefined;
function db() {
  client ??= createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return client;
}

// Chemin sans page : Next y répond par `not-found.tsx` avec un vrai statut 404.
function notFound(request: NextRequest) {
  return NextResponse.rewrite(new URL("/_introuvable", request.url));
}

export async function proxy(request: NextRequest) {
  const match = SLUG.exec(request.nextUrl.pathname);
  if (!match) return NextResponse.next();
  const slug = match[1] ?? "";
  const rest = match[2] ?? "";

  try {
    const { data: list } = await db().from("lists").select("id").eq("slug", slug).maybeSingle();

    if (!list) {
      const { data: redirect } = await db()
        .from("list_redirects")
        .select("lists(slug)")
        .eq("old_slug", slug)
        .maybeSingle();
      const target = redirect?.lists?.slug;
      if (!target) return notFound(request);
      const url = request.nextUrl.clone();
      url.pathname = `/l/${target}${rest}`;
      return NextResponse.redirect(url, 308);
    }

    const item = ITEM.exec(rest);
    if (item) {
      const { data } = await db()
        .from("items")
        .select("id")
        .eq("list_id", list.id)
        .eq("ref", item[1] ?? "")
        .maybeSingle();
      if (!data) return notFound(request);
    }
  } catch {
    // Base injoignable : laisser la page gérer (elle affichera l'erreur ou le 404).
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/l/:path*",
};
