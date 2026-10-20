// El embudo de la pasarela de madera: 283 → 94 → 24 personas, con cada factor de corrección
// «comiéndose» puntos, y un simulador de «más servicios, más capacidad».
// Factores de CALCULOS_CCT (pasarela, unidad D).
import { animar, pasos } from "../comun";

const TOTAL = 283;
const COLS = 23;
const FACTORES = [
  { icono: "🌧️", nombre: "Precipitación", f: 0.81 },
  { icono: "💨", nombre: "Viento fuerte", f: 0.61 },
  { icono: "🌱", nombre: "Recolonización vegetal", f: 0.71 },
  { icono: "🌡️", nombre: "Estrés térmico", f: 0.95 },
];
const REAL = 94;
const EFECTIVA = 24;

// Tras cada factor (redondeando como en el cálculo original): 229, 140, 99, 94.
const ETAPAS = FACTORES.reduce<number[]>((acc, x) => [...acc, Math.round((acc.at(-1) ?? TOTAL) * x.f)], []);

export function embudo() {
  const cont = document.getElementById("embudo");
  const pasosEl = document.querySelector('[data-pasos="embudo"]');
  if (!cont || !pasosEl) return;

  // Orden aleatorio estable en que «desaparecen» los puntos.
  const rango = Array.from({ length: TOTAL }, (_, i) => ({ i, r: (Math.sin(i * 12.9898) * 43758.5453) % 1 }))
    .sort((a, b) => a.r - b.r)
    .reduce<number[]>((acc, o, k) => ((acc[o.i] = k), acc), []);
  const filas = Math.ceil(TOTAL / COLS);
  const c = 24;
  cont.innerHTML = `
    <svg viewBox="0 0 ${COLS * c} ${filas * c}" role="img" aria-label="Cada punto es una persona">
      ${rango.map((r, i) => `<circle data-r="${r}" cx="${(i % COLS) * c + c / 2}" cy="${Math.floor(i / COLS) * c + c / 2}" r="8" />`).join("")}
    </svg>
    <div aria-live="polite"><div class="embudo__cifra" data-cifra>283</div><p class="embudo__etiqueta" data-etiqueta>personas · capacidad de carga física</p></div>`;
  const puntos = [...cont.querySelectorAll<SVGCircleElement>("circle")];
  const cifra = cont.querySelector<HTMLElement>("[data-cifra]")!;
  const etiqueta = cont.querySelector<HTMLElement>("[data-etiqueta]")!;

  const lista = pasosEl.querySelector("[data-factores]");
  if (lista)
    lista.innerHTML = FACTORES.map((x, k) => `<li data-factor="${k}"><span aria-hidden="true">${x.icono}</span><span>${x.nombre}</span><b>−${Math.round((1 - x.f) * 100)} %</b></li>`).join("");

  let mostrado = TOTAL;
  let cancelar = () => {};
  const pintar = (vivos: number, extra = 0) => {
    puntos.forEach((p) => {
      const r = Number(p.dataset.r);
      const color = r < vivos ? "var(--azul)" : r < vivos + extra ? "var(--exito)" : "var(--linea)";
      p.style.fill = color;
      p.style.transition = `fill .5s ${(r % 40) * 10}ms`;
    });
  };
  const contar = (hasta: number, texto: string, clase = "") => {
    const desde = mostrado;
    cancelar();
    etiqueta.textContent = texto;
    cifra.className = `embudo__cifra ${clase}`;
    cancelar = animar(700, (t) => {
      mostrado = Math.round(desde + (hasta - desde) * t);
      cifra.textContent = String(mostrado);
    });
  };

  let temporizadores: number[] = [];
  const limpiar = () => {
    temporizadores.forEach(clearTimeout);
    temporizadores = [];
    lista?.querySelectorAll("li").forEach((li) => li.classList.remove("activo"));
  };

  const deslizador = pasosEl.querySelector<HTMLInputElement>("[data-gestion]");
  const valor = pasosEl.querySelector<HTMLElement>("[data-gestion-valor]");
  const simular = () => {
    const pct = Number(deslizador?.value ?? 25);
    if (valor) valor.textContent = `${pct} %`;
    const n = Math.round((REAL * pct) / 100);
    pintar(EFECTIVA, n - EFECTIVA);
    contar(n, pct === 25 ? "personas a la vez con los servicios actuales" : `personas a la vez si los servicios cubrieran el ${pct} %`, pct === 25 ? "embudo__cifra--efectiva" : "embudo__cifra--simulada");
  };
  deslizador?.addEventListener("input", simular);

  pasos(pasosEl, (i) => {
    limpiar();
    if (i === 0) {
      pintar(TOTAL);
      contar(TOTAL, "personas · capacidad de carga física");
    } else if (i === 1) {
      // Cada factor se come su parte, uno detrás de otro.
      ETAPAS.forEach((n, k) =>
        temporizadores.push(
          window.setTimeout(() => {
            lista?.querySelectorAll("li").forEach((li, j) => li.classList.toggle("activo", j === k));
            pintar(n);
            contar(n, k === ETAPAS.length - 1 ? "personas · capacidad de carga real" : FACTORES[k].nombre.toLowerCase());
          }, k * 900),
        ),
      );
    } else if (i === 2) {
      pintar(EFECTIVA);
      contar(EFECTIVA, "personas a la vez · capacidad de carga efectiva", "embudo__cifra--efectiva");
    } else simular();
  });
}
