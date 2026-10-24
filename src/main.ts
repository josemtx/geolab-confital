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

// El menú marca el bloque por el que se va (historia, primera investigación…); en el móvil,
// donde no caben los enlaces, su nombre aparece junto al logo.
const enlaces = [...document.querySelectorAll<HTMLAnchorElement>('.nav__enlaces a[href^="#"]')];
const bloques = enlaces.map((a) => document.querySelector<HTMLElement>(a.hash)).filter((el): el is HTMLElement => !!el);
const nombreBloque = document.querySelector<HTMLElement>("[data-nav-bloque]");
let bloqueActual = -1;
const marcarBloque = () => {
  const linea = innerHeight * 0.4;
  const i = bloques.reduce((k, el, j) => (el.getBoundingClientRect().top <= linea ? j : k), -1);
  if (i === bloqueActual) return;
  bloqueActual = i;
  enlaces.forEach((a, j) => (j === i ? a.setAttribute("aria-current", "location") : a.removeAttribute("aria-current")));
  if (nombreBloque) nombreBloque.textContent = i >= 0 ? enlaces[i].textContent : "";
};
addEventListener("scroll", () => requestAnimationFrame(marcarBloque), { passive: true });
marcarBloque();

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
