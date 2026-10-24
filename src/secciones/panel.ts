// Panel de resultados de la segunda investigación (TFM), siguiendo el documento de Adrián:
// variables, orden de las respuestas y simbología de color de cada gráfico.
// Todo se calcula a partir de las respuestas, así que se actualiza solo cuando entren nuevas.
import { BASE } from "../comun";
import { anillo, apiladas, barras, degradado, fmtPct, leyendaDe, mosaico, pct, type Cat, type Grupo } from "../graficos";
import { cargarDatos, CSV_EN_VIVO, type Datos, type Respuesta } from "../respuestas";
import { percepcionUnidades } from "./percepcion-unidades";

// --- Paletas con significado (documento de Adrián) ------------------------------------------
export const SEMAFORO = ["#15803d", "#84cc16", "#facc15", "#f97316", "#dc2626"]; // de lo mejor a lo peor
// Sí/No: el verde siempre para la respuesta buena. En «¿dejaría de venir?» o «¿le condiciona…?», lo bueno es «No».
const SI_NO = { Sí: "#16a34a", No: "#dc2626", Depende: "#9ca3af" } as Record<string, string>;
const NO_ES_BUENO = { No: "#16a34a", Sí: "#dc2626", Depende: "#9ca3af" } as Record<string, string>;
const AZUL = "#0038ff";
const SITUACION = ["#3b82f6", "#93c5fd", "#16a34a", "#f97316", "#dc2626"];
const CAPACIDAD = ["#15803d", "#84cc16", "#f97316", "#dc2626"];
const TIPO_DIA: Record<string, string> = { Pico: "#ef4444", Valle: "#38bdf8" };

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
  Tipo_dia: ["Pico", "Valle"],
  Franja_horaria: ["Mañana", "Mediodía", "Tarde"],
  Situacion_playa: ["Mucho menos concurrido de lo que desearía", "Algo menos concurrido de lo que desearía", "En un nivel ideal", "Algo más concurrida de lo que desearía", "Mucho más concurrida de lo que desearía"],
  Capacidad_acoger_mas_gente: ["Sí, muchas más", "Sí, algunas más", "No, está en su límite", "No, ya está saturada"],
};
const NOMBRE: Record<string, string> = {
  "Otro municipio de Gran Canaria": "Otro municipio de G. C.", "Otra isla canaria": "Otra isla",
  Pico: "Día de alta afluencia", Valle: "Día de baja afluencia",
  "Mucho menos concurrido de lo que desearía": "Mucha menos gente", "Algo menos concurrido de lo que desearía": "Algo menos gente",
  "En un nivel ideal": "Nivel ideal", "Algo más concurrida de lo que desearía": "Algo más gente", "Mucho más concurrida de lo que desearía": "Mucha más gente",
};
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

// Porcentaje de unas respuestas dentro de un grupo de un cruce (para los textos de los cruces).
const enGrupo = (gs: Grupo[], grupo: string, etiquetas: string[]) => {
  const g = gs.find((x) => x.grupo === grupo);
  return g ? fmtPct(suma(g.cats, etiquetas), total(g.cats)) : "–";
};
// El grupo donde más pesan unas respuestas (con un mínimo de respuestas para no fiarse de 2 o 3).
const dondeMas = (gs: Grupo[], etiquetas: string[], minimo = 10) =>
  gs.filter((g) => total(g.cats) >= minimo).reduce((a, g) => (pct(suma(g.cats, etiquetas), total(g.cats)) > pct(suma(a.cats, etiquetas), total(a.cats)) ? g : a));
// «Área de reposo» → «el área de reposo» (para los textos).
const ARTICULO: Record<string, string> = { "Área de reposo": "el", "Talud coluvial": "el", "Depósitos sedimentarios costeros": "los" };
const conArticulo = (u: string) => `${ARTICULO[u] ?? "la"} ${u.charAt(0).toLowerCase()}${u.slice(1)}`;
const conMinimo = (gs: Grupo[], minimo = 5) => gs.filter((g) => total(g.cats) >= minimo);

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
  // Dibujo alternativo para el informe en PDF (donde no sirven las descargas ni los botones)
  informe?: (el: HTMLElement) => void;
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

const articulo = (t: Tarjeta, informe = false) => {
  const art = document.createElement("article");
  art.className = `tarjeta${t.ancha ? " tarjeta--ancha" : ""}`;
  art.dataset.tarjeta = t.id;
  art.innerHTML = `<h4>${t.titulo}</h4><p class="tarjeta__n">${t.n} respuestas</p><p class="tarjeta__destacado">${t.destacado}</p><div class="grafico__lienzo"></div>${informe ? "" : (t.extra ?? "")}`;
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
    const art = articulo(t, o.informe);
    rejilla.append(art);
    const pintar = () => {
      (o.informe && t.informe ? t.informe : t.dibujar)(art.querySelector(".grafico__lienzo")!);
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
      informe: (el) => {
        const colorProc = new Map(proc.map((c) => [c.etiqueta, c.color]));
        const fuera = ["Otra isla canaria", "Turismo nacional", "Turismo internacional"];
        const lugares = fuera.flatMap((pr) => cats(rs.filter((r) => r.Procedencia === pr), "Lugar_concreto", () => colorProc.get(NOMBRE[pr] ?? pr) ?? AZUL, undefined));
        const orden = lugares.sort((a, b) => b.n - a.n), resto = orden.slice(12);
        const visibles = resto.length ? [...orden.slice(0, 12), { etiqueta: `Otros ${resto.length} lugares`, n: resto.reduce((x, c) => x + c.n, 0), color: "#9ca3af" }] : orden;
        barras(el, visibles, { titulo: "Lugares de procedencia fuera de Gran Canaria", sinPct: true });
        leyendaDe(el, proc.filter((c) => fuera.map((f) => NOMBRE[f] ?? f).includes(c.etiqueta)));
      },
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
  const dia = cats(rs, "Tipo_dia", (k) => TIPO_DIA[k]), franja = cats(rs, "Franja_horaria", () => AZUL), zonas = cats(rs, "Unidad_concreta", () => AZUL, undefined);
  const tiempo = cats(rs, "Tiempo_estancia", (k) => estancia[ORDEN.Tiempo_estancia.indexOf(k)]);
  bloques.push(bloque("habitos", "Hábitos de uso", "¿Cómo usan el Confital?", "Llegan caminando, solos o en pareja, y sobre todo a pasear.", [
    { titulo: "Cómo llegan", n: n("Medio_llegada"), destacado: `${fmtPct(suma(medio, ["Caminando"]), total(medio))} llega caminando. Los colores van del medio más sostenible (verde) al que más contamina (rojo).`, dibujar: (el) => barras(el, medio, { titulo: "Medio de llegada" }) },
    { titulo: "Con qué frecuencia vienen", n: n("Frecuencia_visita"), destacado: `${fmtPct(suma(frec, ["Diaria", "Semanal"]), total(frec))} viene cada día o cada semana.`, dibujar: (el) => barras(el, frec, { titulo: "Frecuencia" }) },
    { titulo: "Cómo llegan, según de dónde vienen", n: n("Medio_llegada"), ancha: true, destacado: "Quien vive cerca llega a pie; quien viene de otros municipios, en coche.", dibujar: (el) => apiladas(el, cruce(rs, "Procedencia", "Medio_llegada", semaforoDe("Medio_llegada")), { titulo: "Procedencia y medio de llegada", leyenda: medio }) },
    { titulo: "Qué hacen en el Confital", n: n("Actividad_desarrollar"), destacado: `${fmtPct(act[0].n, total(act))} viene, sobre todo, a ${act[0].etiqueta.toLowerCase()}.`, dibujar: (el) => barras(el, act, { titulo: "Actividad principal", vertical: true }) },
    { titulo: "Con quién vienen", n: n("Tipo_compania"), destacado: `${fmtPct(suma(comp, ["Solo", "2 personas"]), total(comp))} viene solo o en pareja.`, dibujar: (el) => barras(el, comp, { titulo: "Compañía" }) },
    { titulo: "En qué tipo de día vinieron", n: n("Tipo_dia"), destacado: `${fmtPct(suma(dia, ["Día de alta afluencia"]), total(dia))} respondió en un día de alta afluencia (fin de semana o festivo).`, dibujar: (el) => anillo(el, dia, { titulo: "Tipo de día", centro: dia[0], centroTexto: "día de alta afluencia" }) },
    { titulo: "A qué hora vinieron", n: n("Franja_horaria"), destacado: `La ${mayor(franja).etiqueta.toLowerCase()} es la franja más visitada: ${fmtPct(mayor(franja).n, total(franja))} de las respuestas.`, dibujar: (el) => barras(el, franja, { titulo: "Franja horaria" }) },
    { titulo: "Qué zonas usan más", n: n("Unidad_concreta"), destacado: `${zonas[0].etiqueta} y ${zonas[1].etiqueta.toLowerCase()} reúnen ${fmtPct(zonas[0].n + zonas[1].n, total(zonas))} de las respuestas.`, dibujar: (el) => barras(el, zonas, { titulo: "Unidad ambiental" }) },
    { titulo: "Cuánto tiempo se quedan", n: n("Tiempo_estancia"), destacado: `Lo más habitual es quedarse ${mayor(tiempo).etiqueta.toLowerCase()}: ${fmtPct(mayor(tiempo).n, total(tiempo))}.`, dibujar: (el) => barras(el, tiempo, { titulo: "Tiempo de estancia" }) },
    {
      titulo: "Cuánto tiempo se quedan, según lo que hacen", n: n("Tiempo_estancia"), ancha: true, destacado: "Quien pasea suele quedarse entre 1 y 2 horas; quien va a tomar el sol, en la mayoría de los casos más de 2.",
      dibujar: (el) => apiladas(el, cruce(rs, "Actividad_desarrollar", "Tiempo_estancia", (k) => estancia[ORDEN.Tiempo_estancia.indexOf(k)]), { titulo: "Actividad y tiempo de estancia", leyenda: ORDEN.Tiempo_estancia.map((e, i) => ({ etiqueta: e, n: 0, color: estancia[i] })) }),
    },
  ]));

  // 4 · Cómo se siente
  const sat = cats(rs, "Numero_usuarios_percibido", semaforoDe("Numero_usuarios_percibido")), com = cats(rs, "Grado_comodidad", semaforoDe("Grado_comodidad"));
  const aband = cats(rs, "Condicionante_mayor_afluencia", (k) => NO_ES_BUENO[k], ["Sí", "No", "Depende"]), haria = cats(rs, "Que_harias_mas_usuarios", semaforoDe("Que_harias_mas_usuarios"));
  const colorSit = (k: string) => SITUACION[ORDEN.Situacion_playa.indexOf(k)], colorCap = (k: string) => CAPACIDAD[ORDEN.Capacidad_acoger_mas_gente.indexOf(k)];
  const sit = cats(rs, "Situacion_playa", colorSit), cap = cats(rs, "Capacidad_acoger_mas_gente", colorCap);
  const conSit = rs.filter((r) => r.Situacion_playa), conCap = rs.filter((r) => r.Capacidad_acoger_mas_gente);
  bloques.push(bloque("sensacion", "Percepción", "¿Cómo se siente la gente?", "Aunque a veces se supera la capacidad, la mayoría siente que hay espacio de sobra y está cómoda.", [
    { titulo: "Espacio disponible", n: n("Superficie_disponible"), destacado: `${fmtPct(suma(sup, ["Muy amplio", "Amplio"]), total(sup))} siente que el espacio es amplio o muy amplio.`, dibujar: (el) => barras(el, sup, { titulo: "Espacio disponible" }) },
    { titulo: "Cuánta gente sentían a su alrededor", n: n("Numero_usuarios_percibido"), destacado: `Solo ${fmtPct(suma(sat, ["Alto", "Muy alto"]), total(sat))} percibía mucha o demasiada gente.`, dibujar: (el) => barras(el, sat, { titulo: "Saturación percibida" }) },
    { titulo: "Cómo de cómodos estaban", n: n("Grado_comodidad"), destacado: `${fmtPct(suma(com, ["Muy cómodo", "Cómodo"]), total(com))} estaba cómodo o muy cómodo.`, dibujar: (el) => barras(el, com, { titulo: "Comodidad" }) },
    { titulo: "¿Dejaría de venir si hubiera más gente?", n: n("Condicionante_mayor_afluencia"), destacado: `${fmtPct(suma(aband, ["No"]), total(aband))} seguiría viniendo aunque aumentara la afluencia.`, dibujar: (el) => anillo(el, aband, { titulo: "Abandonaría si hubiera más gente", centro: aband.find((c) => c.etiqueta === "No") ?? aband[0], centroTexto: "no dejaría de venir" }) },
    { titulo: "Qué haría si hubiera más gente", n: n("Que_harias_mas_usuarios"), destacado: `${fmtPct(haria[0].n, total(haria))} se quedaría igualmente; solo ${fmtPct(suma(haria, ["No volver más"]), total(haria))} no volvería.`, dibujar: (el) => barras(el, haria, { titulo: "Qué haría" }) },
    { titulo: "Qué haría, según de dónde viene", n: n("Que_harias_mas_usuarios"), ancha: true, destacado: "Quien vive en la ciudad es quien más tiende a quedarse igualmente; quien viene de otros municipios de la isla, bastante menos.", dibujar: (el) => apiladas(el, cruce(rs.filter((r) => r.Que_harias_mas_usuarios), "Procedencia", "Que_harias_mas_usuarios", semaforoDe("Que_harias_mas_usuarios")), { titulo: "Procedencia y decisión", leyenda: haria }) },
    { titulo: "¿Cómo veían la playa? Frente a la gente que desearían", n: n("Situacion_playa"), destacado: `${fmtPct(suma(sit, ["Nivel ideal"]), total(sit))} la veía en un nivel ideal; solo ${fmtPct(suma(sit, ["Algo más gente", "Mucha más gente"]), total(sit))}, con más gente de la que desearía.`, dibujar: (el) => barras(el, sit, { titulo: "Situación de la playa" }) },
    { titulo: "Cómo veían la playa, según la zona", n: conSit.length, ancha: true, destacado: "En todas las zonas predomina el nivel ideal; quien ve más gente de la deseada es minoría en cada una de ellas.", dibujar: (el) => apiladas(el, cruce(conSit, "Unidad_concreta", "Situacion_playa", colorSit), { titulo: "Unidad ambiental y situación de la playa", leyenda: sit }) },
    { titulo: "¿Cabe más gente en el Confital?", n: n("Capacidad_acoger_mas_gente"), destacado: `${fmtPct(suma(cap, ["Sí, muchas más", "Sí, algunas más"]), total(cap))} cree que podría acoger a más personas; ${fmtPct(suma(cap, ["No, ya está saturada"]), total(cap))} lo ve ya saturado.`, dibujar: (el) => barras(el, cap, { titulo: "Capacidad de acoger más gente" }) },
    { titulo: "¿Cabe más gente?, según de dónde vienen", n: conCap.length, ancha: true, destacado: "Quien viene de fuera de la isla cree que cabe más gente; quienes vienen de otros municipios de Gran Canaria son quienes más lo ven en su límite o saturado.", dibujar: (el) => apiladas(el, cruce(conCap, "Procedencia", "Capacidad_acoger_mas_gente", colorCap), { titulo: "Procedencia y capacidad de acoger más gente", leyenda: cap }) },
    { titulo: "¿Cabe más gente?, según la frecuencia de visita", n: conCap.length, ancha: true, destacado: "Quien viene a diario o cada semana cree que cabe más gente; quien viene pocas veces al año lo ve más a menudo en su límite.", dibujar: (el) => apiladas(el, cruce(conCap, "Frecuencia_visita", "Capacidad_acoger_mas_gente", colorCap), { titulo: "Frecuencia de visita y capacidad de acoger más gente", leyenda: cap }) },
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
  // 6 · Cruces de datos para el informe: combinaciones que ayudan a leer el resto.
  const colorDe = (campo: string) => semaforoDe(campo);
  const sitDia = cruce(conSit, "Tipo_dia", "Situacion_playa", colorSit);
  const satHora = cruce(rs, "Franja_horaria", "Numero_usuarios_percibido", colorDe("Numero_usuarios_percibido"));
  const comHora = cruce(rs, "Franja_horaria", "Grado_comodidad", colorDe("Grado_comodidad"));
  const espZona = conMinimo(cruce(rs, "Unidad_concreta", "Superficie_disponible", colorDe("Superficie_disponible")));
  const abandEdad = cruce(rs, "Franja_edad", "Condicionante_mayor_afluencia", (k) => NO_ES_BUENO[k]);
  const servEdad = cruce(rs.filter((r) => r.Servicios_suficientes), "Franja_edad", "Servicios_suficientes", (k) => SI_NO[k]);
  const medioFrec = cruce(rs, "Frecuencia_visita", "Medio_llegada", colorDe("Medio_llegada"));
  const tiempoProc = cruce(rs, "Procedencia", "Tiempo_estancia", (k) => estancia[ORDEN.Tiempo_estancia.indexOf(k)]);
  const masGente = ["Algo más gente", "Mucha más gente"], saturado = ["Alto", "Muy alto"], comodo = ["Muy cómodo", "Cómodo"], amplio = ["Muy amplio", "Amplio"];
  const noComodo = ["Adecuado", "Incómodo", "Muy incómodo"], noAmplio = ["Adecuado", "Insuficiente", "Muy insuficiente"];
  const peorHora = dondeMas(comHora, noComodo).grupo, menosEspacio = dondeMas(espZona, noAmplio).grupo, masEspacio = dondeMas(espZona, amplio).grupo;
  const horaSat = dondeMas(satHora, saturado).grupo, edadSensible = dondeMas(abandEdad, ["Sí"]).grupo;
  bloques.push(bloque("cruces", "Cruces de datos", "¿Qué se ve al cruzar las respuestas?", "Combinaciones de preguntas que ayudan a entender cuándo, dónde y para quién cambia la experiencia en el Confital.", [
    { titulo: "Cómo veían la playa, según el tipo de día", n: conSit.length, destacado: `En días de alta afluencia, ${enGrupo(sitDia, "Día de alta afluencia", masGente)} veía más gente de la deseada; en días de baja afluencia, ${enGrupo(sitDia, "Día de baja afluencia", masGente)}.`, dibujar: (el) => apiladas(el, sitDia, { titulo: "Tipo de día y situación de la playa", leyenda: sit }) },
    { titulo: "Saturación percibida, según la hora", n: n("Numero_usuarios_percibido"), destacado: `${horaSat === "Mañana" ? "Por la mañana" : horaSat === "Tarde" ? "Por la tarde" : "Al mediodía"} es cuando más gente percibe mucha o demasiada gente: ${enGrupo(satHora, horaSat, saturado)}.`, dibujar: (el) => apiladas(el, satHora, { titulo: "Franja horaria y saturación percibida", leyenda: sat }) },
    { titulo: "Comodidad, según la hora", n: n("Grado_comodidad"), destacado: `${peorHora === "Mañana" ? "Por la mañana" : peorHora === "Tarde" ? "Por la tarde" : "Al mediodía"} es cuando menos cómodo se está: ${enGrupo(comHora, peorHora, comodo)} estaba cómodo o muy cómodo.`, dibujar: (el) => apiladas(el, comHora, { titulo: "Franja horaria y comodidad", leyenda: com }) },
    { titulo: "Espacio disponible, según la zona", n: n("Superficie_disponible"), destacado: `Donde menos espacio se siente es en ${conArticulo(menosEspacio)}: ${enGrupo(espZona, menosEspacio, amplio)} lo ve amplio o muy amplio, frente al ${enGrupo(espZona, masEspacio, amplio)} en ${conArticulo(masEspacio)}.`, dibujar: (el) => apiladas(el, espZona, { titulo: "Unidad ambiental y espacio disponible", leyenda: sup }) },
    { titulo: "¿Dejaría de venir?, según la edad", n: n("Condicionante_mayor_afluencia"), destacado: `La edad más sensible a la afluencia es «${edadSensible.toLowerCase()}»: ${enGrupo(abandEdad, edadSensible, ["Sí"])} dejaría de venir si hubiera más gente (en total, ${fmtPct(suma(aband, ["Sí"]), total(aband))}).`, dibujar: (el) => apiladas(el, abandEdad, { titulo: "Edad y abandono si hubiera más gente", leyenda: aband }) },
    { titulo: "¿Son suficientes los servicios?, según la edad", n: n("Servicios_suficientes"), destacado: `Entre 31 y 45 años, ${enGrupo(servEdad, "Entre 31 y 45", ["No"])} cree que no son suficientes; entre los mayores de 65, ${enGrupo(servEdad, "Mayores de 65", ["No"])}.`, dibujar: (el) => apiladas(el, servEdad, { titulo: "Edad y servicios suficientes", leyenda: serv }) },
    { titulo: "Cómo llegan, según la frecuencia de visita", n: n("Medio_llegada"), ancha: true, destacado: `Quien viene a diario llega a pie en ${enGrupo(medioFrec, "Diaria", ["Caminando"])} de los casos; quien viene una vez al año o menos, en ${enGrupo(medioFrec, "Una vez al año o menos", ["Caminando"])}.`, dibujar: (el) => apiladas(el, medioFrec, { titulo: "Frecuencia de visita y medio de llegada", leyenda: medio }) },
    { titulo: "Cuánto tiempo se quedan, según de dónde vienen", n: n("Tiempo_estancia"), ancha: true, destacado: `Entre quienes viven en la ciudad, ${enGrupo(tiempoProc, "Mismo municipio", ["Menos de 1 hora"])} se queda menos de una hora y ${enGrupo(tiempoProc, "Mismo municipio", ["Más de 4 horas"])}, más de cuatro; entre los turistas internacionales, ${enGrupo(tiempoProc, "Turismo internacional", ["Entre 1 y 2 horas"])} se queda entre 1 y 2 horas.`, dibujar: (el) => apiladas(el, tiempoProc, { titulo: "Procedencia y tiempo de estancia", leyenda: tiempo }) },
  ]));
  return { kpis, bloques };
}
