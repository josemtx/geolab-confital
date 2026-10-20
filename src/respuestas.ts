// De dónde salen las respuestas que alimentan el panel:
// - las 174 del estudio (TFM), ya depuradas (encuestas.json);
// - las del formulario de Google publicadas como CSV (CSV_EN_VIVO), recodificadas igual que
//   el estudio. Solo se suman las posteriores al cierre del estudio: las anteriores ya están
//   dentro de las 174 (son sus 54 respuestas online).
import { cargar } from "./comun";
import { leerFormulario, type Recodificacion } from "./formulario";

export type Respuesta = Record<string, string | number | null>;
export type Datos = { estudio: Respuesta[]; nuevas: Respuesta[]; actualizado: Date | null; error: string | null };

// Dirección del CSV publicado de la pestaña «publica» de la hoja de Google.
// Se puede cambiar sin tocar el código con la variable VITE_CSV_EN_VIVO (archivo .env.local).
export const CSV_EN_VIVO: string | null = import.meta.env.VITE_CSV_EN_VIVO || null;
const CIERRE_ESTUDIO = Date.parse("2026-04-22T00:00:00"); // última respuesta online del TFM: 21/04/2026

let estudio: Respuesta[] | null = null;
let recod: Recodificacion | null = null;

export async function cargarDatos(): Promise<Datos> {
  [estudio, recod] = await Promise.all([estudio ?? cargar<Respuesta[]>("encuestas.json"), recod ?? cargar<Recodificacion>("recodificacion.json")]);
  if (!CSV_EN_VIVO) return { estudio, nuevas: [], actualizado: null, error: null };
  try {
    const url = `${CSV_EN_VIVO}${CSV_EN_VIVO.includes("?") ? "&" : "?"}t=${Date.now()}`; // sin caché del navegador
    const texto = await (await fetch(url)).text();
    const lugares = [...new Set(estudio.map((r) => String(r.Lugar_concreto ?? "")).filter(Boolean))];
    const nuevas = leerFormulario(texto, recod, { Lugar_concreto: lugares })
      .filter((r) => r._instante > CIERRE_ESTUDIO)
      .map(({ _instante, ...r }) => r);
    return { estudio, nuevas, actualizado: new Date(), error: null };
  } catch (e) {
    return { estudio, nuevas: [], actualizado: null, error: String(e) };
  }
}
