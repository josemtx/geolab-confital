// Panel de resultados de la segunda investigación (TFM), siguiendo el documento de Adrián:
// variables, orden de las respuestas y simbología de color de cada gráfico.
// Todo se calcula a partir de las respuestas, así que se actualiza solo cuando entren nuevas.
import { BASE } from "../comun";
import { anillo, apiladas, barras, degradado, fmtPct, mosaico, type Cat, type Grupo } from "../graficos";
import { cargarDatos, CSV_EN_VIVO, type Datos, type Respuesta } from "../respuestas";
import { percepcionUnidades } from "./percepcion-unidades";

// --- Paletas con significado (documento de Adrián) ------------------------------------------
export const SEMAFORO = ["#15803d", "#84cc16", "#facc15", "#f97316", "#dc2626"]; // de lo mejor a lo peor
// Sí/No: el verde siempre para la respuesta buena. En «¿dejaría de venir?» o «¿le condiciona…?», lo bueno es «No».
const SI_NO = { Sí: "#16a34a", No: "#dc2626", Depende: "#9ca3af" } as Record<string, string>;
const NO_ES_BUENO = { No: "#16a34a", Sí: "#dc2626", Depende: "#9ca3af" } as Record<string, string>;
const AZUL = "#0038ff";

const ORDEN: Record<string, string[]> = {
  Franja_edad: ["Entre 18 y 30", "Entre 31 y 45", "Entre 46 y 65", "Mayores de 65"],
  Procedencia: ["Mismo municipio", "Otro municipio de Gran Canaria", "Otra isla canaria", "Turismo nacional", "Turismo internacional"],
  Estudios: ["Primarios", "Secundarios", "Universitarios"],
  Medio_llegada: ["Caminando", "Bicicleta", "Transporte público", "Motocicleta", "Coche"],
  Frecuencia_visita: ["Diaria", "Semanal", "Mensual", "Ocasional", "Varias veces al año", "Una vez al año o menos", "Anual", "Primera vez"],
  Tipo_compania: ["Solo", "2 personas", "3 personas", "4 o más personas"],
  Tiempo_estancia: ["Menos de 1 hora", "Entre 1 y 2 horas", "Entre 2 y 4 horas", "Más de 4 horas"],
  Que_harias_mas_usuarios: ["Quedarme igualmente", "Ir a otra zona del Confital", "Ir a una playa cercana", "Volver otro día", "No volver más"],
  Superficie_disponible: ["Muy amplio", "Amplio", "Adecuado", "Insuficiente", "Muy insuficiente"],
  Numero_usuarios_percibido: ["Muy bajo", "Bajo", "Adecuado", "Alto", "Muy alto"],
  Grado_comodidad: ["Muy cómodo", "Cómodo", "Adecuado", "Incómodo", "Muy incómodo"],
  Servicio: ["Muy bueno", "Bueno", "Adecuado", "Mejorable", "Muy mejorable"],
};
const NOMBRE: Record<string, string> = { "Otro municipio de Gran Canaria": "Otro municipio de G. C.", "Otra isla canaria": "Otra isla" };
const ICONOS: Record<string, string> = {
  "Proximidad a lugar de residencia": "🏠", "Recomendación de amigos o familia": "👥", "Internet o redes sociales": "📱",
  "Actividades laborales, deportivas o académicas": "🎓", "Turismo o actividad guiada": "🧭", "Señalización o visita casual": "🪧",
  "Conocimiento generalizado": "🌍", Socialización: "🤝", Tranquilidad: "🧘", Naturalidad: "🌿", "Espacio personal": "🧍",
  Paisaje: "🏞️", Valores: "⭐", Entorno: "🌄", "Cercanía y accesibilidad": "📍", "Espacio virgen": "🏝️", "Actividades deportivas": "🏄",
  "Aire limpio": "🌬️", "Ambiente animado": "🎉", "Calidad del espacio": "✨", "Recuerdos de la infancia": "🧸", "Contacto social": "💬",
  Solo: "🧍", "2 personas": "👫", "3 personas": "👨‍👩‍👦", "4 o más personas": "👨‍👩‍👧‍👦",
};

// --- Recuentos ---------------------------------------------------------------------------------
const recuento = (rs: Respuesta[], campo: string) => {
  const m = new Map<string, number>();
  rs.forEach((r) => {
    const v = r[campo];
    if (v !== null && v !== undefined && v !== "") m.set(String(v), (m.get(String(v)) ?? 0) + 1);
  });
  return m;
};
const enOrden = (m: Map<string, number>, orden?: string[]) =>
  orden ? [...orden.filter((k) => m.has(k)), ...[...m.keys()].filter((k) => !orden.includes(k))] : [...m.keys()].sort((a, b) => m.get(b)! - m.get(a)!);
const cats = (rs: Respuesta[], campo: string, color: (k: string, i: number, n: number, rango: number) => string, orden = ORDEN[campo]) => {
  const m = recuento(rs, campo);
  const claves = enOrden(m, orden);
  const rango = [...claves].sort((a, b) => m.get(b)! - m.get(a)!);
  return claves.map((k, i) => ({ etiqueta: NOMBRE[k] ?? k, n: m.get(k)!, color: color(k, i, claves.length, rango.indexOf(k)), icono: ICONOS[k] }));
};
const porRango = (_k: string, _i: number, n: number, rango: number) => degradado(rango, n);
// Semáforo fijo por respuesta, según su lugar en la escala completa (no en el grupo, que puede no tenerlas todas).
const semaforoDe = (campo: string) => (k: string) => {
  const o = ORDEN[campo];
  return SEMAFORO[Math.round((Math.max(0, o.indexOf(k)) * 4) / Math.max(1, o.length - 1))];
};
const total = (cs: Cat[]) => cs.reduce((a, c) => a + c.n, 0);
const mayor = (cs: Cat[]) => cs.reduce((a, c) => (c.n > a.n ? c : a), cs[0]);
const suma = (cs: Cat[], etiquetas: string[]) => cs.filter((c) => etiquetas.includes(c.etiqueta)).reduce((a, c) => a + c.n, 0);
const cruce = (rs: Respuesta[], campoGrupo: string, campo: string, color: (k: string) => string): Grupo[] =>
  enOrden(recuento(rs, campoGrupo), ORDEN[campoGrupo]).map((g) => ({ grupo: NOMBRE[g] ?? g, cats: cats(rs.filter((r) => r[campoGrupo] === g), campo, color) }));

// --- Tarjetas y bloques ------------------------------------------------------------------------
// Se calculan una vez (definir) y cada página dibuja los que necesita: la portada, unos pocos
// destacados; el panel de datos, un bloque por pestaña; el informe, los que elija quien lo pida.
export type Tarjeta = {
  id: string;
  titulo: string;
  n: number;
  destacado: string;
  ancha?: boolean;
  dibujar: (el: HTMLElement) => void;
  extra?: string;
  // Tarjetas con su propia estructura (percepción por unidades)
  especial?: (rejilla: Element, opciones: { informe?: boolean }) => Promise<void>;
};
export type Bloque = { id: string; sobretitulo: string; titulo: string; intro: string; tarjetas: Tarjeta[] };
export type Panel = { kpis: [string, string][]; bloques: Bloque[] };

const slug = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const bloque = (id: string, sobretitulo: string, titulo: string, intro: string, tarjetas: Omit<Tarjeta, "id">[]): Bloque => ({
  id,
  sobretitulo,
  titulo,
  intro,
  tarjetas: tarjetas.map((t) => ({ ...t, id: (t as Tarjeta).id ?? slug(t.titulo) })),
});

const articulo = (t: Tarjeta) => {
  const art = document.createElement("article");
  art.className = `tarjeta${t.ancha ? " tarjeta--ancha" : ""}`;
  art.dataset.tarjeta = t.id;
  art.innerHTML = `<h4>${t.titulo}</h4><p class="tarjeta__n">${t.n} respuestas</p><p class="tarjeta__destacado">${t.destacado}</p><div class="grafico__lienzo"></div>${t.extra ?? ""}`;
  return art;
};

// Dibuja tarjetas en una rejilla. En pantalla, cada gráfico se dibuja al acercarse (y se anima);
// en el informe, todos de golpe (y la promesa se resuelve cuando están listos).
export async function dibujarTarjetas(rejilla: Element, tarjetas: Tarjeta[], o: { informe?: boolean } = {}) {
  const pendientes: Promise<void>[] = [];
  for (const t of tarjetas) {
    if (t.especial) {
      // Hueco transparente para la rejilla: así la tarjeta (que se monta tarde) conserva su orden.
      const hueco = document.createElement("div");
      hueco.style.display = "contents";
      rejilla.append(hueco);
      pendientes.push(t.especial(hueco, o));
      continue;
    }
    const art = articulo(t);
    rejilla.append(art);
    const pintar = () => {
      t.dibujar(art.querySelector(".grafico__lienzo")!);
      art.classList.add("visible");
    };
    if (o.informe) pintar();
    else {
      const io = new IntersectionObserver((e) => {
        if (!e[0].isIntersecting) return;
        io.disconnect();
        pintar();
      }, { rootMargin: "200px 0px" });
      io.observe(art);
    }
  }
  await Promise.all(pendientes);
}

export function dibujarBloque(cont: Element, b: Bloque, o: { informe?: boolean; tarjetas?: Tarjeta[] } = {}) {
  const sec = document.createElement("div");
  sec.className = "panel-bloque";
  sec.id = b.id;
  sec.innerHTML = `<div class="contenedor"><p class="sobretitulo">${b.sobretitulo}</p><h3 class="titular titular--bloque">${b.titulo}</h3><p class="entradilla">${b.intro}</p><div class="tarjetas"></div></div>`;
  cont.append(sec);
  return dibujarTarjetas(sec.querySelector(".tarjetas")!, o.tarjetas ?? b.tarjetas, o);
}

export const dibujarKpis = (el: Element | null, kpis: [string, string][]) => {
  if (el) el.innerHTML = kpis.map(([v, t]) => `<div class="kpi visible"><b>${v}</b><span>${t}</span></div>`).join("");
};

// --- Datos en vivo: carga, selector «Todas / Solo el estudio» y lectura cada minuto -----------
export type Modo = "todas" | "estudio";
export async function conDatos(alCambiar: (rs: Respuesta[], datos: Datos, modo: Modo) => void, refrescoMs = 60_000) {
  const fuente = document.querySelector<HTMLElement>("[data-fuente]");
  let datos: Datos = await cargarDatos();
  let modo: Modo = "todas";
  const respuestasDe = () => (modo === "todas" ? [...datos.estudio, ...datos.nuevas] : datos.estudio);
  const cabecera = () => {
    if (!fuente) return;
    const vivo = CSV_EN_VIVO && !datos.error;
    const total = datos.estudio.length + datos.nuevas.length;
    fuente.innerHTML = `
      <div class="selector selector--oscuro" role="group" aria-label="Qué respuestas mostrar">
        <button type="button" data-modo="todas" aria-pressed="${modo === "todas"}">Todas · ${total}</button>
        <button type="button" data-modo="estudio" aria-pressed="${modo === "estudio"}">Solo el estudio · ${datos.estudio.length}</button>
      </div>
      <p class="fuente-vivo">${vivo ? `<span class="punto-vivo"></span>En directo: ${datos.nuevas.length} ${datos.nuevas.length === 1 ? "respuesta nueva" : "respuestas nuevas"} desde el estudio · comprobado a las ${datos.actualizado!.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "Datos del estudio (diciembre 2025 – abril 2026)"}</p>`;
    fuente.querySelectorAll<HTMLButtonElement>("[data-modo]").forEach((b) =>
      b.addEventListener("click", () => {
        modo = b.dataset.modo as Modo;
        cabecera();
        alCambiar(respuestasDe(), datos, modo);
      }),
    );
  };
  cabecera();
  alCambiar(respuestasDe(), datos, modo);
  // La hoja de Google se vuelve a leer cada minuto; si hay respuestas nuevas, todo se recalcula.
  if (CSV_EN_VIVO)
    setInterval(async () => {
      const antes = datos.nuevas.length;
      datos = await cargarDatos();
      cabecera();
      if (datos.nuevas.length !== antes && modo === "todas") alCambiar(respuestasDe(), datos, modo);
    }, refrescoMs);
}

export function definir(rs: Respuesta[]): Panel {
  const bloques: Bloque[] = [];
  const n = (campo: string) => rs.filter((r) => r[campo] !== null && r[campo] !== undefined && r[campo] !== "").length;

  // Cifras clave
  const proc = cats(rs, "Procedencia", porRango), medio = cats(rs, "Medio_llegada", semaforoDe("Medio_llegada")), sup = cats(rs, "Superficie_disponible", semaforoDe("Superficie_disponible")), serv = cats(rs, "Servicios_suficientes", (k) => SI_NO[k]);
  const kpis: [string, string][] = [
      [String(rs.length), "voces escuchadas"],
      [fmtPct(proc[0].n, total(proc)), "vive en Las Palmas de Gran Canaria"],
      [fmtPct(suma(medio, ["Caminando"]), total(medio)), "llega caminando"],
      [fmtPct(suma(sup, ["Muy amplio", "Amplio"]), total(sup)), "siente que hay espacio de sobra"],
      [fmtPct(suma(serv, ["No"]), total(serv)), "pide más y mejores servicios"],
    ];

  // 1 · Quién viene
  const sexo = cats(rs, "Sexo", (k) => ({ Hombre: "#2563eb", Mujer: "#ec4899" })[k] ?? "#9ca3af", ["Hombre", "Mujer", "Otro"]);
  const edad = cats(rs, "Franja_edad", porRango), est = cats(rs, "Estudios", porRango);
  const mismo = rs.filter((r) => r.Procedencia === "Mismo municipio"), otros = rs.filter((r) => r.Procedencia === "Otro municipio de Gran Canaria");
  const barrios = cats(mismo, "Lugar_concreto", () => AZUL, undefined), munis = cats(otros, "Lugar_concreto", () => AZUL, undefined);
  bloques.push(bloque("quien", "Perfil de quien visita", "¿Quién viene al Confital?", "Sobre todo gente de la ciudad, que viene a menudo y a pie.", [
    { titulo: "Sexo", n: n("Sexo"), destacado: `Responden algo más hombres (${fmtPct(sexo[0].n, total(sexo))}) que mujeres (${fmtPct(sexo[1]?.n ?? 0, total(sexo))}).`, dibujar: (el) => anillo(el, sexo, { titulo: "Sexo", centro: mayor(sexo) }) },
    { titulo: "Edad", n: n("Franja_edad"), destacado: `El grupo más numeroso tiene ${mayor(edad).etiqueta.toLowerCase().replace("entre", "entre")} años (${fmtPct(mayor(edad).n, total(edad))}).`, dibujar: (el) => barras(el, edad, { titulo: "Edad" }) },
    { titulo: "De dónde vienen", n: n("Procedencia"), destacado: `${fmtPct(proc[0].n, total(proc))} vive en el propio municipio de Las Palmas de Gran Canaria.`, dibujar: (el) => barras(el, proc, { titulo: "Procedencia" }) },
    { titulo: "Nivel de estudios", n: n("Estudios"), destacado: `${fmtPct(mayor(est).n, total(est))} tiene estudios ${mayor(est).etiqueta.toLowerCase()}.`, dibujar: (el) => barras(el, est, { titulo: "Estudios" }) },
    {
      titulo: "Barrios de Las Palmas de Gran Canaria", n: mismo.length, ancha: true,
      destacado: `${barrios[0].etiqueta} es, con diferencia, el barrio que más visitantes aporta (${barrios[0].n} personas). Los barrios de la Ciudad Baja concentran la mayoría, quizá por su mejor conexión en transporte público.`,
      dibujar: (el) => barras(el, barrios, { titulo: "Barrios", vertical: true, sinPct: true }),
      extra: `<p class="descarga-mapa"><a class="boton-descarga" href="${BASE}descargas/procedencia_escala_municipal.jpg" download>↓ Descargar el mapa de procedencia por barrios</a></p>`,
    },
    {
      titulo: "Otros municipios de Gran Canaria", n: otros.length,
      destacado: `${munis[0].etiqueta}, ${munis[1].etiqueta} y ${munis[2].etiqueta} son los municipios que más visitantes aportan.`,
      dibujar: (el) => barras(el, munis, { titulo: "Municipios", sinPct: true }),
      extra: `<p class="descarga-mapa"><a class="boton-descarga" href="${BASE}descargas/procedencia_escala_insular.jpg" download>↓ Descargar el mapa de procedencia por municipios</a></p>`,
    },
    {
      titulo: "Y más allá de Gran Canaria", n: rs.length - mismo.length - otros.length,
      destacado: `${fmtPct(rs.length - mismo.length - otros.length, rs.length)} viene de fuera de Gran Canaria: de otras islas, del resto de España o de otros países. Estos son sus mapas de procedencia.`,
      dibujar: () => {},
      extra: `<div class="mapas-descarga">${[["autonomica", "Canarias"], ["nacional", "España"], ["europea", "Europa"], ["mundial", "América"]]
        .map(([f, t]) => `<a href="${BASE}descargas/procedencia_escala_${f}.jpg" download><img src="${BASE}descargas/mini/${f}.webp" alt="Mapa de procedencia: ${t}" loading="lazy" width="640" height="452"/><span>↓ ${t}</span></a>`)
        .join("")}</div>`,
    },
  ]));

  // 2 · Por qué viene
  const conoc = cats(rs, "Conocimiento_existencia", porRango), valora = cats(rs, "Valoras_visita", porRango);
  bloques.push(bloque("motivos", "Motivación de la visita", "¿Por qué viene la gente?", "Lo conocen porque viven cerca o se lo recomendaron, y lo que más valoran es la tranquilidad.", [
    { titulo: "Cómo conocieron el Confital", n: n("Conocimiento_existencia"), ancha: true, destacado: `«${mayor(conoc).etiqueta}» es la respuesta más común (${fmtPct(mayor(conoc).n, total(conoc))}).`, dibujar: (el) => mosaico(el, conoc, { titulo: "Cómo conocieron el Confital" }) },
    { titulo: "Qué es lo que más valoran", n: n("Valoras_visita"), ancha: true, destacado: `La ${mayor(valora).etiqueta.toLowerCase()} lo es todo: ${fmtPct(mayor(valora).n, total(valora))} la elige como lo más valioso.`, dibujar: (el) => mosaico(el, valora, { titulo: "Qué valoran" }) },
  ]));

  // 3 · Cómo usa el espacio
  const frec = cats(rs, "Frecuencia_visita", () => AZUL), act = cats(rs, "Actividad_desarrollar", () => AZUL), comp = cats(rs, "Tipo_compania", porRango);
  const estancia = ["#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"];
  bloques.push(bloque("habitos", "Hábitos de uso", "¿Cómo usan el Confital?", "Llegan caminando, solos o en pareja, y sobre todo a pasear.", [
    { titulo: "Cómo llegan", n: n("Medio_llegada"), destacado: `${fmtPct(suma(medio, ["Caminando"]), total(medio))} llega caminando. Los colores van del medio más sostenible (verde) al que más contamina (rojo).`, dibujar: (el) => barras(el, medio, { titulo: "Medio de llegada" }) },
    { titulo: "Con qué frecuencia vienen", n: n("Frecuencia_visita"), destacado: `${fmtPct(suma(frec, ["Diaria", "Semanal"]), total(frec))} viene cada día o cada semana.`, dibujar: (el) => barras(el, frec, { titulo: "Frecuencia" }) },
    { titulo: "Cómo llegan, según de dónde vienen", n: n("Medio_llegada"), ancha: true, destacado: "Quien vive cerca llega a pie; quien viene de otros municipios, en coche.", dibujar: (el) => apiladas(el, cruce(rs, "Procedencia", "Medio_llegada", semaforoDe("Medio_llegada")), { titulo: "Procedencia y medio de llegada", leyenda: medio }) },
    { titulo: "Qué hacen en el Confital", n: n("Actividad_desarrollar"), destacado: `${fmtPct(act[0].n, total(act))} viene, sobre todo, a ${act[0].etiqueta.toLowerCase()}.`, dibujar: (el) => barras(el, act, { titulo: "Actividad principal", vertical: true }) },
    { titulo: "Con quién vienen", n: n("Tipo_compania"), destacado: `${fmtPct(suma(comp, ["Solo", "2 personas"]), total(comp))} viene solo o en pareja.`, dibujar: (el) => barras(el, comp, { titulo: "Compañía" }) },
    {
      titulo: "Cuánto tiempo se quedan, según lo que hacen", n: n("Tiempo_estancia"), ancha: true, destacado: "Quien pasea suele quedarse entre 1 y 2 horas; quien va a tomar el sol, en la mayoría de los casos más de 2.",
      dibujar: (el) => apiladas(el, cruce(rs, "Actividad_desarrollar", "Tiempo_estancia", (k) => estancia[ORDEN.Tiempo_estancia.indexOf(k)]), { titulo: "Actividad y tiempo de estancia", leyenda: ORDEN.Tiempo_estancia.map((e, i) => ({ etiqueta: e, n: 0, color: estancia[i] })) }),
    },
  ]));

  // 4 · Cómo se siente
  const sat = cats(rs, "Numero_usuarios_percibido", semaforoDe("Numero_usuarios_percibido")), com = cats(rs, "Grado_comodidad", semaforoDe("Grado_comodidad"));
  const aband = cats(rs, "Condicionante_mayor_afluencia", (k) => NO_ES_BUENO[k], ["Sí", "No", "Depende"]), haria = cats(rs, "Que_harias_mas_usuarios", semaforoDe("Que_harias_mas_usuarios"));
  bloques.push(bloque("sensacion", "Percepción", "¿Cómo se siente la gente?", "Aunque a veces se supera la capacidad, la mayoría siente que hay espacio de sobra y está cómoda.", [
    { titulo: "Espacio disponible", n: n("Superficie_disponible"), destacado: `${fmtPct(suma(sup, ["Muy amplio", "Amplio"]), total(sup))} siente que el espacio es amplio o muy amplio.`, dibujar: (el) => barras(el, sup, { titulo: "Espacio disponible" }) },
    { titulo: "Cuánta gente sentían a su alrededor", n: n("Numero_usuarios_percibido"), destacado: `Solo ${fmtPct(suma(sat, ["Alto", "Muy alto"]), total(sat))} percibía mucha o demasiada gente.`, dibujar: (el) => barras(el, sat, { titulo: "Saturación percibida" }) },
    { titulo: "Cómo de cómodos estaban", n: n("Grado_comodidad"), destacado: `${fmtPct(suma(com, ["Muy cómodo", "Cómodo"]), total(com))} estaba cómodo o muy cómodo.`, dibujar: (el) => barras(el, com, { titulo: "Comodidad" }) },
    { titulo: "¿Dejaría de venir si hubiera más gente?", n: n("Condicionante_mayor_afluencia"), destacado: `${fmtPct(suma(aband, ["No"]), total(aband))} seguiría viniendo aunque aumentara la afluencia.`, dibujar: (el) => anillo(el, aband, { titulo: "Abandonaría si hubiera más gente", centro: aband.find((c) => c.etiqueta === "No") ?? aband[0], centroTexto: "no dejaría de venir" }) },
    { titulo: "Qué haría si hubiera más gente", n: n("Que_harias_mas_usuarios"), destacado: `${fmtPct(haria[0].n, total(haria))} se quedaría igualmente; solo ${fmtPct(suma(haria, ["No volver más"]), total(haria))} no volvería.`, dibujar: (el) => barras(el, haria, { titulo: "Qué haría" }) },
    { titulo: "Qué haría, según de dónde viene", n: n("Que_harias_mas_usuarios"), ancha: true, destacado: "Quien vive en la ciudad es quien más tiende a quedarse igualmente; quien viene de otros municipios de la isla, bastante menos.", dibujar: (el) => apiladas(el, cruce(rs.filter((r) => r.Que_harias_mas_usuarios), "Procedencia", "Que_harias_mas_usuarios", semaforoDe("Que_harias_mas_usuarios")), { titulo: "Procedencia y decisión", leyenda: haria }) },
  ]));
  // La percepción por unidades abre el bloque de «Cómo se siente».
  bloques[bloques.length - 1].tarjetas.unshift({
    id: "percepcion-unidades",
    titulo: "Saturación y comodidad, unidad por unidad",
    n: rs.filter((r) => r.Modalidad === "Presencial").length,
    destacado: "Cuánta gente había, cuánta sentían y cómo de cómodos estaban, en cada unidad ambiental.",
    ancha: true,
    dibujar: () => {},
    especial: (rejilla, o) => percepcionUnidades(rejilla, rs, o),
  });

  // 5 · Qué hay que mejorar
  const bano = cats(rs, "Cierre_bano", (k) => NO_ES_BUENO[k], ["Sí", "No"]), coche = cats(rs, "Cierre_coches", (k) => NO_ES_BUENO[k], ["Sí", "No"]);
  const servicios = ["Socorrismo", "Seguridad", "Senalizacion", "Accesibilidad", "Limpieza", "Iluminacion"];
  const nombreServ: Record<string, string> = { Senalizacion: "Señalización", Iluminacion: "Iluminación" };
  const valoracion = servicios
    .map((sv) => ({ grupo: nombreServ[sv] ?? sv, cats: cats(rs, sv, semaforoDe("Servicio"), ORDEN.Servicio).map((c) => ({ ...c, color: SEMAFORO[ORDEN.Servicio.indexOf(c.etiqueta)] })) }))
    .sort((a, b) => suma(b.cats, ["Mejorable", "Muy mejorable"]) / total(b.cats) - suma(a.cats, ["Mejorable", "Muy mejorable"]) / total(a.cats));
  bloques.push(bloque("gestion", "Gestión del espacio", "¿Qué habría que mejorar?", "Los servicios son la gran asignatura pendiente, sobre todo el socorrismo y los aseos.", [
    { titulo: "¿Son suficientes los servicios?", n: n("Servicios_suficientes"), destacado: `${fmtPct(suma(serv, ["No"]), total(serv))} cree que no son suficientes.`, dibujar: (el) => anillo(el, serv, { titulo: "Servicios suficientes", centro: serv.find((c) => c.etiqueta === "No") ?? serv[0], centroTexto: "no son suficientes" }) },
    { titulo: "Cómo valoran cada servicio", n: n("Socorrismo"), destacado: `El socorrismo es el peor valorado: ${fmtPct(suma(valoracion[0].cats, ["Mejorable", "Muy mejorable"]), total(valoracion[0].cats))} lo considera mejorable o muy mejorable.`, dibujar: (el) => apiladas(el, valoracion, { titulo: "Valoración de los servicios", horizontal: true, leyenda: ORDEN.Servicio.map((e, i) => ({ etiqueta: e, n: 0, color: SEMAFORO[i] })) }) },
    { titulo: "¿Son suficientes, según de dónde vienen?", n: n("Servicios_suficientes"), ancha: true, destacado: "Quienes viven en Las Palmas de Gran Canaria son quienes más echan en falta servicios; los turistas, mucho menos.", dibujar: (el) => apiladas(el, cruce(rs.filter((r) => r.Servicios_suficientes), "Procedencia", "Servicios_suficientes", (k) => SI_NO[k]), { titulo: "Procedencia y servicios", leyenda: serv }) },
    { titulo: "¿Le condiciona que no se recomiende el baño?", n: n("Cierre_bano"), destacado: `A ${fmtPct(suma(bano, ["No"]), total(bano))} no le condiciona: desde 2017 el baño no se recomienda y desde 2021 hay bandera roja permanente.`, dibujar: (el) => anillo(el, bano, { titulo: "Cierre al baño", centro: bano.find((c) => c.etiqueta === "No") ?? bano[0], centroTexto: "no le condiciona" }) },
    { titulo: "¿Le condiciona el cierre al tráfico?", n: n("Cierre_coches"), destacado: `A ${fmtPct(suma(coche, ["No"]), total(coche))} no le condiciona que no se pueda entrar en coche.`, dibujar: (el) => anillo(el, coche, { titulo: "Cierre al tráfico", centro: coche.find((c) => c.etiqueta === "No") ?? coche[0], centroTexto: "no le condiciona" }) },
    { titulo: "El cierre al baño, según la frecuencia de visita", n: n("Cierre_bano"), ancha: true, destacado: "A quien viene a diario no le condiciona; a quien viene solo unas pocas veces al año, bastante más.", dibujar: (el) => apiladas(el, cruce(rs, "Frecuencia_visita", "Cierre_bano", (k) => NO_ES_BUENO[k]), { titulo: "Frecuencia y cierre al baño", leyenda: bano }) },
  ]));
  return { kpis, bloques };
}
