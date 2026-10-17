// Estilo base de los mapas: ortofoto de GRAFCAN servida en directo por WMS (EPSG:3857).
// El servicio admite CORS, así que MapLibre puede pedir las teselas directamente.
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
// MapLibre 6 necesita la URL de su worker; Vite lo empaqueta en un único archivo.
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(urlWorker);

const WMS =
  "https://idecan1.grafcan.es/ServicioWMS/Ortofoto?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ortofoto&STYLES=&CRS=EPSG:3857" +
  "&BBOX={bbox-epsg-3857}&WIDTH=512&HEIGHT=512&FORMAT=image/jpeg";

export const estiloOrto = (): StyleSpecification => ({
  version: 8,
  sources: {
    orto: { type: "raster", tiles: [WMS], tileSize: 512, bounds: [-18.4, 27.4, -13.2, 29.5], maxzoom: 19 },
  },
  sky: { "sky-color": "#0b1020", "horizon-color": "#3a4f8f", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.4, "fog-color": "#1a2a6b", "fog-ground-blend": 0.9 },
  layers: [
    { id: "fondo", type: "background", paint: { "background-color": "#0b1020" } },
    { id: "orto", type: "raster", source: "orto", paint: { "raster-fade-duration": 400 } },
  ],
});

export type Caja = [number, number, number, number];
export const cajaDe = (coords: number[][]): Caja =>
  coords.reduce<Caja>((c, [x, y]) => [Math.min(c[0], x), Math.min(c[1], y), Math.max(c[2], x), Math.max(c[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);

// Todas las coordenadas de una geometría (Polygon / MultiPolygon / LineString…).
export const coordenadas = (g: { coordinates: unknown }): number[][] => {
  const out: number[][] = [];
  const recorrer = (x: unknown): void => {
    if (Array.isArray(x) && typeof x[0] === "number") out.push(x as number[]);
    else if (Array.isArray(x)) x.forEach(recorrer);
  };
  recorrer(g.coordinates);
  return out;
};

export const CONFITAL: [number, number] = [-15.4366, 28.1622];
