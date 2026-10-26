import type { CheerioAPI } from "cheerio";
import type { ParsedPrice } from "./parsePrice";

/** Ce qu'une page publie sur le produit (docs/07-extraction-liens.md § 4). */
export type Extracted = {
  title: string | null;
  description: string | null;
  /** URL absolues, dédoublonnées, 6 au plus. */
  images: string[];
  price: ParsedPrice | null;
  siteName: string | null;
  brand: string | null;
  availability: string | null;
  breadcrumb: string[];
  canonical: string | null;
};

/** Une requête supplémentaire au plus, par la même porte sécurisée que la page. */
export type FetchJson = (url: string) => Promise<unknown | null>;

export type AdapterContext = { url: URL; base: Extracted; fetchJson: FetchJson };

/** Complète ou corrige l'extraction générique pour un site donné. */
export type Adapter = {
  name: string;
  match: (domain: string, $: CheerioAPI) => boolean;
  extract: ($: CheerioAPI, ctx: AdapterContext) => Partial<Extracted> | Promise<Partial<Extracted>>;
};
