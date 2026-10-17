// Las unidades ambientales «como capas de la tierra»: al hacer scroll, cada unidad se eleva
// en 3D sobre la ortofoto, del mar a la ladera, y su ficha muestra cuánta gente cabe.
import { Map as MapaGL, type ExpressionSpecification, type GeoJSONSourceSpecification, type MapLayerMouseEvent } from "maplibre-gl";
import { alAcercarse, animar, cargar, esMovil, numeroES, pasos } from "../comun";
import { cajaDe, coordenadas, estiloOrto, type Caja } from "../mapa";

type Capacidad = { codigo: string; unidad: string; uso: string | null; ccf: number | null; ccr: number | null; cce: number | null; nota?: string };
type Coleccion = { type: "FeatureCollection"; features: { properties: { COD: string }; geometry: { coordinates: unknown } }[] };

// Colores del mapa de zonificación de Adrián.
const COLOR: Record<string, string> = { A1: "#8fc3e3", A2: "#4f86c6", B: "#7a5524", C: "#d8c59e", D: "#a6a6a6", E: "#f6e2c8", F: "#f2c879", G: "#f5a623" };
// Altura en el mapa (m): escalonada del mar a la ladera, como estratos.
const ALTURA: Record<string, number> = { A2: 4, A1: 6, B: 10, C: 16, D: 20, E: 26, F: 30, G: 40 };

const PASOS: { cods: string[]; titulo: string; texto: string }[] = [
  { cods: ["A2", "A1"], titulo: "El mar: las zonas de surf", texto: "La zona submareal, que nunca queda al descubierto, y la intermareal, que la marea cubre y descubre. En las dos se practica surf." },
  { cods: ["B"], titulo: "Área supramareal", texto: "La franja de costa por encima de la marea alta. Apenas se usa, así que no se calcula su capacidad." },
  { cods: ["C"], titulo: "Área de reposo", texto: "Donde la gente se tumba a descansar y tomar el sol. Aunque es una sola unidad, se calcula en dos partes: la plataforma de madera y las rocas de origen volcánico (depósitos hialoclastíticos)." },
  { cods: ["D"], titulo: "Pasarela de madera", texto: "El camino de madera por el que se entra y se pasea junto al mar." },
  { cods: ["E"], titulo: "Depósitos eólicos", texto: "Arenas que trae el viento, sobre roca volcánica. Se usan para tomar el sol y para descansar." },
  { cods: ["F"], titulo: "Pista de tierra", texto: "El camino de tierra que recorre el espacio: para ir en bici, andar o correr." },
  { cods: ["G"], titulo: "Talud", texto: "La ladera, degradada por la antigua actividad extractiva y con desprendimientos. No se usa, así que no se calcula su capacidad." },
];

const fila = (etiqueta: string, valor: number, max: number, clase = "") =>
  `<div class="cifra-fila ${clase}"><span>${etiqueta}</span><b>${numeroES(valor)}</b><div class="barra" style="color:${clase ? "var(--azul)" : "var(--gris-claro)"}"><i style="width:${(100 * valor) / max}%"></i></div></div>`;

const ficha = (cods: string[], cap: Capacidad[]) =>
  cods
    .map((cod) => {
      const filas = cap.filter((c) => c.codigo === cod);
      const nombre = filas[0]?.unidad ?? cod;
      const cuerpo = filas
        .map((c) =>
          c.ccf === null || c.ccr === null || c.cce === null
            ? `<p class="nota">${c.nota ?? "Sin cálculo"}</p>`
            : `${c.uso ? `<p class="cifras-unidad__uso">${c.uso.startsWith("C.") ? `${c.uso} · ${c.unidad}` : `Uso: ${c.uso.toLowerCase()}`}</p>` : ""}${fila("Caben por espacio", c.ccf, c.ccf)}${fila("Descontando el clima", c.ccr, c.ccf)}${fila("Con los servicios actuales, a la vez", c.cce, c.ccf, "cifra-fila--efectiva")}`,
        )
        .join("");
      return `<div class="cifras-unidad"><span class="chip-unidad" style="--c:${COLOR[cod]}"><i></i>${cods.length > 1 ? nombre : `Unidad ${cod}`}</span>${cuerpo}</div>`;
    })
    .join("");

export async function unidades() {
  const cont = document.getElementById("mapa-unidades");
  const pasosEl = document.querySelector('[data-pasos="unidades"]');
  if (!cont || !pasosEl) return;
  const [zonas, cap] = await Promise.all([cargar<Coleccion>("geo/zonificacion.json"), cargar<Capacidad[]>("capacidad.json")]);

  pasosEl.innerHTML =
    `<article class="paso"><p class="paso__fase">Zonificación</p><h3>Ocho unidades ambientales</h3><p>Cada unidad agrupa un trozo del Confital con características y usos parecidos. Vamos a recorrerlas del mar a la ladera.</p></article>` +
    PASOS.map((p) => `<article class="paso"><p class="paso__fase">Unidad ${p.cods.join(" y ")}</p><h3>${p.titulo}</h3><p>${p.texto}</p>${ficha(p.cods, cap)}</article>`).join("") +
    `<article class="paso"><p class="paso__fase">Todas juntas</p><h3>El Confital, pieza a pieza</h3><p>Ahora puedes tocar cualquier unidad del mapa para ver su ficha.</p><div data-ficha-libre><p class="nota">Toca una unidad del mapa.</p></div></article>`;

  const cajas: Record<string, Caja> = {};
  zonas.features.forEach((f) => (cajas[f.properties.COD] = cajaDe(coordenadas(f.geometry))));
  const unir = (cods: string[]): Caja => cajaDe(cods.flatMap((c) => [[cajas[c][0], cajas[c][1]], [cajas[c][2], cajas[c][3]]]));
  const todas = Object.keys(cajas);

  alAcercarse(cont, () => {
    const mapa = new MapaGL({ container: cont, style: estiloOrto(), bounds: unir(todas), fitBoundsOptions: { padding: 40 }, pitch: 55, bearing: 40, attributionControl: false, fadeDuration: 0 });
    // Sin gestos (el scroll es de la página), pero con clics para la ficha final.
    mapa.scrollZoom.disable();
    mapa.dragPan.disable();
    mapa.dragRotate.disable();
    mapa.touchZoomRotate.disable();
    mapa.doubleClickZoom.disable();
    mapa.keyboard.disable();

    const alturas: Record<string, number> = Object.fromEntries(todas.map((c) => [c, 0]));
    let visibles: string[] = [];
    let activas: string[] = [];
    const expr = (valores: Record<string, number | string>, defecto: number | string) =>
      ["match", ["get", "COD"], ...Object.entries(valores).flat(), defecto] as unknown as ExpressionSpecification;
    const pintar = () => {
      if (!mapa.getLayer("unidades-3d")) return;
      mapa.setPaintProperty("unidades-3d", "fill-extrusion-height", expr(alturas, 0));
      mapa.setFilter("unidades-3d", ["in", ["get", "COD"], ["literal", visibles]]);
      mapa.setFilter("unidades-borde", ["in", ["get", "COD"], ["literal", activas]]);
    };

    mapa.on("load", () => {
      mapa.addSource("zonas", { type: "geojson", data: zonas as unknown as GeoJSONSourceSpecification["data"] });
      mapa.addLayer({ id: "unidades-3d", type: "fill-extrusion", source: "zonas", paint: { "fill-extrusion-color": expr(COLOR, "#ccc"), "fill-extrusion-height": 0, "fill-extrusion-opacity": 0.92 } });
      mapa.addLayer({ id: "unidades-borde", type: "line", source: "zonas", paint: { "line-color": "#ffffff", "line-width": 3 }, filter: ["in", ["get", "COD"], ["literal", []]] });
      pintar();
    });

    let cancelar = () => {};
    const ir = (cods: string[], suben: string[]) => {
      activas = cods;
      visibles = [...new Set([...visibles, ...suben])];
      const desde = { ...alturas };
      cancelar();
      cancelar = animar(1200, (t) => {
        suben.forEach((c) => (alturas[c] = desde[c] + (ALTURA[c] - desde[c]) * t));
        pintar();
      });
      mapa.fitBounds(unir(cods.length ? cods : todas), { padding: esMovil() ? 30 : 80, pitch: 55, bearing: 40, duration: 1600, maxZoom: 16.6 });
    };

    pasos(pasosEl, (i) => {
      if (i === 0) ir([], []);
      else if (i <= PASOS.length) ir(PASOS[i - 1].cods, PASOS.slice(0, i).flatMap((p) => p.cods));
      else ir([], todas);
    });

    const libre = pasosEl.querySelector("[data-ficha-libre]");
    mapa.on("click", "unidades-3d", (e: MapLayerMouseEvent) => {
      const cod = (e.features?.[0]?.properties as { COD?: string } | undefined)?.COD;
      if (!cod || !libre) return;
      const paso = PASOS.find((p) => p.cods.includes(cod));
      libre.innerHTML = `<h3 style="font-size:1.25rem;margin:8px 0">${paso?.titulo ?? cod}</h3>${ficha([cod], cap)}`;
      activas = [cod];
      pintar();
    });
    mapa.on("mouseenter", "unidades-3d", () => (mapa.getCanvas().style.cursor = "pointer"));
    mapa.on("mouseleave", "unidades-3d", () => (mapa.getCanvas().style.cursor = ""));
  });
}
