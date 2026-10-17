// De dónde salen las respuestas que alimentan el panel.
// Hoy: las 174 del estudio (TFM). Cuando la hoja de Google del formulario esté publicada como
// CSV, se pone su dirección en CSV_EN_VIVO y sus filas se suman aquí: todos los gráficos se
// recalculan solos (por defecto, con «Todas» las respuestas).
import { cargar } from "./comun";

export type Respuesta = Record<string, string | number | null>;

export const CSV_EN_VIVO: string | null = null;

export async function respuestas(): Promise<Respuesta[]> {
  const estudio = await cargar<Respuesta[]>("encuestas.json");
  return estudio;
}
