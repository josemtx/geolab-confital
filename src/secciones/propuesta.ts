// Propuesta de solución: la ruta interpretativa de Castaño-Santana (2025) contada con scroll.
// Primero las dos rutas (costa y cornisa) y los usos de cada tramo; después los paneles que
// propone, que se abren al pulsarlos. Confi, el personaje de la ruta, acompaña cada paso.
import { Map as MapaGL, Marker, type ExpressionSpecification, type GeoJSONSourceSpecification } from "maplibre-gl";
import { alAcercarse, animar, BASE, cargar, esMovil, pasos } from "../comun";
import { cajaDe, coordenadas, estiloOrto, type Caja } from "../mapa";

type Linea = { type: string; coordinates: unknown };
type Ruta = { id: "costa" | "cornisa"; resumen: string; textos: string[]; longitud_m: number; foto: string; geometry: Linea };
type Uso = { id: string; nombre: string; textos: string[]; longitud_m: number; foto: string; geometry: Linea };
type Panel = { id: string; ruta: "costa" | "cornisa"; orden: number; titulo: string; tematica: string; textos: string[]; cartel: string | null; recreacion: boolean; coordinates: [number, number] };
type Propuesta = { general: { titulo: string; textos: string[]; foto: string }; confi: { textos: string[]; poses: string[] }; rutas: Ruta[]; usos: Uso[]; paneles: Panel[] };

const COLOR_RUTA = { costa: "#38bdf8", cornisa: "#facc15" };
const COLOR_USO: Record<string, string> = { paseo: "#22c55e", deportivo: "#f97316", compartido: "#a855f7", adaptado: "#2563eb" };
const NOMBRE_RUTA = { costa: "Costa", cornisa: "Cornisa" };
const km = (m: number) => `${(m / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} km`;
// Longitud y duración de cada recorrido, las del TFG (las capas dan algo más o menos según el trazado).
const MEDIDAS = { costa: "4,9 km · unos 60 minutos", cornisa: "2,4 km · unos 30 minutos" };

// Un texto del TFG puede traer listas («-Acantilados inactivos.»): se pintan como tales.
const html = (t: string) => {
  const lineas = t.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lineas.length === 1) return `<p>${t}</p>`;
  const cabeza = lineas.filter((l) => !l.startsWith("-")), items = lineas.filter((l) => l.startsWith("-"));
  return `${cabeza.map((l) => `<p><strong>${l}</strong></p>`).join("")}<ul>${items.map((l) => `<li>${l.slice(1).trim()}</li>`).join("")}</ul>`;
};
const confiDice = (img: string, texto: string) =>
  `<div class="confi-dice"><img src="${BASE}${img}" alt="" width="64" height="76"/><p><b>Confi</b>${texto}</p></div>`;

export async function propuesta() {
  const cont = document.getElementById("mapa-propuesta");
  const pasosEl = document.querySelector<HTMLElement>('[data-pasos="propuesta"]');
  const galeria = document.querySelector<HTMLElement>("[data-carteles]");
  const dialogo = document.querySelector<HTMLDialogElement>("[data-panel-dialogo]");
  if (!cont || !pasosEl || !dialogo) return;
  const d = await cargar<Propuesta>("propuesta.json");
  const ruta = (id: "costa" | "cornisa") => d.rutas.find((r) => r.id === id)!;
  const paneles = (id: "costa" | "cornisa") => d.paneles.filter((p) => p.ruta === id);
  const confi = d.confi.poses[0];

  // --- Ficha de un panel (diálogo nativo, con anterior y siguiente dentro de su ruta) ---------
  const abrir = (id: string) => {
    const p = d.paneles.find((x) => x.id === id);
    if (!p) return;
    const lista = paneles(p.ruta), i = lista.indexOf(p);
    dialogo.innerHTML = `
      <form method="dialog" class="panel-dialogo__cerrar"><button aria-label="Cerrar">×</button></form>
      <p class="panel-dialogo__ruta"><span class="pin-ruta" style="--c:${COLOR_RUTA[p.ruta]}">${p.orden}</span> Ruta por la ${NOMBRE_RUTA[p.ruta].toLowerCase()} · panel ${p.orden} de ${lista.length}</p>
      <h3>${p.titulo}</h3>
      <p class="panel-dialogo__tema">${p.tematica}</p>
      ${p.cartel ? `<figure><img src="${BASE}${p.cartel}" alt="${p.recreacion ? "Recreación de la ruta con Confi" : `Cartel propuesto: ${p.titulo}`}"/><figcaption>${p.recreacion ? "Recreación de la propuesta" : "Diseño del cartel propuesto"}</figcaption></figure>` : ""}
      ${p.textos.map(html).join("")}
      <nav class="panel-dialogo__nav">
        ${i > 0 ? `<button type="button" data-abrir="${lista[i - 1].id}">← ${lista[i - 1].titulo}</button>` : "<span></span>"}
        ${i < lista.length - 1 ? `<button type="button" data-abrir="${lista[i + 1].id}">${lista[i + 1].titulo} →</button>` : ""}
      </nav>`;
    if (!dialogo.open) dialogo.showModal();
    dialogo.scrollTop = 0;
  };
  document.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-abrir]");
    if (b) abrir(b.dataset.abrir!);
  });
  // Cerrar al pulsar fuera de la ficha
  dialogo.addEventListener("click", (e) => e.target === dialogo && dialogo.close());

  // --- Pasos del scroll --------------------------------------------------------------------------
  const listaPaneles = (id: "costa" | "cornisa") =>
    `<ol class="lista-paneles">${paneles(id).map((p) => `<li><button type="button" data-abrir="${p.id}"><span class="pin-ruta" style="--c:${COLOR_RUTA[id]}">${p.orden}</span>${p.titulo}</button></li>`).join("")}</ol>`;
  const fichaRuta = (id: "costa" | "cornisa", fase: string, titulo: string, dice: string) => {
    const r = ruta(id);
    return `<p class="paso__fase">${fase}</p><h3>${titulo}</h3><p class="paso__meta"><span class="muestra muestra--ruta" style="--c:${COLOR_RUTA[id]}"></span>${MEDIDAS[id]} · ${paneles(id).length} paneles</p>
      <p>${r.resumen}</p><p>${r.textos[1] ?? ""}</p><img class="paso__foto" src="${BASE}${r.foto}" alt="Ruta por la ${NOMBRE_RUTA[id].toLowerCase()}" loading="lazy"/>${confiDice(confi, dice)}`;
  };
  const usos = ["paseo", "deportivo", "compartido", "adaptado"].map((id) => d.usos.find((u) => u.id === id)!).filter(Boolean);
  const PASOS = [
    `<p class="paso__fase">La propuesta</p><h3>Una ruta, dos recorridos</h3><p>${d.general.textos[1]}</p><p>${d.general.textos[2]}</p>
      ${confiDice(confi, "¡Hola! Soy Confi. Mi forma redonda y blanca viene de los rodolitos, unas algas que, al acumularse, recuerdan a los confites: de ahí el nombre de El Confital. Te acompaño por la ruta.")}`,
    fichaRuta("costa", "Recorrido 1", "Por la costa", "Aquí ves de cerca la plataforma litoral, las plantas que aguantan la sal y las huellas de las salinas, los secaderos y las chabolas."),
    `<p class="paso__fase">Cada tramo, su uso</p><h3>Paseo, deporte y tramos compartidos</h3><p>${d.general.textos[6]}</p>
      <ul class="usos-ruta">${usos.map((u) => `<li><span class="muestra muestra--ruta" style="--c:${COLOR_USO[u.id]}"></span><div><b>${u.nombre} · ${km(u.longitud_m)}</b><span>${u.textos[0]}</span></div></li>`).join("")}</ul>
      <p class="nota">El tramo adaptado está en la cornisa: no todo el itinerario es accesible para personas con movilidad reducida.</p>`,
    fichaRuta("cornisa", "Recorrido 2", "Por la cornisa", "Desde arriba se entiende todo: el Confital, Las Coloradas, La Isleta y la ciudad, y cómo han cambiado con el tiempo."),
    `<p class="paso__fase">Los paneles de la costa</p><h3>${paneles("costa").length} paneles junto al mar</h3><p>De la bienvenida a La Machacadora: geología, flora y fauna, historia y patrimonio. Pulsa uno para leerlo.</p>${listaPaneles("costa")}`,
    `<p class="paso__fase">Los paneles de la cornisa</p><h3>${paneles("cornisa").length} paneles con vistas</h3><p>La ciudad, el barrio de Las Coloradas, la Cueva de Los Canarios y la panorámica de 360º. Pulsa uno para leerlo.</p>${listaPaneles("cornisa")}`,
    `<p class="paso__fase">Explora</p><h3>Toda la ruta, panel a panel</h3><p>${d.general.textos[7] ?? ""}</p><p>Pulsa cualquier número del mapa para leer su panel.</p>
      ${confiDice(confi, "Estaré en los carteles con preguntas, curiosidades y pequeños retos. ¿Serás capaz de encontrarme en todos?")}`,
  ];
  pasosEl.innerHTML = PASOS.map((p) => `<article class="paso">${p}</article>`).join("");

  // --- Carteles propuestos -----------------------------------------------------------------------
  if (galeria) {
    const vistos = new Set<string>();
    galeria.innerHTML = d.paneles
      .filter((p) => p.cartel && !p.recreacion && !vistos.has(p.cartel) && vistos.add(p.cartel))
      .map((p) => `<button type="button" class="cartel" data-abrir="${p.id}"><img src="${BASE}${p.cartel}" alt="Cartel propuesto: ${p.titulo}" loading="lazy"/><span><i class="pin-ruta" style="--c:${COLOR_RUTA[p.ruta]}">${p.orden}</i>${p.titulo} · ${NOMBRE_RUTA[p.ruta]}</span></button>`)
      .join("");
  }

  // --- Mapa ----------------------------------------------------------------------------------------
  alAcercarse(cont, () => {
    const cajaDeRuta = (id: "costa" | "cornisa"): Caja => cajaDe([...coordenadas(ruta(id).geometry), ...paneles(id).map((p) => p.coordinates)]);
    const todo: Caja = cajaDe([...coordenadas(ruta("costa").geometry), ...coordenadas(ruta("cornisa").geometry), ...d.paneles.map((p) => p.coordinates)]);
    const mapa = new MapaGL({ container: cont, style: estiloOrto(), bounds: todo, fitBoundsOptions: { padding: 40 }, pitch: 35, bearing: -20, attributionControl: false, fadeDuration: 0 });
    mapa.scrollZoom.disable();
    mapa.dragPan.disable();
    mapa.dragRotate.disable();
    mapa.touchZoomRotate.disable();
    mapa.doubleClickZoom.disable();
    mapa.keyboard.disable();

    // Cuánto de cada ruta se ve (0–1) y con qué opacidad; los usos, encendidos o no.
    const avance = { costa: 0, cornisa: 0 }, opacidad = { costa: 1, cornisa: 1 };
    let verUsos = false;
    const transparente = "rgba(0,0,0,0)";
    const pintar = () => {
      if (!mapa.getLayer("ruta-costa")) return;
      for (const id of ["costa", "cornisa"] as const) {
        const t = Math.max(0.0001, Math.min(1, avance[id]));
        mapa.setPaintProperty(`ruta-${id}`, "line-gradient", (t >= 1 ? ["step", ["line-progress"], COLOR_RUTA[id], 2, transparente] : ["step", ["line-progress"], COLOR_RUTA[id], t, transparente]) as ExpressionSpecification);
        mapa.setPaintProperty(`ruta-${id}`, "line-opacity", opacidad[id]);
      }
      mapa.setLayoutProperty("usos", "visibility", verUsos ? "visible" : "none");
      mapa.setLayoutProperty("usos-sombra", "visibility", verUsos ? "visible" : "none");
    };

    mapa.on("load", () => {
      for (const r of d.rutas) {
        mapa.addSource(`ruta-${r.id}`, { type: "geojson", lineMetrics: true, data: { type: "Feature", properties: {}, geometry: r.geometry } as GeoJSONSourceSpecification["data"] });
        mapa.addLayer({ id: `ruta-${r.id}-base`, type: "line", source: `ruta-${r.id}`, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-opacity": 0.45, "line-width": 2, "line-dasharray": [1.5, 1.5] } });
      }
      for (const r of d.rutas)
        mapa.addLayer({ id: `ruta-${r.id}`, type: "line", source: `ruta-${r.id}`, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 5, "line-gradient": ["step", ["line-progress"], COLOR_RUTA[r.id], 0.0001, transparente] as ExpressionSpecification } });
      mapa.addSource("usos", { type: "geojson", data: { type: "FeatureCollection", features: d.usos.map((u) => ({ type: "Feature", properties: { id: u.id }, geometry: u.geometry })) } as GeoJSONSourceSpecification["data"] });
      const colorUso = ["match", ["get", "id"], ...Object.entries(COLOR_USO).flat(), "#fff"] as unknown as ExpressionSpecification;
      mapa.addLayer({ id: "usos-sombra", type: "line", source: "usos", layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#0b1020", "line-opacity": 0.5, "line-width": 9 } });
      mapa.addLayer({ id: "usos", type: "line", source: "usos", layout: { visibility: "none", "line-cap": "round", "line-join": "round" }, paint: { "line-color": colorUso, "line-width": 5.5 } });
      pintar();
    });

    // Paneles: un botón numerado por panel; aparecen con su ruta en los últimos pasos.
    const pins = d.paneles.map((p) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "pin-ruta pin-ruta--mapa";
      el.style.setProperty("--c", COLOR_RUTA[p.ruta]);
      el.textContent = String(p.orden);
      el.dataset.abrir = p.id;
      el.setAttribute("aria-label", `Panel ${p.orden} de la ${NOMBRE_RUTA[p.ruta].toLowerCase()}: ${p.titulo}`);
      const caja = document.createElement("div");
      caja.className = "oculto";
      caja.append(el);
      new Marker({ element: caja }).setLngLat(p.coordinates).addTo(mapa);
      return { p, caja };
    });
    // Confi espera en la entrada del recorrido que toca.
    const imgConfi = document.createElement("div");
    imgConfi.className = "confi-mapa";
    imgConfi.innerHTML = `<img src="${BASE}${confi}" alt="Confi"/>`;
    const marcaConfi = new Marker({ element: imgConfi, anchor: "bottom", offset: [-26, 0] }).setLngLat(paneles("costa")[0].coordinates).addTo(mapa);

    let cancelar = () => {};
    const ir = (i: number) => {
      const metas = [
        { costa: 0, cornisa: 0, oc: 1, ocn: 1, usos: false, pins: [] as string[], caja: todo, confi: "costa" },
        { costa: 1, cornisa: 0, oc: 1, ocn: 1, usos: false, pins: [], caja: cajaDeRuta("costa"), confi: "costa" },
        { costa: 0, cornisa: 0, oc: 1, ocn: 1, usos: true, pins: [], caja: todo, confi: "costa" },
        { costa: 1, cornisa: 1, oc: 0.3, ocn: 1, usos: false, pins: [], caja: cajaDeRuta("cornisa"), confi: "cornisa" },
        { costa: 1, cornisa: 1, oc: 1, ocn: 0.3, usos: false, pins: ["costa"], caja: cajaDeRuta("costa"), confi: "costa" },
        { costa: 1, cornisa: 1, oc: 0.3, ocn: 1, usos: false, pins: ["cornisa"], caja: cajaDeRuta("cornisa"), confi: "cornisa" },
        { costa: 1, cornisa: 1, oc: 1, ocn: 1, usos: false, pins: ["costa", "cornisa"], caja: todo, confi: "costa" },
      ];
      const m = metas[Math.max(0, Math.min(metas.length - 1, i))];
      verUsos = m.usos;
      opacidad.costa = m.oc;
      opacidad.cornisa = m.ocn;
      const desde = { ...avance };
      cancelar();
      cancelar = animar(1800, (k) => {
        avance.costa = desde.costa + (m.costa - desde.costa) * k;
        avance.cornisa = desde.cornisa + (m.cornisa - desde.cornisa) * k;
        pintar();
      });
      pins.forEach(({ p, caja }) => caja.classList.toggle("oculto", !m.pins.includes(p.ruta)));
      const destino = paneles(m.confi as "costa" | "cornisa")[0].coordinates;
      if (marcaConfi.getLngLat().lng !== destino[0]) {
        imgConfi.classList.remove("salta");
        void imgConfi.offsetWidth;
        imgConfi.classList.add("salta");
        marcaConfi.setLngLat(destino);
      }
      mapa.fitBounds(m.caja, { padding: esMovil() ? { top: 30, bottom: 140, left: 20, right: 20 } : 70, pitch: 35, bearing: -20, duration: 1800, maxZoom: 16.4 });
    };
    pasos(pasosEl, ir);
  });
}
