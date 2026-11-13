// Bouton de favoris « Ajouter à Envies » (docs/07-extraction-liens.md § « Bouton de favoris »).
// Certaines boutiques refusent leurs pages au serveur. Le favori lit la fiche produit dans le
// navigateur de la personne, qui la voit déjà : nom, prix et photo depuis le JSON-LD,
// OpenGraph ou les microdonnées, comme l'extraction du serveur. Sans IA.
// Il ouvre ensuite `/partage` avec ces infos ; rien n'est envoyé ailleurs.

/** Ce que le favori lit dans une page. Toutes les valeurs sont du texte brut, vérifié au serveur. */
export type PageProduct = { url: string; title: string; price: string; currency: string; image: string };

/**
 * Lecture de la fiche produit, en JavaScript ES5 brut : ce texte est copié tel quel dans le
 * favori (pas de compilation ni de minification entre les tests et le navigateur).
 * Expression de fonction `(doc, href) → PageProduct`.
 */
export const READ_PRODUCT_JS = String.raw`function (doc, href) {
  var product = null;
  function list(x) { return x === null || x === undefined ? [] : Array.isArray(x) ? x : [x]; }
  function obj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  function walk(node, depth) {
    if (!node || typeof node !== "object" || depth > 8 || product) return;
    if (Array.isArray(node)) { for (var k = 0; k < node.length; k++) walk(node[k], depth + 1); return; }
    if (/(^| )(Product|ProductGroup|IndividualProduct|ProductModel)( |$)/.test(list(node["@type"]).join(" "))) {
      product = node;
      return;
    }
    walk(node["@graph"], depth + 1);
    walk(node.mainEntity, depth + 1);
    walk(node.itemListElement, depth + 1);
  }
  var scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (var s = 0; s < scripts.length; s++) {
    try { walk(JSON.parse(scripts[s].textContent || ""), 0); } catch (e) {}
  }
  function meta(name) {
    var e = doc.querySelector('meta[property="' + name + '"],meta[name="' + name + '"]');
    return (e && e.getAttribute("content")) || "";
  }
  function prop(name) {
    var e = doc.querySelector('[itemprop="' + name + '"]');
    if (!e) return "";
    return e.getAttribute("content") || e.getAttribute("src") || e.getAttribute("href") || e.textContent || "";
  }
  function pick(selector, attrs) {
    var e = doc.querySelector(selector);
    if (!e) return "";
    for (var a = 0; a < attrs.length; a++) {
      var v = attrs[a] === "text" ? e.textContent : e.getAttribute(attrs[a]);
      if (v) return v;
    }
    return "";
  }
  function imageOf(x) {
    var first = list(x)[0];
    if (typeof first === "string") return first;
    var o = obj(first);
    return String(o.url || o.contentUrl || "");
  }
  var title = "", price = "", currency = "", image = "";
  if (product) {
    var variant = obj(list(product.hasVariant)[0]);
    var offer = obj(list(product.offers)[0]);
    if (!offer.price && !offer.lowPrice && list(offer.offers).length) offer = obj(list(offer.offers)[0]);
    if (!offer.price && !offer.lowPrice) offer = obj(list(variant.offers)[0]);
    var spec = obj(list(offer.priceSpecification)[0]);
    title = String(product.name || "");
    price = String(offer.price || offer.lowPrice || spec.price || "");
    currency = String(offer.priceCurrency || spec.priceCurrency || "");
    image = imageOf(product.image) || imageOf(variant.image);
  }
  title = title || pick("#productTitle", ["text"]) || meta("og:title") || meta("twitter:title") || doc.title || "";
  price = price || meta("product:price:amount") || meta("og:price:amount") || prop("price") ||
    pick("#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen", ["text"]) ||
    pick(".a-price .a-offscreen", ["text"]);
  currency = currency || meta("product:price:currency") || meta("og:price:currency") || prop("priceCurrency");
  image = image || meta("og:image:secure_url") || meta("og:image") || meta("twitter:image") || prop("image") ||
    pick("#landingImage, #imgBlkFront, #main-image", ["data-old-hires", "src"]);
  try { image = image ? new URL(image, href).href : ""; } catch (e) { image = ""; }
  if (!/^https?:/i.test(image)) image = "";
  function clean(v, max) { return String(v).replace(/\s+/g, " ").replace(/^ | $/g, "").slice(0, max); }
  return {
    url: String(href).slice(0, 2048),
    title: clean(title, 300),
    price: clean(price, 40),
    currency: clean(currency, 3),
    image: image.slice(0, 2048)
  };
}`;

/** Code du favori (`javascript:…`) qui ouvre `{origin}/partage` avec ce que la page donne. */
export function bookmarkletHref(origin: string): string {
  const target = JSON.stringify(origin.replace(/\/+$/, "") + "/partage?");
  const code =
    `(function(){var r=(${READ_PRODUCT_JS})(document,location.href);` +
    "var q=new URLSearchParams({url:r.url,title:r.title,price:r.price,currency:r.currency,image:r.image,depuis:'favori'});" +
    `var u=${target}+q.toString();` +
    "if(!window.open(u,'_blank'))location.href=u;})();";
  return "javascript:" + encodeURIComponent(code);
}
