// Portada: vuelo desde Gran Canaria hasta el Confital sobre la ortofoto en directo,
// y después un giro lento de cámara (se pausa cuando la portada no se ve).
import { Map as MapaGL } from "maplibre-gl";
import { movimientoReducido } from "../comun";
import { CONFITAL, estiloOrto } from "../mapa";

export function portada() {
  const cont = document.getElementById("mapa-portada");
  if (!cont) return;
  const destino = { center: CONFITAL, zoom: 15.4, pitch: 58, bearing: -38 };
  const mapa = new MapaGL({
    container: cont,
    style: estiloOrto(),
    center: [-15.6, 27.95],
    zoom: 8.6,
    pitch: 0,
    bearing: 0,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
  });

  let visible = true;
  let girando = false;
  const girar = () => {
    if (!visible || girando || movimientoReducido()) return;
    girando = true;
    mapa.easeTo({ bearing: mapa.getBearing() - 20, duration: 30000, easing: (t: number) => t });
    mapa.once("moveend", () => {
      girando = false;
      girar();
    });
  };

  mapa.once("load", () => {
    if (movimientoReducido()) {
      mapa.jumpTo(destino);
      return;
    }
    mapa.flyTo({ ...destino, duration: 9000, curve: 1.6, essential: true });
    mapa.once("moveend", girar);
  });

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) girar();
    else if (girando) mapa.stop();
  }).observe(cont);
}
