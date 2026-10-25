import { ArrowLeft, Link as LinkIcon, Pencil, Share, Trash2, Undo2, X } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Caps } from "@/components/ui/Chip";
import { Field, TextArea } from "@/components/ui/Field";
import { Foliage, Halo } from "@/components/ui/Foliage";
import { IconButton } from "@/components/ui/IconButton";
import { InboxCard } from "@/components/ui/InboxCard";
import { ItemCard } from "@/components/ui/ItemCard";
import { ItemPhoto } from "@/components/ui/ItemPhoto";
import { Kbd } from "@/components/ui/Kbd";
import { PasswordField } from "@/components/ui/PasswordField";
import { SplitTitle } from "@/components/ui/SplitTitle";
import { tagColorVar } from "@/lib/tagColors";
import { ChipsDemo, KeyChipsDemo, ToastDemo, TogglesDemo } from "./Demos";

/** Planche FondationsV4 en vrai. Page non liée, non indexée. */
export const metadata: Metadata = {
  title: "Système visuel",
  robots: { index: false, follow: false },
};

type Swatch = { name: string; hex: string; token: string };

const BASE: Swatch[] = [
  { name: "Olive", hex: "#57612C", token: "olive" },
  { name: "Olive profond", hex: "#4A5226", token: "olive-deep" },
  { name: "Ocre", hex: "#A76A19", token: "ochre" },
  { name: "Ocre brûlé", hex: "#7A4512", token: "ochre-deep" },
];

const INKS: Swatch[] = [
  { name: "Encre", hex: "#2B2416", token: "ink" },
  { name: "Encre douce", hex: "#5E523A", token: "ink-soft" },
  { name: "Sépia", hex: "#6B5A3E", token: "muted" },
  { name: "Miel clair", hex: "#E3D7B8", token: "honey" },
  { name: "Lin", hex: "#F3ECDD", token: "linen" },
  { name: "Crème", hex: "#F3EDE2", token: "cream" },
  { name: "Papier", hex: "#F6F1E8", token: "paper" },
];

const ACCENTS: Swatch[] = [
  { name: "Rouille", hex: "#8E3B22", token: "rust" },
  { name: "Miel", hex: "#C99536", token: "honey-deep" },
  { name: "Prune", hex: "#6B3F4A", token: "plum" },
  { name: "Ardoise", hex: "#4F5B5E", token: "slate" },
  { name: "Sauge", hex: "#7E8C5A", token: "sage" },
  { name: "Sable", hex: "#9A8A6A", token: "sand" },
];

const MEASURES: Array<[string, string]> = [
  ["Largeur max · gouttières", "1320 · 48 / 16 px"],
  ["Rayons", "14 · 16 · 18 · 22 · 26 · 30 · pilule"],
  ["Cible tactile", "44 px minimum"],
  ["Points de rupture", "640 · 1024 · 1280"],
  ["Grille d'articles", "auto-fill, min 260 px"],
  ["Mouvement", "180 ms survols · 320 ms panneaux"],
  ["Icônes", "Lucide, trait 1,6–1,8"],
];

function SwatchRow({ title, swatches, narrow = false }: { title: string; swatches: Swatch[]; narrow?: boolean }) {
  return (
    <div className="flex flex-col gap-3.5">
      <Caps as="h3" className="m-0">
        {title}
      </Caps>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-5 p-0 sm:flex sm:flex-wrap sm:gap-[22px]">
        {swatches.map((s) => (
          <li key={s.token} className={narrow ? "flex flex-col gap-2.5 sm:w-32" : "flex flex-col gap-2.5 sm:w-[150px]"}>
            <span
              aria-hidden="true"
              className="h-[110px] rounded-[20px] shadow-swatch"
              style={{ background: s.hex }}
            />
            <span className="flex flex-col gap-px">
              <b className="text-[15px]">{s.name}</b>
              <span className="text-[13px] text-muted">
                {s.hex} · --{s.token}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="relative flex flex-col gap-7 border-t border-ink/14 py-10 sm:py-14">
      <div>
        <SplitTitle title={title} className="text-[42px] sm:text-[56px]" restColor="text-ochre" />
        {intro ? <p className="mt-1.5 mb-0 max-w-[760px] text-[15px] leading-[1.55] text-muted">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function TypeRow({ sample, spec }: { sample: ReactNode; spec: string }) {
  return (
    <div className="grid gap-3 border-b border-line py-[18px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-baseline lg:gap-8">
      <div className="min-w-0">{sample}</div>
      <p className="m-0 text-[13px] leading-normal text-muted">{spec}</p>
    </div>
  );
}

function Ambiance({ name, className, dark }: { name: string; className: string; dark: boolean }) {
  return (
    <span className={`relative block h-[220px] overflow-hidden rounded-panel shadow-tile ${className}`}>
      <span aria-hidden="true" className="grain-overlay absolute inset-0" />
      <span
        className={`font-note absolute bottom-4 left-5 text-[34px] ${dark ? "text-linen" : "text-ink"}`}
      >
        {name}
      </span>
    </span>
  );
}

export default function DesignPage() {
  return (
    <div className="relative isolate overflow-clip">
      {/* Héros feuillage */}
      <header className="tex-feuillage on-dark relative h-[340px] overflow-hidden text-linen sm:h-[420px]">
        <span aria-hidden="true" className="grain-overlay absolute inset-0" />
        <Foliage className="top-5 right-[8%] h-[597px] w-[330px] max-sm:-right-24 max-sm:opacity-40" />
        <div className="relative mx-auto flex h-full max-w-[1320px] flex-col justify-end gap-[18px] px-4 pb-12 sm:px-12 sm:pb-[70px]">
          <Caps tone="honey" size={13}>Envies · système visuel V4</Caps>
          <h1 className="font-display m-0 text-[84px] leading-[0.9] font-normal tracking-[-0.03em] [text-shadow:0_14px_50px_rgb(10_12_4/0.45)] sm:text-[150px]">
            Fonda<i className="font-light">tions</i>
          </h1>
          <p className="font-note m-0 max-w-[640px] text-lg leading-[1.4] sm:text-[23px]">
            Chiné, organique, boisé. La profondeur vient de la lumière et de la matière : flou de feuillage, ciel
            doré, verre, grain fin.
          </p>
        </div>
      </header>

      <Halo tone="olive" strength={0.14} className="top-[900px] -left-[260px]" />
      <Halo tone="ochre" strength={0.2} className="top-[1800px] -right-[200px]" />

      <main className="relative mx-auto max-w-[1320px] px-4 pt-5 pb-20 sm:px-12">
        <Section
          title="Les couleurs"
          intro="Deux couleurs de base, des encres chaudes et des fonds crème. Jamais de noir pur ni de blanc pur. Contraste texte minimum 4,5:1 : l'encre sur crème fait 13:1, le sépia 5,6:1."
        >
          <div className="flex flex-col gap-7">
            <SwatchRow title="Base" swatches={BASE} />
            <SwatchRow title="Encres et fonds" swatches={INKS} />
            <SwatchRow
              title="Accents · couleurs de tags (rouille = coup de cœur, erreurs, suppression)"
              swatches={ACCENTS}
              narrow
            />
          </div>
        </Section>

        <Section
          title="Les matières"
          intro="Chaque liste choisit une ambiance. Elle habille son héros, sa vignette sur l'accueil et ses fonds de modale. Les textures sont des images générées (scripts fournis), pas des dégradés CSS."
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <figure className="m-0 flex flex-col gap-3">
              <Ambiance name="Feuillage" className="tex-feuillage" dark />
              <figcaption className="text-sm leading-normal text-muted">
                Ambiance par défaut. Héros de liste, pied de page, fonds de tri et de modales. Fichiers
                bokeh-hero.jpg / bokeh-mobile.jpg.
              </figcaption>
            </figure>
            <figure className="m-0 flex flex-col gap-3">
              <Ambiance name="Ciel doré" className="tex-ciel" dark={false} />
              <figcaption className="text-sm leading-normal text-muted">
                Ambiance claire : texte encre dessus. Sert aussi de lumière derrière une section (masque en fondu
                160 px).
              </figcaption>
            </figure>
            <figure className="m-0 flex flex-col gap-3">
              <Ambiance name="Ambre" className="tex-ambre" dark />
              <figcaption className="text-sm leading-normal text-muted">
                Ambiance chaude d&apos;intérieur. Mêmes règles que Feuillage (texte lin).
              </figcaption>
            </figure>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <figure className="m-0 flex flex-col gap-3">
              <span className="relative block h-40 overflow-hidden rounded-panel bg-cream shadow-[inset_0_0_0_1px_rgb(43_36_22/0.12)]">
                <span aria-hidden="true" className="grain-fine absolute inset-0" />
                <span aria-hidden="true" className="grain-fine absolute inset-0" />
                <span
                  aria-hidden="true"
                  className="absolute -top-5 -right-15 size-[260px] rounded-full bg-[radial-gradient(closest-side,rgb(214_160_70/0.3),rgb(214_160_70/0))]"
                />
              </span>
              <figcaption className="text-sm leading-normal text-muted">
                Crème + grain fin en surimpression sur toute la page (grain-fine.png, 200 px, pointer-events none) +
                halos radiaux ocre et olive. Jamais de texture papier.
              </figcaption>
            </figure>
            <figure className="m-0 flex flex-col gap-3">
              <span className="tex-feuillage on-dark relative flex h-40 items-center justify-center gap-3.5 overflow-hidden rounded-panel">
                <span className="glass-dark flex h-[90px] w-[150px] items-center justify-center rounded-[20px] text-sm font-semibold text-linen">
                  Verre sombre
                </span>
                <span className="glass-light flex h-[90px] w-[150px] items-center justify-center rounded-[20px] text-sm font-semibold text-ink">
                  Verre clair
                </span>
              </span>
              <figcaption className="text-sm leading-normal text-muted">
                Verre sombre (sur image) et verre clair (barres qui chevauchent le héros). Flou 20–22 px, liseré
                blanc, ombre longue.
              </figcaption>
            </figure>
            <figure className="m-0 flex flex-col gap-3">
              <span className="grid grid-cols-2 gap-3">
                <span aria-hidden="true" className="tex-studio block h-40 rounded-[20px] shadow-photo" />
                <ItemPhoto name="Un bon massage" className="h-40 rounded-[20px]" />
              </span>
              <figcaption className="text-sm leading-normal text-muted">
                Photo d&apos;article sur fond studio. Sans photo : dégradé lin + initiale en Fraunces italique, ocre
                à 55 %.
              </figcaption>
            </figure>
          </div>
        </Section>

        <Section
          title="La typographie"
          intro="Fraunces pour tout ce qui se lit comme un titre, Instrument Sans pour le reste. Deux familles, c'est tout."
        >
          <div>
            <TypeRow
              sample={
                <SplitTitle as="p" title="Mes 30 ans" tracking="list" className="text-[58px] sm:text-[128px]" />
              }
              spec="Titre de liste · Fraunces 400 + italique 300, SOFT 100, WONK 1, opsz 144 · 172 / 128 / 84 / 58 px selon écran · interligne 0,9 · −0,03 em. Règle : premier mot romain, la suite en italique."
            />
            <TypeRow
              sample={<SplitTitle as="p" title="Maison & déco" restColor="text-ochre" className="text-[42px] sm:text-[72px]" />}
              spec="Titre de section · 72 desktop, 42 mobile · italique en ocre sur fond clair, miel sur fond sombre."
            />
            <TypeRow
              sample={<span className="font-display-72 text-[28px] sm:text-4xl">Lampe champignon en verre soufflé</span>}
              spec="Nom d'article en fiche · Fraunces 400 opsz 72 · 36 desktop, 28 mobile."
            />
            <TypeRow
              sample={
                <span className="flex items-baseline gap-6">
                  <span className="tabular font-serif text-[34px] sm:text-[44px]">89&nbsp;€</span>
                  <span className="tabular font-serif text-lg font-medium sm:text-[21px]">89&nbsp;€</span>
                </span>
              }
              spec="Prix · Fraunces 400 (fiche, 44) ou 500 (carte, 21 / 18) · tabular-nums · insécable."
            />
            <TypeRow
              sample={<span className="font-note text-xl sm:text-2xl">En vert sauge si possible, sinon ambre.</span>}
              spec="Notes et petit mot · Fraunces italique 300, opsz 24–36."
            />
            <TypeRow
              sample={
                <span className="text-base leading-[1.55]">
                  Collez un lien, ou écrivez un nom. La fiche se complète toute seule.
                </span>
              }
              spec="Texte courant · Instrument Sans 400–600 · 16 / 15 / 14 / 13 px · interligne 1,45–1,55."
            />
            <TypeRow
              sample={<Caps>Maison &amp; déco · 8 articles</Caps>}
              spec="Étiquettes · Instrument Sans 600 · 11–13 px · capitales · interlettrage 0,18 em · sépia."
            />
          </div>
        </Section>

        <Section title="Les composants">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Caps as="h3" className="m-0">
                Boutons · 44 px minimum, pilule
              </Caps>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="ink">Créer la liste</Button>
                <Button variant="outline">Voir la liste</Button>
                <Button variant="ghost">Annuler</Button>
                <Button variant="rust" icon={<Trash2 aria-hidden="true" />}>
                  Supprimer
                </Button>
                <IconButton variant="ink" aria-label="Fermer">
                  <X aria-hidden="true" />
                </IconButton>
                <IconButton variant="outline" aria-label="Copier le lien">
                  <LinkIcon aria-hidden="true" />
                </IconButton>
              </div>
              <div className="tex-feuillage on-dark flex flex-wrap gap-2.5 rounded-[20px] p-[18px]">
                <Button variant="glass" icon={<Share aria-hidden="true" />}>
                  Partager
                </Button>
                <Button variant="linen" icon={<Pencil aria-hidden="true" />}>
                  Modifier
                </Button>
                <IconButton variant="glass" aria-label="Retour">
                  <ArrowLeft aria-hidden="true" />
                </IconButton>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Caps as="h3" className="m-0">
                Puces · catégories, tags, raccourcis
              </Caps>
              <ChipsDemo />
              <div className="flex flex-wrap items-center gap-2">
                <KeyChipsDemo />
                <Kbd>Entrée</Kbd>
                <Kbd>Échap</Kbd>
              </div>
              <TogglesDemo />
            </div>

            <div className="flex flex-col gap-4">
              <Caps as="h3" className="m-0">
                Champs
              </Caps>
              <Field label="Nom de la liste" defaultValue="Noël 2026" placeholder="Noël 2026" />
              <div className="grid gap-3 sm:grid-cols-2">
                <PasswordField
                  label="Mot de passe pour modifier"
                  autoComplete="new-password"
                  defaultValue="bouleau"
                  defaultVisible
                  hint="Simple, à donner à qui peut modifier."
                />
                <Field label="Erreur" defaultValue="bou" error="4 caractères au moins." />
              </div>
              <TextArea label="Un petit mot (facultatif)" rows={2} placeholder="En vert sauge si possible." />
            </div>

            <div className="flex flex-col gap-4">
              <Caps as="h3" className="m-0">
                États d&apos;un article ajouté
              </Caps>
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                <InboxCard state="pending" title="etsy.com/listing/…" domain="etsy.com" />
                <InboxCard
                  state="ok"
                  title="Bougie figue"
                  domain="etsy.com"
                  priceCents={2800}
                  photo={{ src480: "/textures/photo-backdrop.jpg" }}
                />
                <InboxCard state="failed" title="amazon.fr/dp/B0…" domain="amazon.fr" />
                <InboxCard state="no-link" title="Un bon massage" />
              </div>
            </div>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-3">
            <div className="flex flex-col gap-3.5">
              <Caps as="h3" className="m-0">
                Carte article
              </Caps>
              <div className="grid grid-cols-2 gap-x-3.5 gap-y-[22px]">
                <ItemCard
                  title="Lampe champignon en verre soufflé"
                  priceCents={8900}
                  domain="etsy.com"
                  tag={{ name: "Priorité", color: tagColorVar.rouille }}
                  isFavorite
                  photo={{ src480: "/textures/photo-backdrop.jpg" }}
                  photoClassName="h-[180px] sm:h-[260px]"
                />
                <ItemCard
                  title="Un bon massage"
                  tag={{ name: "Seconde main OK", color: tagColorVar.olive }}
                  photoClassName="h-[180px] sm:h-[260px]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              <Caps as="h3" className="m-0">
                Message éphémère + annuler
              </Caps>
              <div role="status" className="flex h-13 items-center gap-2.5 rounded-field bg-ink py-0 pr-2 pl-[18px] text-linen">
                <span className="flex-1 text-sm">Article supprimé</span>
                <Button variant="toast" size={40} icon={<Undo2 aria-hidden="true" />}>
                  Annuler
                </Button>
              </div>
              <p className="m-0 text-[13px] leading-normal text-muted">
                Toute suppression est réversible 8 s (suppression douce, purge après 30 jours). Pas de boîte de
                confirmation, sauf pour supprimer une liste entière.
              </p>
              <div>
                <ToastDemo />
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              <Caps as="h3" className="m-0">
                Mesures
              </Caps>
              <table className="border-collapse text-sm">
                <tbody>
                  {MEASURES.map(([label, value]) => (
                    <tr key={label} className="border-b border-line">
                      <th scope="row" className="py-[9px] text-left font-normal text-muted">
                        {label}
                      </th>
                      <td className="py-[9px] text-right font-semibold">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
