// Respuestas del formulario de Google → mismas categorías que el estudio (encuestas.json).
// 1) Cada columna se busca por el inicio de su encabezado (en español o en inglés), no por su
//    posición, por si la hoja cambia.
// 2) Lo escrito a mano se recodifica con las equivalencias que usó Adrián en el estudio
//    (recodificacion.json, aprendidas de las 54 respuestas online del TFM) y, si es nuevo,
//    con reglas de palabras clave. Las escalas se leen por su número (1 a 5), valga el idioma.
import { csvParse } from "d3-dsv";
import type { Respuesta } from "./respuestas";

export type Recodificacion = Record<string, Record<string, string>>;

// Mismo criterio que datos/aprender_recodificacion.py: sin tildes, minúsculas, espacios simples.
export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x00-\x7f]/g, "").toLowerCase().replace(/\s+/g, " ").replace(/^[ .]+|[ .]+$/g, "");

const COLUMNAS: [campo: string, es: string, en: string][] = [
  ["fecha", "Marca temporal", "Marca temporal"],
  ["dias", "¿En qué día o días", "Which days"],
  ["franja", "Cuando acude, ¿en qué franja", "When you visit"],
  ["zona", "Atendiendo al mapa", "Based on the map"],
  ["edad", "Edad", "Age"],
  ["sexo", "Sexo", "Sex"],
  ["estudios", "Nivel de estudios", "Education level"],
  ["procedencia", "Lugar de procedencia", "Place of origin"],
  ["barrio", "Indique el barrio", "Indicate the neighborhood"],
  ["municipio", "Indique el municipio", "Indicate the municipality"],
  ["isla", "Indique la isla", "Indicate the island"],
  ["provincia", "Indique la provincia", "Indicate the province"],
  ["pais", "Indique el país", "Indicate the country"],
  ["frecuencia", "¿Cuál es la frecuencia", "How often"],
  ["tiempo", "Cuando acude al Confital, ¿Cuánto tiempo", "How much time"],
  ["actividad", "¿Qué principal actividad", "What activity"],
  ["medio", "Cuando acude al Confital, ¿A través de qué medio", "How did you arrive"],
  ["compania", "Cuando acude al Confital, ¿Cómo es su compañía", "Including yourself"],
  ["conocimiento", "¿Cómo conoció", "How did you learn"],
  ["espacio", "¿Cómo valoras el espacio", "How would you rate the space"],
  ["saturacion", "Durante tu visita", "How did you percieve"],
  ["comodidad", "¿En qué medida te sentiste", "To what extent"],
  ["dejaria", "Si aumentara el número", "If the number o"],
  ["harias", "Si el Confital estuviera demasiado lleno", "If el Confital were too full"],
  ["acoger", "En general, ¿Consideras", "In general"],
  ["valoras", "¿Qué es lo que más valoras", "What do you value"],
  ["bano", "¿Es para usted un condicionante", "Is the fact that the beach"],
  ["coches", "¿Considera que el cierre al acceso", "Do you consider the closure"],
  ["Socorrismo", "[Socorrismo]", "[Lifeguard services]"],
  ["Limpieza", "[Limpieza]", "[Cleaning/maintenance]"],
  ["Accesibilidad", "[Accesibilidad]", "[Accesibility]"],
  ["Iluminacion", "[Iluminación]", "[Lighting]"],
  ["Seguridad", "[Seguridad]", "[Security]"],
  ["Senalizacion", "[Señalización]", "[SIgnage]"],
];

// Escalas 1–5 (el número va delante de la respuesta: «3. Adecuado»).
const ESCALAS: Record<string, string[]> = {
  espacio: ["Muy insuficiente", "Insuficiente", "Adecuado", "Amplio", "Muy amplio"],
  saturacion: ["Muy bajo", "Bajo", "Adecuado", "Alto", "Muy alto"],
  comodidad: ["Muy incómodo", "Incómodo", "Adecuado", "Cómodo", "Muy cómodo"],
  servicio: ["Muy mejorable", "Mejorable", "Adecuado", "Bueno", "Muy bueno"],
};
const escala = (v: string, tipo: string) => {
  const k = Number(v.trim()[0]);
  return k >= 1 && k <= 5 ? ESCALAS[tipo][k - 1] : null;
};

// Primera regla cuyo patrón aparece en el texto normalizado.
const reglas = (v: string, lista: [RegExp, string][], otro: string | null = null) => lista.find(([re]) => re.test(norm(v)))?.[1] ?? otro;

const UNIDAD_POR_NUMERO = ["Talud coluvial", "Depósitos sedimentarios costeros", "Pista de tierra", "Área de reposo", "Pasarela de madera", "Área de reposo", "Zona de surf"];

export function leerFormulario(texto: string, recod: Recodificacion, conocidos: Record<string, string[]>): (Respuesta & { _instante: number })[] {
  const filas = csvParse(texto);
  const cabeceras = filas.columns;
  // Para cada campo: columna en español y en inglés (la que tenga respuesta, gana).
  const columna = (inicio: string) => cabeceras.find((c) => c.trim().startsWith(inicio) || (inicio.startsWith("[") && c.includes(inicio))) ?? null;
  const cols = COLUMNAS.map(([campo, es, en]) => ({ campo, es: columna(es), en: es === en ? null : columna(en) }));

  return filas.flatMap((fila) => {
    const v = (campo: string) => {
      const c = cols.find((x) => x.campo === campo)!;
      const valor = (c.es && fila[c.es]?.trim()) || (c.en && fila[c.en]?.trim()) || "";
      return valor || null;
    };
    const tabla = (campo: string, valor: string | null) => (valor ? (recod[campo]?.[norm(valor)] ?? null) : null);
    const frecuencia = v("frecuencia");
    if (!frecuencia || /nunca|never/.test(norm(frecuencia))) return []; // quien nunca ha ido no cuenta (como en el estudio)

    // «19/03/2026 8:32:46»: Google no pone cero delante de la hora; sin él, la fecha no sería válida.
    const [dia, hora = "0:00:00"] = (v("fecha") ?? "").split(" ");
    const [d, m, a] = dia.split("/").map(Number);
    const [hh, mm, ss] = hora.split(":").map((x) => x.padStart(2, "0"));
    const instante = new Date(`${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${hh}:${mm}:${ss ?? "00"}`).getTime();
    if (!Number.isFinite(instante)) return []; // fila sin fecha legible: mejor fuera que mal contada
    const procedencia = reglas(v("procedencia") ?? "", [
      [/mismo municipio|same municipality/, "Mismo municipio"],
      [/otro municipio|another municipality|other municipality/, "Otro municipio de Gran Canaria"],
      [/otra isla|another island|other island/, "Otra isla canaria"],
      [/internacional|international/, "Turismo internacional"], // antes que «nacional», que está contenida en ella
      [/nacional|national/, "Turismo nacional"],
    ]);
    const textoLugar = procedencia === "Mismo municipio" ? v("barrio") : procedencia === "Otro municipio de Gran Canaria" ? v("municipio") : procedencia === "Otra isla canaria" ? v("isla") : procedencia === "Turismo nacional" ? v("provincia") : v("pais");
    // Lugar: equivalencia del estudio → nombre ya conocido escrito igual → el texto, limpio.
    const lugar = textoLugar
      ? (tabla("Lugar_concreto", textoLugar) ?? conocidos.Lugar_concreto.find((k) => norm(k) === norm(textoLugar)) ?? textoLugar.trim().toLowerCase().replace(/\s+/g, " ").replace(/(^|\s)(\p{L})/gu, (_, e, c) => e + c.toUpperCase()).replace(/ (De|La|Las|Los|Del|Y) /g, (x) => x.toLowerCase()))
      : null;
    const zona = v("zona");
    const actividad = v("actividad");
    const servicios = Object.fromEntries(["Socorrismo", "Limpieza", "Accesibilidad", "Iluminacion", "Seguridad", "Senalizacion"].map((s) => [s, v(s) ? escala(v(s)!, "servicio") : null]));

    const r: Respuesta & { _instante: number } = {
      _instante: instante,
      Tipo_dia: v("dias") ? (/lunes|weekday|monday/.test(norm(v("dias")!)) ? "Valle" : "Pico") : null,
      Dia_mes: Number.isFinite(instante) ? new Date(instante).toISOString().slice(0, 10) : null,
      Franja_horaria: reglas(v("franja") ?? "", [[/manana|morning/, "Mañana"], [/mediodia|midday|noon/, "Mediodía"], [/tarde|afternoon|evening/, "Tarde"]]),
      Numero_usuarios_estimado: null,
      Usuarios_totales: null,
      Unidad_concreta: zona ? (tabla("Unidad_concreta", zona) ?? UNIDAD_POR_NUMERO[Number(zona.match(/\d/)?.[0]) - 1] ?? null) : null,
      Franja_edad: reglas(v("edad") ?? "", [[/18/, "Entre 18 y 30"], [/31/, "Entre 31 y 45"], [/46/, "Entre 46 y 65"], [/65|mayor|over|older/, "Mayores de 65"]]),
      Sexo: v("sexo") ? reglas(v("sexo")!, [[/^hombre|^man|^male/, "Hombre"], [/^mujer|^woman|^female/, "Mujer"]], "Otro") : null,
      Estudios: tabla("Estudios", v("estudios")) ?? reglas(v("estudios") ?? "", [
        [/univers|doctor|master|grado|licenc|maestr|degree|phd|bachelor/, "Universitarios"],
        [/secund|bachill|cou|fp|formacion|high school|secondary|vocational/, "Secundarios"],
        [/primar|primary|elementary/, "Primarios"],
      ]),
      Procedencia: procedencia,
      Lugar_concreto: lugar,
      Frecuencia_visita: reglas(frecuencia, [
        [/diari|daily/, "Diaria"], [/seman|weekly/, "Semanal"], [/mensual|monthly/, "Mensual"], [/ocasional|occasional/, "Ocasional"],
        [/varias|several/, "Varias veces al año"], [/una vez|once/, "Una vez al año o menos"], [/anual|yearly|annual/, "Anual"], [/primera|first/, "Primera vez"],
      ]),
      Tiempo_estancia: reglas(v("tiempo") ?? "", [[/menos de 1|less than 1/, "Menos de 1 hora"], [/1 y 2|1 and 2|1-2/, "Entre 1 y 2 horas"], [/2 y 4|2 and 4|2-4/, "Entre 2 y 4 horas"], [/mas de 4|more than 4/, "Más de 4 horas"]]),
      Actividad_desarrollar: tabla("Actividad_desarrollar", actividad) ?? reglas((actividad ?? "").split(",")[0], [
        [/pase|walk|stroll/, "Pasear"], [/solar|sunbath/, "Solárium"], [/repos|descans|rest/, "Reposo"], [/corr|run|jog/, "Correr"], [/surf/, "Surf"],
        [/pesc|fish/, "Pesca"], [/bano|swim|playa/, "Baño"], [/bici|bike|cycl/, "Bicicleta"], [/cientif|guiad|divulg|educa|scien/, "Actividades científicas"],
      ], actividad ? "Otras" : null),
      Medio_llegada: tabla("Medio_llegada", v("medio")) ?? reglas(v("medio") ?? "", [[/camin|andando|a pie|walk|foot/, "Caminando"], [/coche|car/, "Coche"], [/guagua|bus|transporte|public/, "Transporte público"], [/moto/, "Motocicleta"], [/bici|bike|cycl/, "Bicicleta"]]),
      Tipo_compania: reglas(v("compania") ?? "", [[/solo|alone|^1/, "Solo"], [/^2/, "2 personas"], [/^3/, "3 personas"], [/^4|mas|more/, "4 o más personas"]]),
      Conocimiento_existencia: tabla("Conocimiento_existencia", v("conocimiento")) ?? reglas(v("conocimiento") ?? "", [
        [/proximidad|cerca|toda la vida|infancia|famili|near|close/, "Proximidad a lugar de residencia"], [/recomend|recommend|amig|friend/, "Recomendación de amigos o familia"],
        [/internet|redes|social media|online/, "Internet o redes sociales"], [/academ|profesor|excursion|cientif|laboral|trabajo|surf|deport|school|work|sport/, "Actividades laborales, deportivas o académicas"],
        [/turismo|guiad|tour/, "Turismo o actividad guiada"], [/senaliz|casual|sign/, "Señalización o visita casual"], [/socializ/, "Socialización"], [/siempre|isla|conocido|known|always/, "Conocimiento generalizado"],
      ], v("conocimiento") ? "Otros" : null),
      Superficie_disponible: v("espacio") ? escala(v("espacio")!, "espacio") : null,
      Numero_usuarios_percibido: v("saturacion") ? escala(v("saturacion")!, "saturacion") : null,
      Grado_comodidad: v("comodidad") ? escala(v("comodidad")!, "comodidad") : null,
      Situacion_playa: null,
      Condicionante_mayor_afluencia: tabla("Condicionante_mayor_afluencia", v("dejaria")) ?? (v("dejaria") ? reglas(v("dejaria")!, [[/^s[i]\b|^si,|^yes/, "Sí"], [/^no\b/, "No"]], "Depende") : null),
      Que_harias_mas_usuarios: reglas(v("harias") ?? "", [
        [/quedarme|stay/, "Quedarme igualmente"], [/otra zona|another area|other area|another part/, "Ir a otra zona del Confital"], [/playa cercana|nearby beach|another beach/, "Ir a una playa cercana"],
        [/otro dia|another day/, "Volver otro día"], [/no volver|not come back|never come back|stop coming/, "No volver más"],
      ]),
      Capacidad_acoger_mas_gente: v("acoger") ? reglas(v("acoger")!, [[/muchas|many|much/, "Sí, muchas más"], [/algunas|some|few/, "Sí, algunas más"], [/limite|limit/, "No, está en su límite"], [/saturad|saturat|full/, "No, ya está saturada"]]) : null,
      Valoras_visita: tabla("Valoras_visita", v("valoras")) ?? reglas(v("valoras") ?? "", [
        [/tranquil|calm|quiet|peace/, "Tranquilidad"], [/personal|privac/, "Espacio personal"], [/paisaj|vista|landscape|view/, "Paisaje"], [/patrimon|geolog|geomorf|valores|heritage/, "Valores"],
        [/natur/, "Naturalidad"], [/entorno|surround|environment/, "Entorno"], [/cercan|accesib|close|access/, "Cercanía y accesibilidad"], [/social/, "Contacto social"],
        [/animad|lively/, "Ambiente animado"], [/surf|deport|sport/, "Actividades deportivas"], [/aire|air/, "Aire limpio"], [/virgen|pristine/, "Espacio virgen"],
      ], v("valoras") ? "Otros" : null),
      Cierre_bano: tabla("Cierre_bano", v("bano")) ?? (v("bano") ? (/^s[i]\b|^si,|^yes/.test(norm(v("bano")!)) ? "Sí" : "No") : null),
      Cierre_coches: tabla("Cierre_coches", v("coches")) ?? (v("coches") ? (/^s[i]\b|^si,|^yes/.test(norm(v("coches")!)) ? "Sí" : "No") : null),
      Servicios_suficientes: null,
      ...servicios,
      Modalidad: "Online",
      Fuente: "Encuesta GeoLab",
    };
    return [r];
  });
}
