// Comprueba que la web recodifica el formulario igual que el estudio.
// Uso (desde web/):  node datos/comprobar_formulario.ts ../fuentes/formulario/<respuestas>.csv
// Pasa las respuestas anteriores al cierre del estudio por el mismo código que usa la web
// (src/formulario.ts) y las compara, campo a campo, con las 54 online de encuestas.json.
import { readFileSync } from "node:fs";
import { leerFormulario } from "../src/formulario.ts";

const csv = readFileSync(process.argv[2], "utf-8");
const estudio = JSON.parse(readFileSync("public/data/encuestas.json", "utf-8")) as Record<string, unknown>[];
const recod = JSON.parse(readFileSync("public/data/recodificacion.json", "utf-8"));
const lugares = [...new Set(estudio.map((r) => String(r.Lugar_concreto ?? "")).filter(Boolean))];

const web = leerFormulario(csv, recod, { Lugar_concreto: lugares }).filter((r) => r._instante < Date.parse("2026-04-22"));
const online = estudio.filter((r) => r.Modalidad === "Online");
if (web.length !== online.length) throw new Error(`${web.length} respuestas del formulario frente a ${online.length} online del estudio`);

const campos = ["Tipo_dia", "Franja_horaria", "Unidad_concreta", "Franja_edad", "Sexo", "Estudios", "Procedencia", "Lugar_concreto", "Frecuencia_visita", "Tiempo_estancia",
  "Actividad_desarrollar", "Medio_llegada", "Tipo_compania", "Conocimiento_existencia", "Superficie_disponible", "Numero_usuarios_percibido", "Grado_comodidad",
  "Condicionante_mayor_afluencia", "Que_harias_mas_usuarios", "Capacidad_acoger_mas_gente", "Valoras_visita", "Cierre_bano", "Cierre_coches",
  "Socorrismo", "Limpieza", "Accesibilidad", "Iluminacion", "Seguridad", "Senalizacion"];
let peor = 100;
for (const c of campos) {
  const fallos = web.map((r, i) => [r[c], online[i][c]]).filter(([a, b]) => (a ?? null) !== (b ?? null));
  const pct = (100 * (web.length - fallos.length)) / web.length;
  peor = Math.min(peor, pct);
  console.log(`${c.padEnd(30)} ${pct.toFixed(0).padStart(3)} %${fallos.length ? "   p. ej. " + fallos.slice(0, 2).map(([a, b]) => `web «${a}» / estudio «${b}»`).join(" · ") : ""}`);
}
console.log(`\nCampo con menos coincidencia: ${peor.toFixed(0)} %`);
