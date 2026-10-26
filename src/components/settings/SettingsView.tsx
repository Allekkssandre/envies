"use client";

import {
  ArrowLeft,
  CircleCheck,
  Copy,
  FileSpreadsheet,
  LoaderCircle,
  Lock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AmbiancePicker } from "@/components/ui/AmbiancePicker";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field, TextArea } from "@/components/ui/Field";
import { LinkBox } from "@/components/ui/LinkBox";
import { PasswordField } from "@/components/ui/PasswordField";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { ambianceTheme } from "@/lib/ambiance";
import { cn } from "@/lib/cn";
import { DESCRIPTION_MAX, OWNER_MAX, TITLE_MAX } from "@/lib/schemas/list";
import { slugify } from "@/lib/text";
import { lockDevice } from "@/server/actions/access";
import {
  changePassword,
  deleteList,
  regenerateEditKey,
  updateList,
  updateSlug,
} from "@/server/actions/settings";
import type { CategoryInfo, ListInfo, TagInfo } from "@/types/models";
import { Card, type Track } from "./Card";
import { CategoriesSection, TagsSection } from "./Taxonomy";

type Props = {
  list: ListInfo;
  categories: CategoryInfo[];
  tags: TagInfo[];
  categoryCounts: Record<string, number>;
  tagCounts: Record<string, number>;
  uncategorized: number;
  itemCount: number;
  editKey: string;
};

const NETWORK_ERROR = "Pas enregistré. Vérifiez la connexion.";

export const SECTIONS = [
  { id: "liste", label: "La liste" },
  { id: "categories", label: "Catégories" },
  { id: "tags", label: "Tags" },
  { id: "acces", label: "Accès" },
  { id: "exporter", label: "Exporter" },
  { id: "supprimer", label: "Supprimer" },
] as const;

export function SettingsView(props: Props) {
  const router = useRouter();
  const [list, setList] = useState(props.list);
  const [pending, setPending] = useState(0);
  const [saved, setSaved] = useState(false);

  const track: Track = useCallback(
    async (run) => {
      setPending((n) => n + 1);
      try {
        const result = await run();
        if (result.ok) setSaved(true);
        else if (result.error.code === "EDIT_LOCKED") {
          toast(result.error.message, { duration: 4000 });
          router.refresh();
        }
        return result;
      } catch {
        toast(NETWORK_ERROR, { duration: 8000 });
        return null;
      } finally {
        setPending((n) => n - 1);
      }
    },
    [router],
  );

  const theme = ambianceTheme(list.ambiance);
  const editHref = `/l/${list.slug}/edition`;

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip bg-cream pb-16 text-ink">
      <span aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 grain-fine" />
      <header className={cn("relative h-[230px] overflow-hidden lg:h-[320px]", theme.texture, theme.text)}>
        <span aria-hidden="true" className="absolute inset-0 grain-overlay opacity-55 mix-blend-overlay" />
        <div className="relative mx-auto flex h-full max-w-[1320px] flex-col px-4 lg:px-[110px]">
          <div className="flex h-16 items-center justify-between lg:h-24">
            <Link
              href={editHref}
              aria-label="Retour à la liste"
              className={cn(
                "inline-flex items-center gap-2 text-[15px] font-semibold no-underline max-lg:size-11 max-lg:justify-center max-lg:rounded-full max-lg:border",
                theme.dark
                  ? "max-lg:border-linen/40 max-lg:bg-linen/12"
                  : "max-lg:border-ink/18 max-lg:bg-white/40",
                theme.text,
              )}
            >
              <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.7} />
              <span className="max-lg:hidden">Retour à la liste</span>
            </Link>
            <span
              aria-live="polite"
              className={cn("inline-flex items-center gap-1.5 text-[13px]", theme.soft)}
            >
              {pending > 0 ? (
                <>
                  <LoaderCircle
                    aria-hidden="true"
                    size={15}
                    className="animate-spin motion-reduce:animate-none"
                  />
                  Enregistrement…
                </>
              ) : saved ? (
                <>
                  <CircleCheck aria-hidden="true" size={15} strokeWidth={1.8} />
                  Enregistré
                </>
              ) : null}
            </span>
          </div>
          <div className="mt-auto pb-16 lg:pb-[72px]">
            <SplitTitle
              as="h1"
              title={`Réglages de ${list.title}`}
              tracking="list"
              restColor={theme.italic || undefined}
              className="text-[44px] lg:text-[84px]"
            />
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[1320px] gap-6 px-4 lg:grid-cols-[230px_minmax(0,860px)] lg:gap-16 lg:px-[110px] lg:pt-14">
        <SectionNav />
        <main className="flex min-w-0 flex-col gap-5 lg:gap-7">
          <ListSection list={list} track={track} onChange={setList} />
          <CategoriesSection
            listId={list.id}
            initial={props.categories}
            counts={props.categoryCounts}
            uncategorized={props.uncategorized}
            track={track}
          />
          <TagsSection listId={list.id} initial={props.tags} counts={props.tagCounts} track={track} />
          <AccessSection list={list} editKey={props.editKey} track={track} />
          <Card id="exporter" title="Exporter">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={`/api/lists/${list.id}/export`}
                download
                className={buttonClasses("outline", 46, "max-sm:w-full")}
              >
                <FileSpreadsheet aria-hidden="true" />
                Télécharger en Excel
              </a>
              <p className="m-0 text-[13px] text-muted">
                Mêmes colonnes que l&apos;import : vous pouvez le modifier puis le réimporter.
              </p>
            </div>
          </Card>
          <DeleteSection list={list} itemCount={props.itemCount} />
          <Link
            href={`${editHref}/importer`}
            className="mx-auto inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-ink underline underline-offset-4 lg:hidden"
          >
            <FileSpreadsheet aria-hidden="true" size={18} strokeWidth={1.7} />
            Importer un fichier Excel
          </Link>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <nav
      aria-label="Sections des réglages"
      className="z-20 max-lg:-mt-9 max-lg:[scrollbar-width:none] max-lg:overflow-x-auto max-lg:rounded-full max-lg:border max-lg:border-white/55 max-lg:bg-linen/85 max-lg:p-1.5 max-lg:shadow-[0_20px_40px_-20px_rgb(43_36_22/0.5)] max-lg:backdrop-blur-[18px] lg:sticky lg:top-8 lg:self-start"
    >
      <ul className="m-0 flex list-none gap-1 p-0 lg:flex-col">
        {SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap no-underline lg:rounded-[14px] lg:text-[15px] lg:font-medium",
                s.id === "supprimer" ? "text-rust" : "text-ink",
                active === s.id
                  ? "bg-ink text-linen lg:bg-ink/8 lg:font-semibold lg:text-ink"
                  : "hover:bg-ink/5",
                active === s.id && s.id === "supprimer" && "lg:text-rust",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// La liste
// ---------------------------------------------------------------------------

function ListSection({
  list,
  track,
  onChange,
}: {
  list: ListInfo;
  track: Track;
  onChange: (list: ListInfo) => void;
}) {
  const router = useRouter();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [draft, setDraft] = useState({
    title: list.title,
    ownerName: list.ownerName,
    description: list.description ?? "",
    slug: list.slug,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof draft, string>>>({});
  const [slugChanged, setSlugChanged] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);

  const save = async (field: "title" | "ownerName" | "description") => {
    const value = draft[field];
    const current = field === "description" ? (list.description ?? "") : list[field];
    if (value.trim() === current) return;
    const result = await track(() => updateList({ listId: list.id, patch: { [field]: value } }));
    if (!result) return;
    if (!result.ok) {
      setErrors((e) => ({ ...e, [field]: result.error.message }));
      return;
    }
    setErrors((e) => ({ ...e, [field]: undefined }));
    onChange(result.data);
    setDraft((d) => ({
      ...d,
      [field]: field === "description" ? (result.data.description ?? "") : result.data[field],
    }));
  };

  const saveSlug = async () => {
    const wanted = slugify(draft.slug, 80);
    if (!wanted || wanted === list.slug) {
      setDraft((d) => ({ ...d, slug: list.slug }));
      return;
    }
    const result = await track(() => updateSlug({ listId: list.id, slug: wanted }));
    if (!result) return;
    if (!result.ok) {
      setErrors((e) => ({ ...e, slug: result.error.message }));
      return;
    }
    setErrors((e) => ({ ...e, slug: undefined }));
    setSlugChanged(true);
    onChange({ ...list, slug: result.data.slug });
    setDraft((d) => ({ ...d, slug: result.data.slug }));
    router.replace(`/l/${result.data.slug}/edition/reglages`, { scroll: false });
  };

  const setAmbiance = async (ambiance: ListInfo["ambiance"]) => {
    onChange({ ...list, ambiance });
    const result = await track(() => updateList({ listId: list.id, patch: { ambiance } }));
    if (result && !result.ok) {
      onChange(list);
      toast(result.error.message, { duration: 4000 });
    }
  };

  const publicUrl = `${origin}/l/${draft.slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/l/${list.slug}`);
      toast("Lien copié", { duration: 4000 });
    } catch {
      toast("Quelque chose n'a pas marché. Réessayez.", { duration: 4000 });
    }
  };
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <Card id="liste" title="La liste">
      <Field
        label="Nom de la liste"
        large={isDesktop !== false}
        value={draft.title}
        maxLength={TITLE_MAX}
        error={errors.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        onBlur={() => void save("title")}
        onKeyDown={blurOnEnter}
      />
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
        <Field
          label="Votre prénom"
          value={draft.ownerName}
          maxLength={OWNER_MAX}
          error={errors.ownerName}
          onChange={(e) => setDraft((d) => ({ ...d, ownerName: e.target.value }))}
          onBlur={() => void save("ownerName")}
          onKeyDown={blurOnEnter}
        />
        <Field
          label="Adresse"
          value={draft.slug}
          maxLength={80}
          spellCheck={false}
          autoCapitalize="off"
          error={errors.slug}
          hint={
            slugChanged
              ? "Les anciens liens redirigeront vers la nouvelle adresse."
              : publicUrl.replace(/^https?:\/\//, "")
          }
          onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
          onBlur={() => void saveSlug()}
          onKeyDown={blurOnEnter}
          trailing={
            <button
              type="button"
              aria-label="Copier le lien de la liste"
              onClick={() => void copy()}
              className="-mr-2.5 flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/6"
            >
              <Copy aria-hidden="true" size={17} strokeWidth={1.7} />
            </button>
          }
        />
      </div>
      <TextArea
        label="Un petit mot"
        value={draft.description}
        maxLength={DESCRIPTION_MAX}
        rows={2}
        error={errors.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        onBlur={() => void save("description")}
        className="font-note text-lg"
      />
      <AmbiancePicker value={list.ambiance} onChange={(a) => void setAmbiance(a)} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Accès
// ---------------------------------------------------------------------------

function AccessSection({
  list,
  editKey: initialKey,
  track,
}: {
  list: ListInfo;
  editKey: string;
  track: Track;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [key, setKey] = useState(initialKey);
  const [confirming, setConfirming] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);

  const change = async () => {
    if (!password) return;
    const result = await track(() => changePassword({ listId: list.id, newPassword: password }));
    if (!result) return;
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setError(undefined);
    setPassword("");
    toast("Mot de passe changé. Les autres appareils devront le saisir.", { duration: 6000 });
  };

  const regenerate = async () => {
    setConfirming(false);
    const result = await track(() => regenerateEditKey({ listId: list.id }));
    if (result?.ok) setKey(result.data.editKey);
    else if (result) toast(result.error.message, { duration: 4000 });
  };

  const lock = async () => {
    const result = await lockDevice({ listId: list.id }).catch(() => null);
    if (!result?.ok) {
      toast(result?.error.message ?? NETWORK_ERROR, { duration: 4000 });
      return;
    }
    router.push(`/l/${list.slug}`);
  };

  return (
    <Card
      id="acces"
      title="Accès"
      text="Pas de compte : le mot de passe et le lien secret sont les deux clés de la modification."
    >
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          void change();
        }}
      >
        <div className="min-w-0 flex-1">
          <PasswordField
            label="Nouveau mot de passe"
            autoComplete="new-password"
            placeholder="Laissez vide pour garder l'actuel"
            value={password}
            error={error}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(undefined);
            }}
          />
        </div>
        <Button type="submit" variant="ink" size={52} className="sm:mt-[26px]" disabled={!password}>
          Changer
        </Button>
      </form>

      <LinkBox
        variant="secret"
        label="Lien secret de modification"
        url={`${origin}/l/${list.slug}/edition#cle=${key}`}
        hint="Ouvre la modification sans mot de passe. Si vous pensez qu'il a circulé, régénérez-le : l'ancien ne marchera plus."
      />

      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        {confirming ? (
          <div
            role="group"
            aria-label="Régénérer le lien secret"
            className="flex flex-wrap items-center gap-2.5"
          >
            <span className="text-sm font-semibold">L&apos;ancien lien ne marchera plus. Régénérer ?</span>
            <Button autoFocus variant="ink" size={44} onClick={() => void regenerate()}>
              Oui
            </Button>
            <Button variant="outline" size={44} onClick={() => setConfirming(false)}>
              Non
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size={44}
            icon={<RefreshCw aria-hidden="true" />}
            onClick={() => setConfirming(true)}
          >
            Régénérer le lien secret
          </Button>
        )}
        <Button variant="outline" size={44} icon={<Lock aria-hidden="true" />} onClick={() => void lock()}>
          Verrouiller cet appareil
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Supprimer la liste
// ---------------------------------------------------------------------------

function DeleteSection({ list, itemCount }: { list: ListInfo; itemCount: number }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = value === list.title;

  const remove = async () => {
    if (!matches) return;
    setBusy(true);
    try {
      const result = await deleteList({ listId: list.id, confirmTitle: value });
      if (!result.ok) {
        toast(result.error.message, { duration: 4000 });
        return;
      }
      toast("Liste supprimée.", { duration: 6000 });
      router.push("/");
    } catch {
      toast(NETWORK_ERROR, { duration: 8000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      id="supprimer"
      title="Supprimer la liste"
      danger
      text={
        itemCount === 0
          ? "Impossible de revenir en arrière."
          : itemCount === 1
            ? "L'article et ses photos seront effacés. Impossible de revenir en arrière."
            : `Les ${itemCount} articles et leurs photos seront effacés. Impossible de revenir en arrière.`
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void remove();
        }}
      >
        <Field
          label={`Tapez « ${list.title} » pour confirmer`}
          value={value}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          placeholder={list.title}
        />
        <Button
          type="submit"
          variant="rust"
          size={46}
          className="self-start"
          disabled={!matches || busy}
          icon={<Trash2 aria-hidden="true" />}
        >
          Supprimer la liste
        </Button>
      </form>
    </Card>
  );
}
