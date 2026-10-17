// Estilo base de los mapas: ortofoto de GRAFCAN servida en directo por WMS (EPSG:3857).
// El servicio admite CORS, así que MapLibre puede pedir las teselas directamente.
import { addProtocol, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
// MapLibre 6 necesita la URL de su worker; Vite lo empaqueta en un único archivo.
import urlWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(urlWorker);

const WMS =
  "https://idecan1.grafcan.es/ServicioWMS/Ortofoto?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ortofoto&STYLES=&CRS=EPSG:3857" +
  "&BBOX={bbox-epsg-3857}&WIDTH=512&HEIGHT=512&FORMAT=image/jpeg";

// Fuera de la costa la ortofoto no tiene datos y llega en negro, con bordes en escalera.
// Este protocolo recibe cada tesela, vuelve transparentes esos píxeles negros y deja ver
// debajo un mar continuo del mismo tono que el de la ortofoto (rgb 23, 38, 54).
const MAR = "#172636";
addProtocol("orto", async (peticion, cancelar) => {
  const r = await fetch(peticion.url.slice("orto://".length), { signal: cancelar.signal });
  const mapa = await createImageBitmap(await r.blob());
  const lienzo = new OffscreenCanvas(mapa.width, mapa.height);
  const ctx = lienzo.getContext("2d")!;
  ctx.drawImage(mapa, 0, 0);
  const img = ctx.getImageData(0, 0, mapa.width, mapa.height);
  const px = new Uint32Array(img.data.buffer); // ABGR (little-endian)
  for (let i = 0; i < px.length; i++) {
    const v = px[i];
    if ((v & 255) < 18 && ((v >> 8) & 255) < 18 && ((v >> 16) & 255) < 18) px[i] = 0;
  }
  ctx.putImageData(img, 0, 0);
  const blob = await lienzo.convertToBlob({ type: "image/webp", quality: 0.9 });
  return { data: await blob.arrayBuffer() };
});

export const estiloOrto = (): StyleSpecification => ({
  version: 8,
  sources: {
    orto: { type: "raster", tiles: [`orto://${WMS}`], tileSize: 512, bounds: [-18.4, 27.4, -13.2, 29.5], maxzoom: 19 },
  },
  sky: { "sky-color": "#0b1020", "horizon-color": "#22385a", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.4, "fog-color": MAR, "fog-ground-blend": 0.9 },
  layers: [
    { id: "fondo", type: "background", paint: { "background-color": MAR } },
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
