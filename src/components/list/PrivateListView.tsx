import { PrivateGate } from "@/components/access/PrivateGate";
import { Halo } from "@/components/ui/Foliage";
import { listStats } from "@/lib/listFilters";
import type { ListInfo } from "@/types/models";
import { ListHero } from "./ListHero";
import { SiteFooter } from "./SiteFooter";

/**
 * Liste privée verrouillée : le héros (nom, prénom, ambiance), sans chiffres ni contenu.
 * `ask` : ouvrir la demande de mot de passe (désactivé quand le mode édition a déjà la sienne).
 */
export function PrivateListView({ list, ask = true }: { list: ListInfo; ask?: boolean }) {
  return (
    <div className="relative isolate min-h-dvh overflow-clip">
      <ListHero list={list} stats={listStats([], list.currency)} locked />
      <Halo tone="ochre" strength={0.22} className="top-[700px] -right-[200px]" />
      <main>
        <PrivateGate listId={list.id} title={list.title} ask={ask} />
      </main>
      <SiteFooter href="/" label="Toutes les listes" />
    </div>
  );
}
