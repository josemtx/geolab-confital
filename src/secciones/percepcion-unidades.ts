// Percepción por unidad ambiental (SATURACION_WEB y COMODIDAD_WEB de Adrián):
// se elige una unidad en el mapa de la zonificación y se ve, para cada día de encuesta y franja
// horaria, cuánta gente había y cuánta sentían; y el 7 de marzo, saturación frente a comodidad.
import { geoArea, geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { cargar } from "../comun";
import type { Respuesta } from "../respuestas";

type Zona = { type: "Feature"; properties: { COD: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } };
const SEMAFORO = ["#15803d", "#84cc16", "#facc15", "#f97316", "#dc2626"];
const SAT = ["Muy bajo", "Bajo", "Adecuado", "Alto", "Muy alto"];
const COM = ["Muy cómodo", "Cómodo", "Adecuado", "Incómodo", "Muy incómodo"];
const UNIDADES = [
  { nombre: "Pasarela de madera", cod: "D" },
  { nombre: "Área de reposo", cod: "C" },
  { nombre: "Pista de tierra", cod: "F" },
  { nombre: "Zona de surf", cod: "A1" },
];
const DIAS = [
  { fecha: "2025-12-30", texto: "Martes 30 de diciembre de 2025", tipo: "Día tranquilo" },
  { fecha: "2026-01-03", texto: "Sábado 3 de enero de 2026", tipo: "Día de mucha gente" },
  { fecha: "2026-03-07", texto: "Sábado 7 de marzo de 2026", tipo: "Día de mucha gente" },
];
const FRANJAS = ["Mañana", "Mediodía", "Tarde"];

// Barra de respuestas de una escala (semáforo), con su recuento.
const barra = (rs: Respuesta[], campo: string, escala: string[]) => {
  const n = rs.length;
  if (!n) return `<div class="escala escala--vacia">Sin respuestas</div>`;
  const tramos = escala
    .map((e, i) => ({ e, i, k: rs.filter((r) => r[campo] === e).length }))
    .filter((t) => t.k)
    .map((t) => `<span style="flex:${t.k};background:${SEMAFORO[t.i]};color:${t.i === 2 ? "#111827" : "#fff"}" title="${t.e}: ${t.k}">${t.k}</span>`)
    .join("");
  return `<div class="escala">${tramos}</div>`;
};

export async function percepcionUnidades(rejilla: Element, rs: Respuesta[]) {
  const zonas = await cargar<{ features: Zona[] }>("geo/zonificacion.json");
  // d3-geo necesita los anillos en sentido horario: si uno «ocupa» más de medio globo, se invierte.
  zonas.features.forEach((f) => {
    if (geoArea(f as unknown as GeoPermissibleObjects) <= 2 * Math.PI) return;
    const polis = (f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]) as number[][][][];
    polis.forEach((poli) => poli.forEach((anillo) => anillo.reverse()));
  });
  const presencial = rs.filter((r) => r.Modalidad === "Presencial");
  // Personas contadas en la playa en cada día y franja (el mediodía del 7 de marzo tiene dos recuentos que se suman).
  const afluencia = (fecha: string, franja: string) =>
    [...new Set(presencial.filter((r) => r.Dia_mes === fecha && r.Franja_horaria === franja).map((r) => Number(r.Usuarios_totales)))].reduce((a, b) => a + b, 0);

  const art = document.createElement("article");
  art.className = "tarjeta tarjeta--ancha percepcion";
  art.innerHTML = `
    <h4>Saturación y comodidad, unidad por unidad</h4>
    <p class="tarjeta__n">Encuestas presenciales en tres días de 2025 y 2026</p>
    <p class="tarjeta__destacado">Elige una unidad en el mapa. Para cada momento verás cuánta gente se contó en el Confital y cómo la percibían quienes estaban en esa unidad.</p>
    <div class="percepcion__cuerpo">
      <div class="percepcion__mapa"><svg viewBox="0 0 400 440" role="img" aria-label="Mapa de las unidades ambientales"></svg>
        <div class="chips" role="group" aria-label="Unidad ambiental">${UNIDADES.map((u, i) => `<button type="button" data-u="${i}" aria-pressed="${i === 0}">${u.nombre}</button>`).join("")}</div>
      </div>
      <div class="percepcion__datos"></div>
    </div>
    <ul class="leyenda leyenda--fija">${SAT.map((s, i) => `<li><span class="muestra" style="--c:${SEMAFORO[i]}"></span>${s} / ${COM[i].toLowerCase()}</li>`).join("")}</ul>`;
  rejilla.prepend(art);
  requestAnimationFrame(() => art.classList.add("visible"));

  const svg = art.querySelector("svg")!;
  // Encuadre sin la pista de tierra (F, 3,6 km hacia el norte): si no, las demás unidades quedan diminutas.
  const sinPista = zonas.features.filter((f) => f.properties.COD !== "F");
  const p = geoMercator().fitExtent([[10, 10], [390, 430]], { type: "FeatureCollection", features: sinPista } as unknown as GeoPermissibleObjects);
  const camino = geoPath(p);
  const datos = art.querySelector(".percepcion__datos")!;

  const pintar = (i: number) => {
    const u = UNIDADES[i];
    svg.innerHTML = zonas.features
      .map((f) => {
        const elegible = UNIDADES.findIndex((x) => x.cod === f.properties.COD);
        const activa = f.properties.COD === u.cod;
        return `<path d="${camino(f as unknown as GeoPermissibleObjects)}" fill="${activa ? "#0038ff" : elegible >= 0 ? "#a5b4fc" : "#d1d5db"}" stroke="#fff" stroke-width="1.5" ${elegible >= 0 ? `data-u="${elegible}" style="cursor:pointer"` : ""}><title>${UNIDADES[elegible]?.nombre ?? ""}</title></path>`;
      })
      .join("");
    art.querySelectorAll<HTMLButtonElement>(".chips button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.u) === i)));
    const deUnidad = presencial.filter((r) => r.Unidad_concreta === u.nombre);
    const tabla = DIAS.map((d) => {
      const celdas = FRANJAS.map((f) => {
        const grupo = deUnidad.filter((r) => r.Dia_mes === d.fecha && r.Franja_horaria === f);
        return `<div class="celda"><p class="celda__franja">${f}</p><p class="celda__gente">${afluencia(d.fecha, f)} personas en el Confital</p>${barra(grupo, "Numero_usuarios_percibido", SAT)}</div>`;
      }).join("");
      return `<div class="dia"><p class="dia__titulo">${d.texto} <span>${d.tipo}</span></p><div class="dia__celdas">${celdas}</div></div>`;
    }).join("");
    const marzo = deUnidad.filter((r) => r.Dia_mes === "2026-03-07");
    const comparar = FRANJAS.map((f) => {
      const g = marzo.filter((r) => r.Franja_horaria === f);
      return `<div class="celda"><p class="celda__franja">${f} · ${afluencia("2026-03-07", f)} personas</p><p class="celda__etq">Cuánta gente sentían</p>${barra(g, "Numero_usuarios_percibido", SAT)}<p class="celda__etq">Cómo de cómodos estaban</p>${barra(g.filter((r) => r.Grado_comodidad), "Grado_comodidad", COM)}</div>`;
    }).join("");
    datos.innerHTML = `<h5>Cuánta gente sentían a su alrededor · ${u.nombre}</h5>${tabla}
      <h5>7 de marzo: ¿más gente, menos comodidad?</h5><p class="nota">El mismo día, quienes estaban en la ${u.nombre.toLowerCase()} respondieron a las dos preguntas. Así se ve si la comodidad cambia con la saturación.</p><div class="dia__celdas">${comparar}</div>`;
  };
  art.addEventListener("click", (e) => {
    const t = (e.target as Element).closest("[data-u]");
    if (t) pintar(Number(t.getAttribute("data-u")));
  });
  pintar(0);
}
