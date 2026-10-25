"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, Heart, Link as LinkIcon, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Drawer } from "vaul";
import { copyLink } from "@/components/list/ShareButton";
import { buttonClasses } from "@/components/ui/Button";
import { Caps } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { ItemPhoto } from "@/components/ui/ItemPhoto";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useUrlFilters } from "@/hooks/useListFilters";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { imageUrl } from "@/lib/imageUrl";
import { EMPTY_FILTERS, displayOrder, filtersQueryString } from "@/lib/listFilters";
import { formatDayMonth } from "@/lib/relativeDate";
import { buildSearchQuery } from "@/lib/searchQuery";
import { tagColorVar } from "@/lib/tagColors";
import { itemName, type ItemInfo, type ListContent, type ListInfo } from "@/types/models";
import { SearchElsewhere } from "./SearchElsewhere";

type ItemSheetProps = {
  list: ListInfo;
  content: ListContent;
  itemRef: string;
  /** `modal` : ouverte depuis la liste (route interceptée) ; `page` : lien direct. */
  mode: "modal" | "page";
};

/** Fiche article : panneau à droite (desktop) ou feuille depuis le bas (mobile). */
export function ItemSheet({ list, content, itemRef, mode }: ItemSheetProps) {
  const router = useRouter();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const filters = useUrlFilters();
  const [open, setOpen] = useState(true);
  const query = filtersQueryString(filters);

  const order = useMemo(() => {
    const filtered = displayOrder(content, filters);
    return filtered.some((i) => i.ref === itemRef) ? filtered : displayOrder(content, EMPTY_FILTERS);
  }, [content, filters, itemRef]);
  const index = order.findIndex((i) => i.ref === itemRef);
  const item = order[index];
  const prev = index > 0 ? order[index - 1] : undefined;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : undefined;

  const goTo = useCallback(
    (target: ItemInfo | undefined) => {
      if (target) router.replace(`/l/${list.slug}/a/${target.ref}${query}`, { scroll: false });
    },
    [router, list.slug, query],
  );

  const leave = useCallback(() => {
    if (mode === "modal") router.back();
    else router.push(`/l/${list.slug}${query}`, { scroll: false });
  }, [mode, router, list.slug, query]);

  // Fermeture : on laisse jouer l'animation de sortie (320 ms), puis on quitte la fiche.
  const leaving = useRef(false);
  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next || leaving.current) return;
      leaving.current = true;
      window.setTimeout(leave, 320);
    },
    [leave],
  );

  // Flèches du clavier : article précédent / suivant (sauf dans un champ).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === "ArrowLeft") goTo(prev);
      if (e.key === "ArrowRight") goTo(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, prev, next]);

  if (!item || isDesktop === null) return null;

  const copy = () =>
    void copyLink(new URL(`/l/${list.slug}/a/${item.ref}`, window.location.origin).toString());

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={isDesktop ? "right" : "bottom"}
      handleOnly={isDesktop}
      shouldScaleBackground={!isDesktop}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[rgb(24_20_10/0.5)] backdrop-blur-[6px]" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col bg-paper text-ink outline-none",
            isDesktop
              ? "inset-y-0 right-0 w-[min(640px,100vw)] rounded-l-[30px] shadow-panel-right"
              : "inset-x-0 top-10 bottom-0 rounded-t-sheet shadow-[0_-20px_50px_-20px_rgb(0_0_0/0.6)]",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 opacity-50 grain-fine",
              isDesktop ? "rounded-l-[30px]" : "rounded-t-sheet",
            )}
          />
          {isDesktop ? (
            <DesktopBody
              key={item.id}
              list={list}
              content={content}
              item={item}
              position={{ index, total: order.length }}
              onPrev={prev ? () => goTo(prev) : undefined}
              onNext={next ? () => goTo(next) : undefined}
              onCopy={copy}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <MobileBody
              key={item.id}
              list={list}
              content={content}
              item={item}
              position={{ index, total: order.length }}
              onPrev={prev ? () => goTo(prev) : undefined}
              onNext={next ? () => goTo(next) : undefined}
              onCopy={copy}
              onClose={() => onOpenChange(false)}
            />
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

type BodyProps = {
  list: ListInfo;
  content: ListContent;
  item: ItemInfo;
  position: { index: number; total: number };
  onPrev?: () => void;
  onNext?: () => void;
  onCopy: () => void;
  onClose: () => void;
};

function photoOf(item: ItemInfo) {
  return item.imagePath
    ? {
        src480: imageUrl(item.imagePath, 480),
        src1200: imageUrl(item.imagePath, 1200),
        lightBackground: item.lightBackground,
      }
    : null;
}

function FavoritePill({ small }: { small?: boolean }) {
  return (
    <span
      className={cn(
        "absolute flex items-center gap-1.5 rounded-full bg-linen/75 font-bold text-rust shadow-[0_8px_18px_-8px_rgb(43_36_22/0.4)] backdrop-blur-[10px]",
        small ? "top-3 left-3 h-[34px] pr-3 pl-2.5 text-[13px]" : "top-4 left-4 h-9 pr-3.5 pl-3 text-[13px]",
      )}
    >
      <Heart aria-hidden="true" size={small ? 14 : 15} className="fill-current" strokeWidth={1.6} />
      Coup de cœur
    </span>
  );
}

/** Catégorie, tags, nom, prix, relevé. */
function Heading({
  list,
  content,
  item,
  mobile,
}: Pick<BodyProps, "list" | "content" | "item"> & { mobile?: boolean }) {
  const category = content.categories.find((c) => c.id === item.categoryId);
  const tags = content.tags.filter((t) => item.tagIds.includes(t.id));
  const currency = item.currency ?? list.currency;
  let priceNote: string | null = null;
  if (item.priceSource === "page" && item.priceCheckedAt && item.domain) {
    priceNote = `relevé sur ${item.domain} ${formatDayMonth(new Date(item.priceCheckedAt))}`;
  } else if (item.priceSource === "manual") {
    priceNote = `prix indiqué par ${list.ownerName}`;
  }

  return (
    <div className={cn("flex flex-col", mobile ? "gap-2" : "gap-2.5")}>
      {category || tags.length ? (
        <div
          className={cn("flex flex-wrap items-center", mobile ? "gap-x-3.5 gap-y-1" : "gap-x-[18px] gap-y-1")}
        >
          {category ? <Caps size={mobile ? 11 : 12}>{category.name}</Caps> : null}
          {tags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1.5 text-[13px] text-ink">
              <span
                aria-hidden="true"
                className="size-[7px] rounded-full"
                style={{ background: tagColorVar[tag.color] }}
              />
              {tag.name}
            </span>
          ))}
        </div>
      ) : null}
      <Drawer.Title
        className={cn(
          "m-0 font-display-72 font-normal tracking-[-0.01em]",
          mobile ? "text-[28px] leading-[1.12]" : "text-4xl leading-[1.1]",
        )}
      >
        {itemName(item)}
      </Drawer.Title>
      {item.priceCents != null ? (
        <div className={cn("flex flex-wrap items-baseline", mobile ? "gap-x-2.5" : "gap-x-3.5")}>
          <span className={cn("font-serif leading-none tabular", mobile ? "text-[34px]" : "text-[44px]")}>
            {formatPrice(item.priceCents, currency)}
          </span>
          {priceNote ? (
            <span className={cn("text-muted", mobile ? "text-xs" : "text-[13px]")}>{priceNote}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 220;
  return (
    <div className="flex flex-col items-start gap-1">
      <p className={cn("m-0 text-[15px] leading-[1.55] text-ink-soft", long && !expanded && "line-clamp-4")}>
        {text}
      </p>
      {long && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-11 text-sm font-semibold underline underline-offset-4"
        >
          Lire la suite
        </button>
      ) : null}
    </div>
  );
}

function Note({ list, note, mobile }: { list: ListInfo; note: string; mobile?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 border border-olive/18 bg-olive/10",
        mobile ? "mt-2 rounded-[18px] px-4 py-3.5" : "rounded-[20px] px-[22px] py-[18px]",
      )}
    >
      <span className={cn("caps text-olive-deep", mobile ? "text-[11px]" : "text-xs")}>
        Note de {list.ownerName}
      </span>
      <span
        className={cn(
          "font-note leading-[1.3] [font-variation-settings:'SOFT'_100,'opsz'_36]",
          mobile ? "text-xl" : "text-2xl",
        )}
      >
        {note}
      </span>
    </div>
  );
}

function VisitLink({ item, size }: { item: ItemInfo; size: 56 | 58 }) {
  if (!item.url) return null;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={buttonClasses("ink", size, "w-full gap-2.5 shadow-[0_18px_30px_-18px_rgb(43_36_22/0.8)]")}
    >
      Voir sur {item.domain ?? "la boutique"}
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

function FetchFailed({ item }: { item: ItemInfo }) {
  if (item.fetchStatus !== "failed") return null;
  return <p className="m-0 text-sm text-muted">Les infos n&apos;ont pas pu être lues sur la page.</p>;
}

function DesktopBody({ list, content, item, position, onPrev, onNext, onCopy, onClose }: BodyProps) {
  return (
    <div className="relative flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-paper/90 pt-4 pr-5 pb-2 pl-6 backdrop-blur-[10px]">
        <div className="flex items-center gap-0.5">
          <IconButton variant="ghost" aria-label="Article précédent" onClick={onPrev} disabled={!onPrev}>
            <ArrowLeft aria-hidden="true" className="size-5!" />
          </IconButton>
          <span className="min-w-16 text-center text-sm text-muted" aria-live="polite">
            {position.index + 1} sur {position.total}
          </span>
          <IconButton variant="ghost" aria-label="Article suivant" onClick={onNext} disabled={!onNext}>
            <ArrowRight aria-hidden="true" className="size-5!" />
          </IconButton>
        </div>
        <div className="flex gap-1.5">
          <IconButton variant="outline" aria-label="Copier le lien de l'article" onClick={onCopy}>
            <LinkIcon aria-hidden="true" />
          </IconButton>
          <IconButton variant="ink" aria-label="Fermer" onClick={onClose}>
            <X aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-12 pt-[18px] pb-10">
        <ItemPhoto
          key={item.id}
          name={itemName(item)}
          {...photoOf(item)}
          sizes="544px"
          initialSize={150}
          className="h-[420px] rounded-[22px] shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_2px_4px_rgb(43_36_22/0.1),0_30px_50px_-24px_rgb(60_40_10/0.5)]"
        >
          {item.isFavorite ? <FavoritePill /> : null}
        </ItemPhoto>
        <Heading list={list} content={content} item={item} />
        {item.description ? <Description text={item.description} /> : null}
        <FetchFailed item={item} />
        {item.note ? <Note list={list} note={item.note} /> : null}
        <VisitLink item={item} size={58} />
        <div className="border-t border-ink/12 pt-2.5">
          <SearchElsewhere initialQuery={buildSearchQuery(item)} layout="desktop" />
        </div>
      </div>
    </div>
  );
}

function Dots({ index, total }: { index: number; total: number }) {
  if (total < 2) return null;
  const size = Math.min(total, 5);
  const start = Math.min(Math.max(index - 2, 0), total - size);
  return (
    <div aria-hidden="true" className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
      {Array.from({ length: size }, (_, i) => start + i).map((i) => (
        <span
          key={i}
          className={cn("h-1.5 rounded-[3px]", i === index ? "w-[18px] bg-ink" : "w-1.5 bg-ink/30")}
        />
      ))}
    </div>
  );
}

function MobileBody({ list, content, item, position, onPrev, onNext, onCopy, onClose }: BodyProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  // En-tête compact quand la photo sort de l'écran.
  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const io = new IntersectionObserver(([entry]) => setCompact(!entry?.isIntersecting), { root });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  const onPointerDown = (e: PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - start.y) * 1.5) {
      if (dx < 0) onNext?.();
      else onPrev?.();
    }
  };

  const photo = photoOf(item);

  return (
    <>
      <Drawer.Handle className="absolute! top-2 left-1/2 z-20 mt-0! h-[5px]! w-11! -translate-x-1/2 bg-ink/22!" />

      <div
        aria-hidden={!compact}
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-center gap-3 rounded-t-sheet border-b border-ink/8 bg-paper/90 py-3 pr-3 pl-3.5 backdrop-blur-[14px] transition-opacity duration-180",
          compact ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ItemPhoto
          name={itemName(item)}
          {...photo}
          sizes="44px"
          initialSize={26}
          className="size-11 shrink-0 rounded-xl shadow-none"
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-semibold">{itemName(item)}</span>
          {item.priceCents != null ? (
            <span className="font-serif text-base tabular">
              {formatPrice(item.priceCents, item.currency ?? list.currency)}
            </span>
          ) : null}
        </span>
        <IconButton variant="ink" aria-label="Fermer" onClick={onClose} tabIndex={compact ? 0 : -1}>
          <X aria-hidden="true" />
        </IconButton>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto pb-28">
        <div className="px-3.5 pt-[22px]">
          <div
            data-vaul-no-drag=""
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            className="relative touch-pan-y"
          >
            <ItemPhoto
              key={item.id}
              name={itemName(item)}
              {...photo}
              sizes="100vw"
              initialSize={120}
              className="h-[330px] rounded-[20px] shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_24px_40px_-22px_rgb(60_40_10/0.5)]"
            >
              {item.isFavorite ? <FavoritePill small /> : null}
              <span className="absolute top-2 right-2 flex gap-1.5">
                <IconButton
                  variant="linen"
                  aria-label="Copier le lien de l'article"
                  onClick={onCopy}
                  className="bg-linen/75 shadow-none backdrop-blur-[10px]"
                >
                  <LinkIcon aria-hidden="true" />
                </IconButton>
                <IconButton variant="ink" aria-label="Fermer" onClick={onClose}>
                  <X aria-hidden="true" />
                </IconButton>
              </span>
              <Dots index={position.index} total={position.total} />
            </ItemPhoto>
          </div>
          <div ref={sentinelRef} aria-hidden="true" className="h-px" />
        </div>

        <div className="flex flex-col gap-2 px-5 pt-5">
          <Heading list={list} content={content} item={item} mobile />
          {item.description ? <Description text={item.description} /> : null}
          <FetchFailed item={item} />
          {item.note ? <Note list={list} note={item.note} mobile /> : null}
          <a
            href="#ailleurs"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("ailleurs")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="mt-1.5 flex h-11 items-center justify-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4"
          >
            Trouver ailleurs
            <ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} />
          </a>
        </div>

        <div className="px-4 pt-6">
          <SearchElsewhere id="ailleurs" initialQuery={buildSearchQuery(item)} layout="mobile" />
        </div>
      </div>

      {item.url ? (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-[linear-gradient(rgb(246_241_232/0),var(--color-paper)_30%)] px-4 pt-3 pb-[max(26px,env(safe-area-inset-bottom))]">
          <VisitLink item={item} size={56} />
        </div>
      ) : null}
    </>
  );
}
