// Mapa de conflictos (SIG participativo): un mapa fijo con un punto numerado por conflicto.
// Al pulsarlo se abre su ficha: descripción, lo que dijeron las personas usuarias y fotos de campo.
// Grupos y colores, los del mapa de conflictos de Adrián (TFM, figura 37): puntos, zonas y líneas.
import { Map as MapaGL, Marker, NavigationControl, type ExpressionSpecification, type GeoJSONSourceSpecification, type MapLayerMouseEvent } from "maplibre-gl";
import { alAcercarse, BASE, cargar, esMovil } from "../comun";
import { cajaDe, coordenadas, estiloOrto, type Caja } from "../mapa";

type Rasgo = { type: "Feature"; properties: Record<string, string | number>; geometry: { type: string; coordinates: unknown } };
type Coleccion = { type: "FeatureCollection"; features: Rasgo[] };
type Tipo = "punto" | "zona" | "linea";
type Conflicto = { id: string; tipo: Tipo; num: number; corto: string; titulo: string; texto: string; color: string; citas: { texto: string; quien: string }[]; pins: number[][]; rasgos: Rasgo[]; fotos: number };

// Nombre corto (para la lista y el punto), color y número de fotos de cada conflicto, por su número
// en la capa (las fotos, de Adrián, en img/conflictos/<id>_<n>.webp).
const FICHAS: Record<string, { corto: string; color: string; fotos: number }> = {
  p5: { corto: "Asentamientos precarios", color: "#f5e03a", fotos: 4 },
  p1: { corto: "Control de accesos fuera de uso", color: "#e02020", fotos: 2 },
  p2: { corto: "Pasarela en mal estado", color: "#111827", fotos: 1 },
  p4: { corto: "Carteles rotos y desactualizados", color: "#22c7f0", fotos: 2 },
  p3: { corto: "Aseos cerrados y poco socorrismo", color: "#3be36b", fotos: 1 },
  p7: { corto: "Patrimonio con grafitis", color: "#d63aa8", fotos: 1 },
  p6: { corto: "Basura y malos olores bajo la pasarela", color: "#7a3b16", fotos: 2 },
  z4: { corto: "Vertido de escombros", color: "#111827", fotos: 1 },
  z3: { corto: "Perros sueltos", color: "#e02020", fotos: 3 },
  z2: { corto: "Masificación en días de buen tiempo", color: "#f5a623", fotos: 4 },
  z1: { corto: "Baño no recomendado", color: "#1f5fbf", fotos: 2 },
  l1: { corto: "Caminos informales", color: "#c9a227", fotos: 4 },
};
const GRUPOS: { tipo: Tipo; titulo: string }[] = [
  { tipo: "punto", titulo: "Puntos de conflicto" },
  { tipo: "zona", titulo: "Zonas de conflicto" },
  { tipo: "linea", titulo: "Líneas de conflicto" },
];
const ETIQUETA: Record<Tipo, string> = { punto: "Punto de conflicto", zona: "Zona de conflicto", linea: "Línea de conflicto" };

// «"Texto" (mujer, 31-45)» → { texto, quien: "Mujer, 31–45 años" }
const cita = (s: string) => {
  const m = s.trim().match(/^["“](.+?)["”]\s*\((\w+),\s*([\d-]+)(?:\s*años)?\)$/);
  if (!m) return { texto: s.replace(/^["“]|["”]$/g, ""), quien: "" };
  return { texto: m[1].charAt(0).toUpperCase() + m[1].slice(1), quien: `${m[2].charAt(0).toUpperCase()}${m[2].slice(1).toLowerCase()}, ${m[3].replace("-", "–")} años` };
};
// Centro de un polígono (centroide del anillo exterior mayor) o punto medio de una línea.
const centro = (r: Rasgo): number[] => {
  if (r.geometry.type.endsWith("LineString")) {
    const partes = (r.geometry.type === "LineString" ? [r.geometry.coordinates] : r.geometry.coordinates) as number[][][];
    const larga = partes.reduce((a, b) => (b.length > a.length ? b : a));
    return larga[Math.floor(larga.length / 2)];
  }
  const polis = (r.geometry.type === "Polygon" ? [r.geometry.coordinates] : r.geometry.coordinates) as number[][][][];
  const anillo = polis.map((p) => p[0]).reduce((a, b) => (b.length > a.length ? b : a));
  let [x, y, area] = [0, 0, 0];
  for (let i = 0; i < anillo.length - 1; i++) {
    const [[x0, y0], [x1, y1]] = [anillo[i], anillo[i + 1]];
    const k = x0 * y1 - x1 * y0;
    [x, y, area] = [x + (x0 + x1) * k, y + (y0 + y1) * k, area + k];
  }
  return [x / (3 * area), y / (3 * area)];
};
const claro = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};

function leer(puntos: Coleccion, zonas: Coleccion, lineas: Coleccion): Conflicto[] {
  const grupos = new Map<string, { tipo: Tipo; rasgos: Rasgo[] }>();
  const meter = (id: string, tipo: Tipo, r: Rasgo) => (grupos.get(id) ?? grupos.set(id, { tipo, rasgos: [] }).get(id)!).rasgos.push(r);
  puntos.features.forEach((r) => meter(`p${r.properties.punto}`, "punto", r));
  zonas.features.forEach((r) => meter(`z${r.properties.poligono}`, "zona", r));
  lineas.features.forEach((r, i) => meter(`l${i + 1}`, "linea", r));
  const lista = Object.keys(FICHAS)
    .filter((id) => grupos.has(id))
    .map((id) => {
      const { tipo, rasgos } = grupos.get(id)!;
      const p = rasgos[0].properties;
      const citas = [...new Set(rasgos.flatMap((r) => [r.properties.opiniones, r.properties.opiniones2]).filter((x): x is string => typeof x === "string" && x.trim() !== ""))].map(cita);
      return {
        id, tipo, num: 0, ...FICHAS[id], citas, rasgos,
        titulo: String(p.des ?? p["Título"] ?? "Generación de caminos complementarios al principal"),
        texto: String(p.Descripci ?? ""),
        pins: tipo === "punto" ? rasgos.map((r) => r.geometry.coordinates as number[]) : [centro(rasgos[0])],
      };
    });
  // Numeración en el orden de la lista: puntos, zonas y líneas.
  GRUPOS.flatMap((g) => lista.filter((c) => c.tipo === g.tipo)).forEach((c, i) => (c.num = i + 1));
  return lista.sort((a, b) => a.num - b.num);
}

export async function conflictos() {
  const cont = document.getElementById("mapa-conflictos");
  const panel = document.querySelector<HTMLElement>("[data-conflictos]");
  if (!cont || !panel) return;
  const [puntos, zonas, lineas] = await Promise.all(["conflicto_puntos", "conflicto_zonas", "conflicto_lineas"].map((c) => cargar<Coleccion>(`geo/${c}.json`)));
  const lista = leer(puntos, zonas, lineas);
  const porId = new Map(lista.map((c) => [c.id, c]));
  const pin = (c: Conflicto, extra = "") => `<span class="pin ${extra}" style="--c:${c.color};--t:${claro(c.color) ? "#111827" : "#fff"}">${c.num}</span>`;

  let elegido: string | null = null;
  let alElegir = (_id: string | null) => {};
  const elegir = (id: string | null) => {
    elegido = id;
    pintarPanel();
    alElegir(id);
  };

  const pintarPanel = () => {
    const c = elegido ? porId.get(elegido) : null;
    if (!c) {
      panel.innerHTML =
        `<p class="conflictos__ayuda">Pulsa un punto del mapa, o un conflicto de la lista, para ver el detalle.</p>` +
        GRUPOS.map((g) => `<h3 class="conflictos__grupo">${g.titulo}</h3><ul class="conflictos__lista">${lista
          .filter((x) => x.tipo === g.tipo)
          .map((x) => `<li><button type="button" data-id="${x.id}">${pin(x, "pin--mini")}<span>${x.corto}</span></button></li>`)
          .join("")}</ul>`).join("") +
        `<a class="mapa-descarga-conflictos" href="${BASE}descargas/mapa_conflictos.jpg" download><img src="${BASE}descargas/mini/conflictos.webp" alt="Mapa de conflictos del Confital" loading="lazy" width="640" height="453"/><span>↓ Descargar el mapa de conflictos</span></a>`;
      return;
    }
    const lugares = c.pins.length > 1 ? ` · en ${c.pins.length} lugares` : "";
    panel.innerHTML = `
      <button type="button" class="conflictos__volver" data-volver>← Todos los conflictos</button>
      <p class="conflictos__tipo">${pin(c, "pin--mini")} ${ETIQUETA[c.tipo]}${lugares}</p>
      <h3 class="conflictos__titulo">${c.corto}</h3>
      <p class="conflictos__oficial">${c.titulo}</p>
      <p>${c.texto}</p>
      ${c.citas.length ? `<h4>Lo que dicen las personas usuarias</h4>${c.citas.map((x) => `<blockquote class="conflictos__cita"><p>«${x.texto}»</p>${x.quien ? `<footer>${x.quien}</footer>` : ""}</blockquote>`).join("")}` : ""}
      ${c.fotos ? `<h4>Fotos de campo</h4><div class="conflictos__fotos${c.fotos === 1 ? " conflictos__fotos--una" : ""}">${Array.from({ length: c.fotos }, (_, i) => `<a href="${BASE}img/conflictos/${c.id}_${i + 1}.webp" target="_blank" rel="noopener"><img src="${BASE}img/conflictos/${c.id}_${i + 1}.webp" alt="Foto de campo ${i + 1}: ${c.corto.toLowerCase()}" loading="lazy"/></a>`).join("")}</div>` : ""}`;
  };
  panel.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-id], [data-volver]");
    if (!b) return;
    elegir(b.dataset.id ?? null);
    if (esMovil() && b.dataset.id) cont.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  addEventListener("keydown", (e) => e.key === "Escape" && elegido && elegir(null));
  pintarPanel();

  alAcercarse(cont, () => {
    // Encuadre inicial: los puntos y las zonas (la red de caminos ocupa toda la ladera y puede salirse).
    const todo: Caja = cajaDe(lista.flatMap((c) => [...c.pins, ...(c.tipo === "zona" ? c.rasgos.flatMap((r) => coordenadas(r.geometry)) : [])]));
    const margen = () => (esMovil() ? 30 : 60);
    const mapa = new MapaGL({ container: cont, style: estiloOrto(), bounds: todo, fitBoundsOptions: { padding: margen() }, attributionControl: false, fadeDuration: 0, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false });
    mapa.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapa.touchZoomRotate.disableRotation();

    // Zonas y líneas, siempre visibles en suave; la elegida, intensa.
    const fc = (tipo: Tipo) => ({ type: "FeatureCollection", features: lista.filter((c) => c.tipo === tipo).flatMap((c) => c.rasgos.map((r) => ({ ...r, properties: { id: c.id, color: c.color } }))) }) as unknown as GeoJSONSourceSpecification["data"];
    const segun = (si: number, no: number): ExpressionSpecification => ["case", ["==", ["get", "id"], elegido ?? ""], si, no];
    const pintarCapas = () => {
      if (!mapa.getLayer("zonas-relleno")) return;
      mapa.setPaintProperty("zonas-relleno", "fill-opacity", elegido ? segun(0.6, 0.12) : 0.3);
      mapa.setPaintProperty("zonas-borde", "line-width", segun(3, 1.5));
      mapa.setPaintProperty("lineas", "line-width", segun(4.5, 2.5));
      mapa.setPaintProperty("lineas", "line-opacity", elegido ? segun(1, 0.4) : 0.9);
    };
    mapa.on("load", () => {
      mapa.addSource("zonas", { type: "geojson", data: fc("zona") });
      mapa.addSource("lineas", { type: "geojson", data: fc("linea") });
      mapa.addLayer({ id: "zonas-relleno", type: "fill", source: "zonas", paint: { "fill-color": ["get", "color"], "fill-opacity": 0.3 } });
      mapa.addLayer({ id: "zonas-borde", type: "line", source: "zonas", paint: { "line-color": ["get", "color"], "line-width": 1.5 } });
      mapa.addLayer({ id: "lineas", type: "line", source: "lineas", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 2.5, "line-dasharray": [2, 1.2] } });
      pintarCapas();
    });
    mapa.on("click", "zonas-relleno", (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) elegir(id);
    });
    mapa.on("mouseenter", "zonas-relleno", () => (mapa.getCanvas().style.cursor = "pointer"));
    mapa.on("mouseleave", "zonas-relleno", () => (mapa.getCanvas().style.cursor = ""));

    // Un botón por lugar (los conflictos con varios lugares tienen varios puntos con el mismo número).
    const botones = lista.flatMap((c) =>
      c.pins.map((p) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "pin pin--mapa";
        el.style.cssText = `--c:${c.color};--t:${claro(c.color) ? "#111827" : "#fff"}`;
        el.textContent = String(c.num);
        el.setAttribute("aria-label", `${c.num}. ${c.corto}`);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          elegir(c.id);
        });
        // MapLibre coloca el marcador con `transform`: el botón va dentro para poder agrandarlo.
        const caja = document.createElement("div");
        caja.append(el);
        new Marker({ element: caja }).setLngLat(p as [number, number]).addTo(mapa);
        return { el, caja, id: c.id };
      }),
    );

    alElegir = (id) => {
      botones.forEach((b) => {
        b.el.classList.toggle("pin--activo", b.id === id);
        b.el.classList.toggle("pin--atenuado", !!id && b.id !== id);
        b.caja.style.zIndex = b.id === id ? "2" : "";
      });
      pintarCapas();
      const c = id ? porId.get(id) : null;
      const caja = c ? cajaDe([...c.pins, ...c.rasgos.flatMap((r) => coordenadas(r.geometry))]) : todo;
      mapa.fitBounds(caja, { padding: margen() + 20, maxZoom: 16.5, duration: 1200 });
    };
  });
}
