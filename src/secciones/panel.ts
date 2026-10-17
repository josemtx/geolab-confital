// Panel de resultados de la segunda investigación (TFM), siguiendo el documento de Adrián:
// variables, orden de las respuestas y simbología de color de cada gráfico.
// Todo se calcula a partir de las respuestas, así que se actualiza solo cuando entren nuevas.
import { anillo, apiladas, barras, degradado, fmtPct, mosaico, type Cat, type Grupo } from "../graficos";
import { respuestas, type Respuesta } from "../respuestas";
import { percepcionUnidades } from "./percepcion-unidades";

// --- Paletas con significado (documento de Adrián) ------------------------------------------
export const SEMAFORO = ["#15803d", "#84cc16", "#facc15", "#f97316", "#dc2626"]; // de lo mejor a lo peor
const SI_NO = { Sí: "#16a34a", No: "#dc2626", Depende: "#9ca3af" } as Record<string, string>;
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

// --- Tarjetas ----------------------------------------------------------------------------------
type Tarjeta = { titulo: string; n: number; destacado: string; ancha?: boolean; dibujar: (el: HTMLElement) => void; extra?: string };

const tarjeta = (t: Tarjeta) => {
  const art = document.createElement("article");
  art.className = `tarjeta${t.ancha ? " tarjeta--ancha" : ""}`;
  art.innerHTML = `<h4>${t.titulo}</h4><p class="tarjeta__n">${t.n} respuestas</p><p class="tarjeta__destacado">${t.destacado}</p><div class="grafico__lienzo"></div>${t.extra ?? ""}`;
  return art;
};

function bloque(cont: Element, id: string, sobretitulo: string, titulo: string, intro: string, tarjetas: Tarjeta[]) {
  const sec = document.createElement("div");
  sec.className = "panel-bloque";
  sec.id = id;
  sec.innerHTML = `<div class="contenedor"><p class="sobretitulo">${sobretitulo}</p><h3 class="titular titular--bloque" data-revelar>${titulo}</h3><p class="entradilla">${intro}</p><div class="tarjetas"></div></div>`;
  cont.append(sec);
  const rejilla = sec.querySelector(".tarjetas")!;
  // Cada gráfico se dibuja al acercarse a la pantalla (y se anima al aparecer).
  tarjetas.forEach((t) => {
    const art = tarjeta(t);
    rejilla.append(art);
    const io = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      io.disconnect();
      t.dibujar(art.querySelector(".grafico__lienzo")!);
      art.classList.add("visible");
    }, { rootMargin: "200px 0px" });
    io.observe(art);
  });
  return sec;
}

export async function panel() {
  const cont = document.querySelector("[data-panel]");
  if (!cont) return;
  const rs = await respuestas();
  const n = (campo: string) => rs.filter((r) => r[campo] !== null && r[campo] !== undefined && r[campo] !== "").length;

  // Cifras clave
  const proc = cats(rs, "Procedencia", porRango), medio = cats(rs, "Medio_llegada", semaforoDe("Medio_llegada")), sup = cats(rs, "Superficie_disponible", semaforoDe("Superficie_disponible")), serv = cats(rs, "Servicios_suficientes", (k) => SI_NO[k]);
  const kpis = document.querySelector("[data-kpis]");
  if (kpis)
    kpis.innerHTML = [
      [String(rs.length), "voces escuchadas"],
      [fmtPct(proc[0].n, total(proc)), "vive en Las Palmas de Gran Canaria"],
      [fmtPct(suma(medio, ["Caminando"]), total(medio)), "llega caminando"],
      [fmtPct(suma(sup, ["Muy amplio", "Amplio"]), total(sup)), "siente que hay espacio de sobra"],
      [fmtPct(suma(serv, ["No"]), total(serv)), "pide más y mejores servicios"],
    ]
      .map(([v, t]) => `<div class="kpi" data-revelar><b>${v}</b><span>${t}</span></div>`)
      .join("");

  // 1 · Quién viene
  const sexo = cats(rs, "Sexo", (k) => ({ Hombre: "#2563eb", Mujer: "#ec4899" })[k] ?? "#9ca3af", ["Hombre", "Mujer", "Otro"]);
  const edad = cats(rs, "Franja_edad", porRango), est = cats(rs, "Estudios", porRango);
  const mismo = rs.filter((r) => r.Procedencia === "Mismo municipio"), otros = rs.filter((r) => r.Procedencia === "Otro municipio de Gran Canaria");
  const barrios = cats(mismo, "Lugar_concreto", () => AZUL, undefined), munis = cats(otros, "Lugar_concreto", () => AZUL, undefined);
  bloque(cont, "quien", "Perfil de quien visita", "¿Quién viene al Confital?", "Sobre todo gente de la ciudad, que viene a menudo y a pie.", [
    { titulo: "Sexo", n: n("Sexo"), destacado: `Responden algo más hombres (${fmtPct(sexo[0].n, total(sexo))}) que mujeres (${fmtPct(sexo[1]?.n ?? 0, total(sexo))}).`, dibujar: (el) => anillo(el, sexo, { titulo: "Sexo", centro: mayor(sexo) }) },
    { titulo: "Edad", n: n("Franja_edad"), destacado: `El grupo más numeroso tiene ${mayor(edad).etiqueta.toLowerCase().replace("entre", "entre")} años (${fmtPct(mayor(edad).n, total(edad))}).`, dibujar: (el) => barras(el, edad, { titulo: "Edad" }) },
    { titulo: "De dónde vienen", n: n("Procedencia"), destacado: `${fmtPct(proc[0].n, total(proc))} vive en el propio municipio de Las Palmas de Gran Canaria.`, dibujar: (el) => barras(el, proc, { titulo: "Procedencia" }) },
    { titulo: "Nivel de estudios", n: n("Estudios"), destacado: `${fmtPct(mayor(est).n, total(est))} tiene estudios ${mayor(est).etiqueta.toLowerCase()}.`, dibujar: (el) => barras(el, est, { titulo: "Estudios" }) },
    {
      titulo: "Barrios de Las Palmas de Gran Canaria", n: mismo.length, ancha: true,
      destacado: `${barrios[0].etiqueta} es, con diferencia, el barrio que más visitantes aporta (${barrios[0].n} personas). Los barrios de la Ciudad Baja concentran la mayoría, quizá por su mejor conexión en transporte público.`,
      dibujar: (el) => barras(el, barrios, { titulo: "Barrios", vertical: true, sinPct: true }),
    },
    {
      titulo: "Otros municipios de Gran Canaria", n: otros.length,
      destacado: `${munis[0].etiqueta}, ${munis[1].etiqueta} y ${munis[2].etiqueta} son los municipios que más visitantes aportan.`,
      dibujar: (el) => barras(el, munis, { titulo: "Municipios", sinPct: true }),
    },
    {
      titulo: "Y más allá de Gran Canaria", n: rs.length - mismo.length - otros.length,
      destacado: "Descarga los mapas de procedencia de quienes vienen de otras islas, de otras comunidades autónomas y de otros países.",
      dibujar: () => {},
      extra: `<div class="mapas-descarga">${[["autonomica", "Canarias"], ["nacional", "España"], ["europea", "Europa"], ["mundial", "América"]]
        .map(([f, t]) => `<a href="descargas/procedencia_escala_${f}.jpg" download><img src="descargas/mini/${f}.webp" alt="Mapa de procedencia: ${t}" loading="lazy" width="640" height="452"/><span>↓ ${t}</span></a>`)
        .join("")}</div>`,
    },
  ]);

  // 2 · Por qué viene
  const conoc = cats(rs, "Conocimiento_existencia", porRango), valora = cats(rs, "Valoras_visita", porRango);
  bloque(cont, "motivos", "Motivación de la visita", "¿Por qué viene la gente?", "Lo conocen porque viven cerca o se lo recomendaron, y lo que más valoran es la tranquilidad.", [
    { titulo: "Cómo conocieron el Confital", n: n("Conocimiento_existencia"), ancha: true, destacado: `«${mayor(conoc).etiqueta}» es la respuesta más común (${fmtPct(mayor(conoc).n, total(conoc))}).`, dibujar: (el) => mosaico(el, conoc, { titulo: "Cómo conocieron el Confital" }) },
    { titulo: "Qué es lo que más valoran", n: n("Valoras_visita"), ancha: true, destacado: `La ${mayor(valora).etiqueta.toLowerCase()} lo es todo: ${fmtPct(mayor(valora).n, total(valora))} la elige como lo más valioso.`, dibujar: (el) => mosaico(el, valora, { titulo: "Qué valoran" }) },
  ]);

  // 3 · Cómo usa el espacio
  const frec = cats(rs, "Frecuencia_visita", () => AZUL), act = cats(rs, "Actividad_desarrollar", () => AZUL), comp = cats(rs, "Tipo_compania", porRango);
  const estancia = ["#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a"];
  bloque(cont, "habitos", "Hábitos de uso", "¿Cómo usan el Confital?", "Llegan caminando, solos o en pareja, y sobre todo a pasear.", [
    { titulo: "Cómo llegan", n: n("Medio_llegada"), destacado: `${fmtPct(suma(medio, ["Caminando"]), total(medio))} llega caminando. Los colores van del medio más sostenible (verde) al que más contamina (rojo).`, dibujar: (el) => barras(el, medio, { titulo: "Medio de llegada" }) },
    { titulo: "Con qué frecuencia vienen", n: n("Frecuencia_visita"), destacado: `${fmtPct(suma(frec, ["Diaria", "Semanal"]), total(frec))} viene cada día o cada semana.`, dibujar: (el) => barras(el, frec, { titulo: "Frecuencia" }) },
    { titulo: "Cómo llegan, según de dónde vienen", n: n("Medio_llegada"), ancha: true, destacado: "Quien vive cerca llega a pie; quien viene de otros municipios, en coche.", dibujar: (el) => apiladas(el, cruce(rs, "Procedencia", "Medio_llegada", semaforoDe("Medio_llegada")), { titulo: "Procedencia y medio de llegada", leyenda: medio }) },
    { titulo: "Qué hacen en el Confital", n: n("Actividad_desarrollar"), destacado: `${fmtPct(act[0].n, total(act))} viene, sobre todo, a ${act[0].etiqueta.toLowerCase()}.`, dibujar: (el) => barras(el, act, { titulo: "Actividad principal", vertical: true }) },
    { titulo: "Con quién vienen", n: n("Tipo_compania"), destacado: `${fmtPct(suma(comp, ["Solo", "2 personas"]), total(comp))} viene solo o en pareja.`, dibujar: (el) => barras(el, comp, { titulo: "Compañía" }) },
    {
      titulo: "Cuánto tiempo se quedan, según lo que hacen", n: n("Tiempo_estancia"), ancha: true, destacado: "Quien pasea suele quedarse entre 1 y 2 horas; quien va a tomar el sol, en la mayoría de los casos más de 2.",
      dibujar: (el) => apiladas(el, cruce(rs, "Actividad_desarrollar", "Tiempo_estancia", (k) => estancia[ORDEN.Tiempo_estancia.indexOf(k)]), { titulo: "Actividad y tiempo de estancia", leyenda: ORDEN.Tiempo_estancia.map((e, i) => ({ etiqueta: e, n: 0, color: estancia[i] })) }),
    },
  ]);

  // 4 · Cómo se siente
  const sat = cats(rs, "Numero_usuarios_percibido", semaforoDe("Numero_usuarios_percibido")), com = cats(rs, "Grado_comodidad", semaforoDe("Grado_comodidad"));
  const aband = cats(rs, "Condicionante_mayor_afluencia", (k) => SI_NO[k], ["Sí", "No", "Depende"]), haria = cats(rs, "Que_harias_mas_usuarios", semaforoDe("Que_harias_mas_usuarios"));
  const s = bloque(cont, "sensacion", "Percepción", "¿Cómo se siente la gente?", "Aunque a veces se supera la capacidad, la mayoría siente que hay espacio de sobra y está cómoda.", [
    { titulo: "Espacio disponible", n: n("Superficie_disponible"), destacado: `${fmtPct(suma(sup, ["Muy amplio", "Amplio"]), total(sup))} siente que el espacio es amplio o muy amplio.`, dibujar: (el) => barras(el, sup, { titulo: "Espacio disponible" }) },
    { titulo: "Cuánta gente sentían a su alrededor", n: n("Numero_usuarios_percibido"), destacado: `Solo ${fmtPct(suma(sat, ["Alto", "Muy alto"]), total(sat))} percibía mucha o demasiada gente.`, dibujar: (el) => barras(el, sat, { titulo: "Saturación percibida" }) },
    { titulo: "Cómo de cómodos estaban", n: n("Grado_comodidad"), destacado: `${fmtPct(suma(com, ["Muy cómodo", "Cómodo"]), total(com))} estaba cómodo o muy cómodo.`, dibujar: (el) => barras(el, com, { titulo: "Comodidad" }) },
    { titulo: "¿Dejaría de venir si hubiera más gente?", n: n("Condicionante_mayor_afluencia"), destacado: `${fmtPct(suma(aband, ["No"]), total(aband))} seguiría viniendo aunque aumentara la afluencia.`, dibujar: (el) => anillo(el, aband, { titulo: "Abandonaría si hubiera más gente", centro: aband.find((c) => c.etiqueta === "No") ?? aband[0], centroTexto: "no dejaría de venir" }) },
    { titulo: "Qué haría si hubiera más gente", n: n("Que_harias_mas_usuarios"), destacado: `${fmtPct(haria[0].n, total(haria))} se quedaría igualmente; solo ${fmtPct(suma(haria, ["No volver más"]), total(haria))} no volvería.`, dibujar: (el) => barras(el, haria, { titulo: "Qué haría" }) },
    { titulo: "Qué haría, según de dónde viene", n: n("Que_harias_mas_usuarios"), ancha: true, destacado: "Quien vive en la ciudad es quien más tiende a quedarse igualmente; quien viene de otros municipios de la isla, bastante menos.", dibujar: (el) => apiladas(el, cruce(rs.filter((r) => r.Que_harias_mas_usuarios), "Procedencia", "Que_harias_mas_usuarios", semaforoDe("Que_harias_mas_usuarios")), { titulo: "Procedencia y decisión", leyenda: haria }) },
  ]);
  percepcionUnidades(s.querySelector(".tarjetas")!, rs);

  // 5 · Qué hay que mejorar
  const bano = cats(rs, "Cierre_bano", (k) => SI_NO[k], ["Sí", "No"]), coche = cats(rs, "Cierre_coches", (k) => SI_NO[k], ["Sí", "No"]);
  const servicios = ["Socorrismo", "Seguridad", "Senalizacion", "Accesibilidad", "Limpieza", "Iluminacion"];
  const nombreServ: Record<string, string> = { Senalizacion: "Señalización", Iluminacion: "Iluminación" };
  const valoracion = servicios
    .map((sv) => ({ grupo: nombreServ[sv] ?? sv, cats: cats(rs, sv, semaforoDe("Servicio"), ORDEN.Servicio).map((c) => ({ ...c, color: SEMAFORO[ORDEN.Servicio.indexOf(c.etiqueta)] })) }))
    .sort((a, b) => suma(b.cats, ["Mejorable", "Muy mejorable"]) / total(b.cats) - suma(a.cats, ["Mejorable", "Muy mejorable"]) / total(a.cats));
  bloque(cont, "gestion", "Gestión del espacio", "¿Qué habría que mejorar?", "Los servicios son la gran asignatura pendiente, sobre todo el socorrismo y los aseos.", [
    { titulo: "¿Son suficientes los servicios?", n: n("Servicios_suficientes"), destacado: `${fmtPct(suma(serv, ["No"]), total(serv))} cree que no son suficientes.`, dibujar: (el) => anillo(el, serv, { titulo: "Servicios suficientes", centro: serv.find((c) => c.etiqueta === "No") ?? serv[0], centroTexto: "no son suficientes" }) },
    { titulo: "Cómo valoran cada servicio", n: n("Socorrismo"), destacado: `El socorrismo es el peor valorado: ${fmtPct(suma(valoracion[0].cats, ["Mejorable", "Muy mejorable"]), total(valoracion[0].cats))} lo considera mejorable o muy mejorable.`, dibujar: (el) => apiladas(el, valoracion, { titulo: "Valoración de los servicios", horizontal: true, leyenda: ORDEN.Servicio.map((e, i) => ({ etiqueta: e, n: 0, color: SEMAFORO[i] })) }) },
    { titulo: "¿Son suficientes, según de dónde vienen?", n: n("Servicios_suficientes"), ancha: true, destacado: "Quienes viven en Las Palmas de Gran Canaria son quienes más echan en falta servicios; los turistas, mucho menos.", dibujar: (el) => apiladas(el, cruce(rs.filter((r) => r.Servicios_suficientes), "Procedencia", "Servicios_suficientes", (k) => SI_NO[k]), { titulo: "Procedencia y servicios", leyenda: serv }) },
    { titulo: "¿Le condiciona que no se recomiende el baño?", n: n("Cierre_bano"), destacado: `A ${fmtPct(suma(bano, ["No"]), total(bano))} no le condiciona: desde 2017 el baño no se recomienda y desde 2021 hay bandera roja permanente.`, dibujar: (el) => anillo(el, bano, { titulo: "Cierre al baño", centro: bano.find((c) => c.etiqueta === "No") ?? bano[0], centroTexto: "no le condiciona" }) },
    { titulo: "¿Le condiciona el cierre al tráfico?", n: n("Cierre_coches"), destacado: `A ${fmtPct(suma(coche, ["No"]), total(coche))} no le condiciona que no se pueda entrar en coche.`, dibujar: (el) => anillo(el, coche, { titulo: "Cierre al tráfico", centro: coche.find((c) => c.etiqueta === "No") ?? coche[0], centroTexto: "no le condiciona" }) },
    { titulo: "El cierre al baño, según la frecuencia de visita", n: n("Cierre_bano"), ancha: true, destacado: "A quien viene a diario no le condiciona; a quien viene solo unas pocas veces al año, bastante más.", dibujar: (el) => apiladas(el, cruce(rs, "Frecuencia_visita", "Cierre_bano", (k) => SI_NO[k]), { titulo: "Frecuencia y cierre al baño", leyenda: bano }) },
  ]);
}
