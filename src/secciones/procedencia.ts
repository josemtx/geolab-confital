// De dónde viene la gente: al hacer scroll se dibujan líneas de flujo de cada barrio (y luego de
// cada municipio) al Confital, más gruesas cuantas más personas vienen de allí, como en el vídeo.
// Los grosores y las cifras salen de las respuestas en vivo; de las capas de Adrián solo se usa
// la geometría (el origen de cada línea y las zonas urbanas de barrios y municipios).
import { Map as MapaGL, Marker, type ExpressionSpecification, type GeoJSONSource, type GeoJSONSourceSpecification } from "maplibre-gl";
import { alAcercarse, animar, BASE, cargar, esMovil, pasos } from "../comun";
import { cajaDe, CONFITAL, coordenadas, estiloOrto, type Caja } from "../mapa";
import type { Respuesta } from "../respuestas";

type Rasgo = { type: "Feature"; properties: Record<string, string | number>; geometry: { type: string; coordinates: unknown } };
type Coleccion = { type: "FeatureCollection"; features: Rasgo[] };
type Lugar = { nombre: string; n: number };

const normalizar = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const pct = (a: number, b: number) => `${Math.round((100 * a) / (b || 1))} %`;
const personas = (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`;
const lista = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs.at(-1)}` : xs[0] ?? "");

const MISMO = "Mismo municipio", OTRO = "Otro municipio de Gran Canaria";
const FLUJO = "#ffd166", ZONA = "#8ba5ff";

// Arco suave del origen al Confital (curva cuadrática, en grados: a esta escala basta).
const arco = (o: number[], d: number[], N = 48) => {
  const [mx, my] = [(o[0] + d[0]) / 2, (o[1] + d[1]) / 2];
  const [dx, dy] = [d[0] - o[0], d[1] - o[1]];
  const c = [mx - dy * 0.22, my + dx * 0.22];
  return Array.from({ length: N + 1 }, (_, i) => {
    const t = i / N;
    return [(1 - t) ** 2 * o[0] + 2 * (1 - t) * t * c[0] + t ** 2 * d[0], (1 - t) ** 2 * o[1] + 2 * (1 - t) * t * c[1] + t ** 2 * d[1]];
  });
};
// De las dos puntas de cada línea de Adrián, el origen es la más lejana al Confital.
const origen = (g: Rasgo["geometry"]) => {
  const c = coordenadas(g);
  const lejos = (p: number[]) => (p[0] - CONFITAL[0]) ** 2 + (p[1] - CONFITAL[1]) ** 2;
  return lejos(c[0]) > lejos(c.at(-1)!) ? c[0] : c.at(-1)!;
};

const contar = (rs: Respuesta[], proc: string): Lugar[] => {
  const m = new Map<string, number>();
  rs.filter((r) => r.Procedencia === proc && r.Lugar_concreto).forEach((r) => m.set(String(r.Lugar_concreto), (m.get(String(r.Lugar_concreto)) ?? 0) + 1));
  return [...m].map(([nombre, n]) => ({ nombre, n })).sort((a, b) => b.n - a.n);
};

const DESCARGAS = [["autonomica", "Canarias"], ["nacional", "España"], ["europea", "Europa"], ["mundial", "América"]];

// Textos de cada paso (se recalculan con cada respuesta nueva).
function textos(rs: Respuesta[], baja: Set<string>) {
  const barrios = contar(rs, MISMO), munis = contar(rs, OTRO);
  const nCiudad = rs.filter((r) => r.Procedencia === MISMO).length, nIsla = rs.filter((r) => r.Procedencia === OTRO).length;
  const nBaja = barrios.filter((b) => baja.has(normalizar(b.nombre))).reduce((a, b) => a + b.n, 0);
  const [b1, ...resto] = barrios, siguientes = resto.slice(0, 3), demas = resto.slice(3);
  const fuera = rs.length - nCiudad - nIsla;
  return {
    barrios, munis, destacados: [b1, ...siguientes].map((b) => b.nombre),
    pasos: [
      { fase: "Procedencia", titulo: "Un espacio de la ciudad", texto: `<strong>${pct(nCiudad, rs.length)}</strong> de quienes respondieron vive en el propio municipio de Las Palmas de Gran Canaria. Cada línea une su barrio con el Confital: cuanto más gruesa, más personas vienen de allí.` },
      { fase: "El barrio vecino", titulo: b1.nombre, texto: `<strong>${personas(b1.n)}</strong>. Es, con diferencia, el barrio que más visitantes aporta: está a un paseo del Confital.` },
      { fase: "Les siguen", titulo: lista(siguientes.map((b) => b.nombre)), texto: siguientes.map((b) => `${b.nombre}: <strong>${personas(b.n)}</strong>`).join(" · ") },
      { fase: "Toda la ciudad", titulo: `${barrios.length} barrios`, texto: `Los otros ${demas.length} barrios aportan entre ${demas.at(-1)?.n ?? 1} y ${demas[0]?.n ?? 1} personas cada uno.` },
      {
        fase: "La Ciudad Baja", titulo: "Los barrios del istmo y la costa",
        texto: `Los ocho barrios de la Ciudad Baja aportan <strong>${pct(nBaja, nCiudad)}</strong> de las personas de la ciudad (${nBaja} de ${nCiudad}), quizá por su cercanía y su mejor conexión en transporte público.</p><p><a class="boton-descarga" href="${BASE}descargas/procedencia_escala_municipal.jpg" download>↓ Descargar el mapa de procedencia por barrios</a>`,
      },
      {
        fase: "Gran Canaria", titulo: "El resto de la isla",
        texto: `<strong>${pct(nIsla, rs.length)}</strong> viene de otros municipios de Gran Canaria. ${lista(munis.slice(0, 3).map((m) => `${m.nombre} (${m.n})`))} encabezan la lista.</p><p><a class="boton-descarga" href="${BASE}descargas/procedencia_escala_insular.jpg" download>↓ Descargar el mapa de procedencia por municipios</a>`,
      },
      {
        fase: "Más allá", titulo: "De fuera de la isla",
        texto: `Y <strong>${pct(fuera, rs.length)}</strong> viene de fuera de Gran Canaria: de otras islas, del resto de España o de otros países. Sus mapas, para descargar:</p><div class="mapas-descarga">${DESCARGAS.map(([f, t]) => `<a href="${BASE}descargas/procedencia_escala_${f}.jpg" download><img src="${BASE}descargas/mini/${f}.webp" alt="Mapa de procedencia: ${t}" loading="lazy" width="640" height="452"/><span>↓ ${t}</span></a>`).join("")}</div><p>`,
      },
    ],
  };
}

export function procedencia() {
  const cont = document.getElementById("mapa-flujos");
  const pasosEl = document.querySelector<HTMLElement>('[data-pasos="procedencia"]');
  if (!cont || !pasosEl) return () => {};
  const capas = Promise.all(["barrios", "municipios", "ciudad_baja", "flujos_barrios", "flujos_municipios"].map((c) => cargar<Coleccion>(`geo/${c}.json`)));
  let rs: Respuesta[] = [];
  let t: ReturnType<typeof textos> | null = null;
  let paso = 0;
  let redibujar = (_cambiaVista: boolean) => {};

  // Los pasos se montan una vez; con cada actualización solo cambia su contenido.
  const montar = async () => {
    const [, , baja] = await capas;
    const nuevo = (t = textos(rs, new Set(baja.features.map((f) => normalizar(f.properties.barrio)))));
    if (!pasosEl.childElementCount) {
      pasosEl.innerHTML = nuevo.pasos.map(() => `<article class="paso"><div data-cuerpo></div></article>`).join("");
      pasos(pasosEl, (i) => {
        const cambiaVista = (paso >= 5) !== (i >= 5);
        paso = i;
        redibujar(cambiaVista);
      });
    }
    pasosEl.querySelectorAll("[data-cuerpo]").forEach((el, i) => {
      const p = nuevo.pasos[i];
      el.innerHTML = `<p class="paso__fase">${p.fase}</p><h3>${p.titulo}</h3><p>${p.texto}</p>`;
    });
    redibujar(false);
  };

  alAcercarse(cont, async () => {
    const [barrios, munis, baja, fBarrios, fMunis] = await capas;
    const mapa = new MapaGL({ container: cont, style: estiloOrto(), bounds: cajaDe(coordenadas({ coordinates: barrios.features.map((f) => f.geometry.coordinates) })), fitBoundsOptions: { padding: 40 }, attributionControl: false, fadeDuration: 0, interactive: false });
    const vistaCiudad = (): Caja => cajaDe([...coordenadas({ coordinates: fBarrios.features.map((f) => f.geometry.coordinates) }), CONFITAL]);
    const vistaIsla = (): Caja => cajaDe([...coordenadas({ coordinates: munis.features.map((f) => f.geometry.coordinates) }), CONFITAL]);

    // Una línea por lugar (barrio o municipio), con su origen y su recuento.
    const lineas = [
      ...fBarrios.features.map((f) => ({ clave: normalizar(f.properties.nom_prov), escala: "barrio", o: origen(f.geometry) })),
      ...fMunis.features.map((f) => ({ clave: normalizar(f.properties.municipio), escala: "municipio", o: origen(f.geometry) })),
    ].map((l) => ({ ...l, ruta: arco(l.o, CONFITAL), n: 0, avance: 0, meta: 0 }));
    const datosLineas = () => ({
      type: "FeatureCollection",
      features: lineas
        .filter((l) => l.n && l.avance > 0)
        .sort((a, b) => a.n - b.n)
        .map((l) => ({ type: "Feature", properties: { n: l.n, escala: l.escala }, geometry: { type: "LineString", coordinates: l.ruta.slice(0, Math.max(2, Math.ceil(l.avance * l.ruta.length))) } })),
    });
    const zonas = (fc: Coleccion, campo: string, encendidas: Set<string>, cuenta: Map<string, number>) => ({
      ...fc,
      features: fc.features.map((f) => ({ ...f, properties: { ...f.properties, n: cuenta.get(normalizar(f.properties[campo])) ?? 0, on: encendidas.has(normalizar(f.properties[campo])) ? 1 : 0 } })),
    });

    let marcas: Marker[] = [];
    // El rótulo va a la derecha del punto, salvo que no quepa (≈ 7,5 px por letra; los largos parten en dos líneas).
    const lado = (lngLat: number[], texto: string) => (mapa.project(lngLat as [number, number]).x + 14 + Math.min(texto.length * 7.5, 150) > cont.clientWidth ? "right" : "left");
    const etiqueta = (lngLat: number[], texto: string, clase = "", anchor: "left" | "right" | "center" = lado(lngLat, texto)) => {
      const el = document.createElement("span");
      el.className = `mapa-etiqueta ${clase}`;
      el.textContent = texto;
      return new Marker({ element: el, anchor, offset: [anchor === "left" ? 10 : anchor === "right" ? -12 : 0, 0] }).setLngLat(lngLat as [number, number]).addTo(mapa);
    };
    const linea = (clave: string) => lineas.find((l) => l.clave === clave);

    let cancelar = () => {};
    const pintar = () => {
      if (!t || !mapa.getSource("flujos")) return;
      const cB = new Map(t.barrios.map((b) => [normalizar(b.nombre), b.n])), cM = new Map(t.munis.map((m) => [normalizar(m.nombre), m.n]));
      lineas.forEach((l) => (l.n = (l.escala === "barrio" ? cB : cM).get(l.clave) ?? 0));
      // Qué se ve en cada paso
      const top = t.destacados.map(normalizar);
      const verB = paso === 0 ? [] : paso === 1 ? top.slice(0, 1) : paso === 2 ? top : [...cB.keys()];
      const verM = paso >= 5 ? [...cM.keys()] : [];
      lineas.forEach((l) => (l.meta = (l.escala === "barrio" ? verB : verM).includes(l.clave) ? 1 : 0));
      (mapa.getSource("barrios") as GeoJSONSource).setData(zonas(barrios, "barrio", new Set(verB), cB) as GeoJSONSourceSpecification["data"] & object);
      (mapa.getSource("municipios") as GeoJSONSource).setData(zonas(munis, "MUNICIPI", new Set(verM), cM) as GeoJSONSourceSpecification["data"] & object);
      for (const id of ["ciudad-baja", "ciudad-baja-relleno"]) mapa.setLayoutProperty(id, "visibility", paso === 4 ? "visible" : "none");
      mapa.setPaintProperty("flujos-barrio", "line-opacity", paso >= 5 ? 0.35 : 0.95);
      // Las líneas nuevas se dibujan desde su origen; las que sobran se recogen.
      const desde = lineas.map((l) => l.avance);
      cancelar();
      cancelar = animar(1600, (k) => {
        lineas.forEach((l, i) => (l.avance = desde[i] + (l.meta - desde[i]) * k));
        (mapa.getSource("flujos") as GeoJSONSource).setData(datosLineas() as GeoJSONSourceSpecification["data"] & object);
      });
      // Rótulos
      marcas.forEach((m) => m.remove());
      marcas = [etiqueta(CONFITAL, "El Confital", "mapa-etiqueta--destino", "right")]; // a su izquierda está el mar
      const nombres = paso === 1 || paso === 2 ? t.barrios.filter((b) => verB.includes(normalizar(b.nombre))) : paso >= 5 ? t.munis.slice(0, paso === 5 ? 3 : 0) : [];
      nombres.forEach((x) => {
        const l = linea(normalizar(x.nombre));
        if (l) marcas.push(etiqueta(l.o, `${x.nombre} · ${x.n}`));
      });
      if (paso === 4) {
        const c = cajaDe(coordenadas({ coordinates: baja.features.map((f) => f.geometry.coordinates) }));
        marcas.push(etiqueta([(c[0] + c[2]) / 2, (c[1] + c[3]) / 2], "Ciudad Baja", "mapa-etiqueta--zona", "center"));
      }
    };

    mapa.on("load", () => {
      const vacio = { type: "FeatureCollection", features: [] } as GeoJSONSourceSpecification["data"];
      const intensidad = (max: number): ExpressionSpecification => ["case", ["==", ["get", "on"], 1], ["interpolate", ["linear"], ["get", "n"], 1, 0.3, 30, max], 0];
      for (const [id, fc] of [["barrios", barrios], ["municipios", munis]] as const) {
        mapa.addSource(id, { type: "geojson", data: fc as unknown as GeoJSONSourceSpecification["data"] });
        mapa.addLayer({ id: `${id}-relleno`, type: "fill", source: id, paint: { "fill-color": ZONA, "fill-opacity": intensidad(0.75) } });
        mapa.addLayer({ id: `${id}-borde`, type: "line", source: id, paint: { "line-color": "#ffffff", "line-opacity": 0.35, "line-width": 0.6 } });
      }
      mapa.addSource("ciudad-baja", { type: "geojson", data: baja as unknown as GeoJSONSourceSpecification["data"] });
      mapa.addLayer({ id: "ciudad-baja-relleno", type: "fill", source: "ciudad-baja", layout: { visibility: "none" }, paint: { "fill-color": "#ffffff", "fill-opacity": 0.45 } });
      mapa.addLayer({ id: "ciudad-baja", type: "line", source: "ciudad-baja", layout: { visibility: "none", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 2 } });
      mapa.addSource("flujos", { type: "geojson", data: vacio });
      const ancho: ExpressionSpecification = ["interpolate", ["linear"], ["get", "n"], 1, 1.6, 30, 15];
      for (const escala of ["barrio", "municipio"]) {
        const filtro: ExpressionSpecification = ["==", ["get", "escala"], escala];
        mapa.addLayer({ id: `flujos-${escala}-sombra`, type: "line", source: "flujos", filter: filtro, layout: { "line-cap": "round" }, paint: { "line-color": "#0b1020", "line-opacity": 0.45, "line-width": ["+", ancho, 3] } });
        mapa.addLayer({ id: `flujos-${escala}`, type: "line", source: "flujos", filter: filtro, layout: { "line-cap": "round" }, paint: { "line-color": FLUJO, "line-opacity": 0.95, "line-width": ancho } });
      }
      mapa.addSource("confital", { type: "geojson", data: { type: "Point", coordinates: CONFITAL } });
      mapa.addLayer({ id: "confital", type: "circle", source: "confital", paint: { "circle-radius": 7, "circle-color": "#ffffff", "circle-stroke-color": "#0038ff", "circle-stroke-width": 3 } });
      redibujar = (cambiaVista) => {
        pintar();
        if (cambiaVista) mapa.fitBounds(paso >= 5 ? vistaIsla() : vistaCiudad(), { padding: esMovil() ? { top: 30, bottom: 130, left: 12, right: 12 } : 60, duration: 2400 });
      };
      redibujar(paso >= 5);
    });
  });

  // Se llama con cada lote de respuestas (las mismas que el resto de la página).
  return (nuevas: Respuesta[]) => {
    rs = nuevas;
    montar();
  };
}
