import { Halo } from "@/components/ui/Foliage";
import { listStats } from "@/lib/listFilters";
import type { ListContent, ListInfo } from "@/types/models";
import { ListBrowser } from "./ListBrowser";
import { ListHero } from "./ListHero";
import { SiteFooter } from "./SiteFooter";

/** Page liste complète (visiteur) : héros, filtres, sections, pied de page. */
export function ListView({ list, content }: { list: ListInfo; content: ListContent }) {
  return (
    <div className="relative isolate min-h-dvh overflow-clip">
      <ListHero list={list} stats={listStats(content.items, list.currency)} />
      <Halo tone="ochre" strength={0.22} className="top-[700px] -right-[200px]" />
      <Halo tone="olive" strength={0.16} className="top-[1150px] -left-[260px]" />
      <main>
        <ListBrowser list={list} content={content} />
      </main>
      <SiteFooter href="/" label="Toutes les listes" />
    </div>
  );
}
