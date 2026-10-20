import "./estilos.css";
import { partirPalabras, revelar } from "./comun";
import { conflictos } from "./secciones/conflictos";
import { conteos } from "./secciones/conteos";
import { embudo } from "./secciones/embudo";
import { iniciarDestacados } from "./secciones/paginas-datos";
import { portada } from "./secciones/portada";
import { procedencia } from "./secciones/procedencia";
import { unidades } from "./secciones/unidades";

partirPalabras();
revelar();

// La barra de navegación se vuelve sólida al salir de la portada.
const nav = document.querySelector("[data-nav]");
const portadaEl = document.getElementById("inicio");
if (nav && portadaEl)
  new IntersectionObserver(([e]) => nav.classList.toggle("nav--solida", !e.isIntersecting), { rootMargin: "-80px 0px 0px 0px" }).observe(portadaEl);

// La línea del tiempo se dibuja según se avanza.
const linea = document.querySelector<HTMLElement>("[data-linea]");
if (linea) {
  const actualizar = () => {
    const r = linea.getBoundingClientRect();
    const avance = Math.min(1, Math.max(0, (innerHeight * 0.6 - r.top) / r.height));
    linea.style.setProperty("--avance", avance.toFixed(3));
  };
  addEventListener("scroll", actualizar, { passive: true });
  actualizar();
}

portada();
embudo();
unidades();
conteos();
iniciarDestacados(procedencia());
conflictos();
