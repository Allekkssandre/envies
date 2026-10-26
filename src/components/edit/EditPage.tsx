import { ListHero } from "@/components/list/ListHero";
import { listStats } from "@/lib/listFilters";
import type { ListContent, ListInfo } from "@/types/models";
import { EditView } from "./EditView";

/** Page d'édition complète : héros réduit + tableau d'édition. */
export function EditPage({ list, content }: { list: ListInfo; content: ListContent }) {
  const inbox = content.items.filter((i) => !i.sortedAt).length;
  return (
    <div className="relative isolate min-h-dvh overflow-clip pb-24 lg:pb-0">
      <EditView
        list={list}
        content={content}
        hero={
          <ListHero list={list} stats={listStats(content.items, list.currency)} editing inboxCount={inbox} />
        }
      />
    </div>
  );
}
