// Gráficos del panel (SVG propio con D3). Todos se dibujan al ancho real del contenedor y se
// redibujan si cambia; el color nunca va solo: cada valor lleva su cifra o su etiqueta.
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { scaleBand, scaleLinear } from "d3-scale";
import { arc, pie } from "d3-shape";

export type Cat = { etiqueta: string; n: number; color: string; icono?: string };
export type Grupo = { grupo: string; cats: Cat[] };

export const pct = (n: number, total: number) => (total ? (100 * n) / total : 0);
export const fmtPct = (n: number, total: number) => `${Math.round(pct(n, total))} %`;
const total = (cs: Cat[]) => cs.reduce((a, c) => a + c.n, 0);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Texto blanco u oscuro según el fondo.
const claro = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
};

// Degradado de la identidad: el tono más oscuro para la categoría con más respuestas.
export const degradado = (k: number, n: number, desde = "#0026b3", hasta = "#c7d2fe") => {
  const a = parseInt(desde.slice(1), 16), b = parseInt(hasta.slice(1), 16);
  const t = n <= 1 ? 0 : k / (n - 1);
  const c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

// Redibuja al cambiar el ancho.
function responsivo(el: HTMLElement, dibujar: (w: number) => void) {
  let ancho = 0;
  const pintar = () => {
    const w = el.clientWidth;
    if (w && w !== ancho) {
      ancho = w;
      dibujar(w);
    }
  };
  new ResizeObserver(pintar).observe(el);
  pintar();
}

// Ficha flotante al pasar el cursor (o tocar) por un elemento con data-info.
function fichas(el: HTMLElement) {
  if (!el.querySelector(".tooltip")) el.insertAdjacentHTML("beforeend", `<div class="tooltip"></div>`);
  if (el.dataset.fichas) return; // los eventos, una sola vez
  el.dataset.fichas = "1";
  el.addEventListener("pointermove", (e) => {
    const tip = el.querySelector<HTMLElement>(".tooltip");
    const t = (e.target as Element).closest("[data-info]");
    if (!tip) return;
    if (!t) return void (tip.style.opacity = "0");
    const r = el.getBoundingClientRect();
    tip.textContent = t.getAttribute("data-info");
    tip.style.left = `${e.clientX - r.left}px`;
    tip.style.top = `${e.clientY - r.top}px`;
    tip.style.opacity = "1";
  });
  el.addEventListener("pointerleave", () => {
    const tip = el.querySelector<HTMLElement>(".tooltip");
    if (tip) tip.style.opacity = "0";
  });
}

// Recorta una etiqueta a lo que cabe en `ancho` px (≈ 6,9 px por carácter a 13–14 px).
// Cuenta caracteres visibles: un emoji de familia (👨‍👩‍👦) son varios caracteres internos pero un solo dibujo.
const grafemas = (t: string) => [...new Intl.Segmenter("es", { granularity: "grapheme" }).segment(t)].map((x) => x.segment);
const cabe = (t: string, ancho: number) => {
  const max = Math.max(4, Math.floor(ancho / 6.9));
  const g = grafemas(t);
  return esc(g.length > max ? `${g.slice(0, max - 1).join("").trimEnd()}…` : t);
};

// Parte una etiqueta en dos líneas si no cabe en su columna.
const dosLineas = (t: string, ancho: number, cx: number) => {
  if (t.length * 6.6 <= ancho + 16 || !t.includes(" ")) return esc(t);
  const palabras = t.split(" ");
  let mejor = 1;
  palabras.forEach((_, i) => {
    const a = palabras.slice(0, i).join(" ").length, b = palabras.slice(i).join(" ").length;
    if (i && Math.abs(a - b) < Math.abs(palabras.slice(0, mejor).join(" ").length - palabras.slice(mejor).join(" ").length)) mejor = i;
  });
  return `<tspan x="${cx}">${esc(palabras.slice(0, mejor).join(" "))}</tspan><tspan x="${cx}" dy="15">${esc(palabras.slice(mejor).join(" "))}</tspan>`;
};

const lienzo = (el: HTMLElement, w: number, h: number, cuerpo: string, etiqueta: string) => {
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(etiqueta)}">${cuerpo}</svg>`;
  fichas(el);
};

// --- Barras horizontales (o verticales si caben) -------------------------------------------
export function barras(el: HTMLElement, cats: Cat[], o: { titulo: string; vertical?: boolean; sinPct?: boolean }) {
  const T = total(cats);
  responsivo(el, (w) => {
    const max = Math.max(...cats.map((c) => c.n), 1);
    const valor = (c: Cat) => (o.sinPct ? `${c.n}` : `${fmtPct(c.n, T)}`);
    if (o.vertical && w >= 640) {
      const H = 300, m = { t: 26, b: 92, l: 8, r: 8 };
      const x = scaleBand(cats.map((c) => c.etiqueta), [m.l, w - m.r]).padding(0.22);
      const y = scaleLinear([0, max], [H - m.b, m.t]);
      const cuerpo = cats
        .map((c) => {
          const cx = x(c.etiqueta)! + x.bandwidth() / 2;
          return `<g data-info="${esc(c.etiqueta)}: ${c.n} (${fmtPct(c.n, T)})">
            <rect x="${x(c.etiqueta)}" y="${y(c.n)}" width="${x.bandwidth()}" height="${y(0) - y(c.n)}" rx="4" fill="${c.color}"/>
            <text x="${cx}" y="${y(c.n) - 7}" text-anchor="middle" font-size="13" font-weight="650" fill="var(--tinta)">${o.sinPct ? c.n : fmtPct(c.n, T)}</text>
            <text x="${cx}" y="${H - m.b + 14}" text-anchor="end" font-size="12.5" fill="var(--gris)" transform="rotate(-40 ${cx} ${H - m.b + 14})">${esc(c.etiqueta)}</text></g>`;
        })
        .join("");
      return lienzo(el, w, H, cuerpo, o.titulo);
    }
    const fila = 34, etq = Math.min(210, w * 0.42), valW = 56;
    const x = scaleLinear([0, max], [0, w - etq - valW - 12]);
    const cuerpo = cats
      .map((c, i) => {
        const y = i * fila;
        return `<g data-info="${esc(c.etiqueta)}: ${c.n} respuestas (${fmtPct(c.n, T)})">
          <text x="${etq - 10}" y="${y + 21}" text-anchor="end" font-size="14" fill="var(--tinta)">${cabe(c.icono ? `${c.icono} ${c.etiqueta}` : c.etiqueta, etq - 14)}</text>
          <rect x="${etq}" y="${y + 7}" width="${Math.max(2, x(c.n))}" height="${fila - 14}" rx="5" fill="${c.color}"/>
          <text x="${etq + Math.max(2, x(c.n)) + 8}" y="${y + 21}" font-size="14" font-weight="650" fill="var(--tinta)">${valor(c)}</text></g>`;
      })
      .join("");
    lienzo(el, w, cats.length * fila, cuerpo, o.titulo);
  });
}

// --- Anillo con la cifra principal en el centro ---------------------------------------------
export function anillo(el: HTMLElement, cats: Cat[], o: { titulo: string; centro: Cat; centroTexto?: string }) {
  const T = total(cats);
  responsivo(el, (w) => {
    const r = Math.min(110, w / 4.2), cx = r + 6, H = 2 * r + 12;
    const arcos = pie<Cat>().value((c) => c.n).sort(null).padAngle(0.012)(cats);
    const a = arc<(typeof arcos)[number]>().innerRadius(r * 0.64).outerRadius(r).cornerRadius(3);
    const sectores = arcos.map((s) => `<path d="${a(s)}" fill="${s.data.color}" transform="translate(${cx},${r + 6})" data-info="${esc(s.data.etiqueta)}: ${s.data.n} (${fmtPct(s.data.n, T)})"/>`).join("");
    const centro = `<text x="${cx}" y="${r + 10}" text-anchor="middle" font-size="${r * 0.36}" font-weight="780" fill="${o.centro.color}" letter-spacing="-1">${fmtPct(o.centro.n, T)}</text>
      <text x="${cx}" y="${r + 10 + r * 0.24}" text-anchor="middle" font-size="${r < 90 ? 11.5 : 13}" fill="var(--gris)">${dosLineas(o.centroTexto ?? o.centro.etiqueta.toLowerCase(), r * 0.9, cx)}</text>`;
    const lx = 2 * r + 36;
    const leyenda = cats
      .map((c, i) => `<g data-info="${esc(c.etiqueta)}: ${c.n}"><rect x="${lx}" y="${r - cats.length * 15 + i * 30}" width="14" height="14" rx="4" fill="${c.color}"/>
        <text x="${lx + 22}" y="${r - cats.length * 15 + i * 30 + 12}" font-size="14" fill="var(--tinta)">${esc(c.etiqueta)} <tspan font-weight="700">${fmtPct(c.n, T)}</tspan> <tspan fill="var(--gris)">(${c.n})</tspan></text></g>`)
      .join("");
    lienzo(el, w, H, sectores + centro + leyenda, o.titulo);
  });
}

// --- Barras apiladas al 100 % (verticales en pantalla ancha, horizontales en el móvil) -------
export function apiladas(el: HTMLElement, grupos: Grupo[], o: { titulo: string; horizontal?: boolean; leyenda: Cat[] }) {
  responsivo(el, (w) => {
    const horizontal = o.horizontal || w < 640;
    const etiquetaSeg = (c: Cat, t: number, tam: number) => (pct(c.n, t) >= 9 && tam > 24 ? `${Math.round(pct(c.n, t))} %` : "");
    let cuerpo = "", H = 0;
    if (horizontal) {
      const fila = 46, etq = Math.min(190, w * 0.36);
      const x = scaleLinear([0, 100], [etq, w - 4]);
      cuerpo = grupos
        .map((g, i) => {
          const t = total(g.cats);
          let acc = 0;
          const y = i * fila;
          return `<text x="${etq - 10}" y="${y + 20}" text-anchor="end" font-size="13.5" fill="var(--tinta)">${cabe(g.grupo, etq - 14)}</text>
            <text x="${etq - 10}" y="${y + 36}" text-anchor="end" font-size="11.5" fill="var(--gris)">n = ${t}</text>` +
            g.cats
              .map((c) => {
                const x0 = x(acc), ancho = x(acc + pct(c.n, t)) - x0;
                acc += pct(c.n, t);
                return `<g data-info="${esc(g.grupo)} · ${esc(c.etiqueta)}: ${c.n} (${fmtPct(c.n, t)})"><rect x="${x0}" y="${y + 6}" width="${Math.max(0, ancho - 1.5)}" height="${fila - 14}" fill="${c.color}"/>
                  <text x="${x0 + ancho / 2}" y="${y + fila / 2 + 3}" text-anchor="middle" font-size="12" font-weight="650" fill="${claro(c.color) ? "#111827" : "#fff"}">${etiquetaSeg(c, t, ancho)}</text></g>`;
              })
              .join("");
        })
        .join("");
      H = grupos.length * fila;
    } else {
      H = 356;
      const m = { t: 8, b: 72, l: 8, r: 8 };
      const x = scaleBand(grupos.map((g) => g.grupo), [m.l, w - m.r]).padding(0.25);
      const y = scaleLinear([0, 100], [H - m.b, m.t]);
      cuerpo = grupos
        .map((g) => {
          const t = total(g.cats);
          let acc = 0;
          const cx = x(g.grupo)! + x.bandwidth() / 2;
          return (
            g.cats
              .map((c) => {
                const y1 = y(acc), y0 = y(acc + pct(c.n, t));
                acc += pct(c.n, t);
                return `<g data-info="${esc(g.grupo)} · ${esc(c.etiqueta)}: ${c.n} (${fmtPct(c.n, t)})"><rect x="${x(g.grupo)}" y="${y0}" width="${x.bandwidth()}" height="${Math.max(0, y1 - y0 - 1.5)}" fill="${c.color}"/>
                  <text x="${cx}" y="${(y0 + y1) / 2 + 4}" text-anchor="middle" font-size="12" font-weight="650" fill="${claro(c.color) ? "#111827" : "#fff"}">${etiquetaSeg(c, t, y1 - y0)}</text></g>`;
              })
              .join("") +
            `<text x="${cx}" y="${H - m.b + 20}" text-anchor="middle" font-size="13" fill="var(--tinta)">${dosLineas(g.grupo, x.bandwidth(), cx)}</text>
             <text x="${cx}" y="${H - m.b + (g.grupo.length * 6.6 > x.bandwidth() + 16 ? 52 : 37)}" text-anchor="middle" font-size="11.5" fill="var(--gris)">n = ${t}</text>`
          );
        })
        .join("");
    }
    lienzo(el, w, H, cuerpo, o.titulo);
    leyendaDe(el, o.leyenda);
  });
}

export function leyendaDe(el: HTMLElement, cats: Cat[]) {
  const ul = document.createElement("ul");
  ul.className = "leyenda leyenda--fija";
  ul.innerHTML = cats.map((c) => `<li><span class="muestra" style="--c:${c.color}"></span>${esc(c.etiqueta)}</li>`).join("");
  el.append(ul);
}

// --- Mosaico: cada caja, proporcional a sus respuestas, con su icono -------------------------
export function mosaico(el: HTMLElement, cats: Cat[], o: { titulo: string }) {
  const T = total(cats);
  responsivo(el, (w) => {
    const H = w < 640 ? 420 : 380;
    const raiz = hierarchy<{ hijos?: Cat[] } & Partial<Cat>>({ hijos: cats }, (d) => d.hijos).sum((d) => d.n ?? 0);
    const hojas = treemap<{ hijos?: Cat[] } & Partial<Cat>>().size([w, H]).paddingInner(3).tile(treemapSquarify.ratio(1.2))(raiz).leaves();
    const cuerpo = hojas
      .map((h) => {
        const c = h.data as Cat, bw = h.x1 - h.x0, bh = h.y1 - h.y0;
        const tinta = claro(c.color) ? "#111827" : "#fff";
        const grande = bw > 120 && bh > 70, medio = bw > 54 && bh > 40;
        const tamIcono = Math.min(44, Math.max(16, Math.min(bw, bh) * 0.32));
        return `<g data-info="${esc(c.etiqueta)}: ${c.n} (${fmtPct(c.n, T)})">
          <rect x="${h.x0}" y="${h.y0}" width="${bw}" height="${bh}" rx="8" fill="${c.color}"/>
          ${medio ? `<text x="${h.x0 + 10}" y="${h.y0 + tamIcono + 6}" font-size="${tamIcono}">${c.icono ?? ""}</text>` : ""}
          ${grande ? `<text x="${h.x0 + 10}" y="${h.y1 - 30}" font-size="14" font-weight="650" fill="${tinta}">${esc(c.etiqueta.length * 7.5 > bw - 16 ? c.etiqueta.slice(0, Math.floor((bw - 16) / 7.5)) + "…" : c.etiqueta)}</text>` : ""}
          ${medio ? `<text x="${h.x0 + 10}" y="${h.y1 - 10}" font-size="${grande ? 22 : 13}" font-weight="780" fill="${tinta}">${fmtPct(c.n, T)}</text>` : ""}</g>`;
      })
      .join("");
    lienzo(el, w, H, cuerpo, o.titulo);
    leyendaDe(el, cats.map((c) => ({ ...c, etiqueta: `${c.icono ?? ""} ${c.etiqueta} · ${fmtPct(c.n, T)}` })));
  });
}
