// Gráficos de conteos (modelo FOTO6 de Adrián): entradas y salidas por hora en cada día de conteo,
// y su balance (quienes siguen dentro).
// Días tranquilos de verde claro a azul oscuro y días de mucha gente de rosa claro a rojo
// intenso, siempre ordenados por afluencia. Los dos picos de entrada van destacados.
// Y el área de reposo frente a su capacidad (modelo FOTO7).
import { max } from "d3-array";
import { scaleBand, scaleLinear, scalePoint, type ScaleLinear } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import { cargar } from "../comun";

type Franja = { franja: string; entradas: number | null; salidas: number | null; reposo: number | null; surf: number | null };
type Dia = { periodo: string; tipo_dia: "Valle" | "Pico"; total_entradas: number; franjas: Franja[] };

const VALLE = ["#b7e4b0", "#8fd3a8", "#5fc0a8", "#36a8b4", "#2489bd", "#2166ac", "#1f4e9a", "#1a2f7a"];
const PICO = ["#f9c4d2", "#f59cb5", "#ef6f96", "#e3477a", "#cc2a5c", "#b0153f", "#8e0a2c", "#67001f"];
const ORDEN_MESES = ["Diciembre/Enero", "Marzo", "Abril", "Mayo", "Julio", "Agosto", "Septiembre", "Octubre"];
// Picos de cada gráfico: las entradas a media mañana y a primera hora de la tarde; las salidas,
// justo después por la mañana y más tarde por la tarde (usos efímeros frente a reposo).
const PICOS = { entradas: ["10:30–11:30", "15:30–16:30"], salidas: ["11:30–12:30", "17:30–18:30"] };
type Campo = keyof typeof PICOS;
type Tipo = "Valle" | "Pico" | "Todos";
const svg = (w: number, h: number, cuerpo: string, etiqueta: string) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${etiqueta}">${cuerpo}</svg>`;
const total = (d: Dia, campo: Campo) => d.franjas.reduce((a, f) => a + (f[campo] ?? 0), 0);
const incompleto = (d: Dia, campo: Campo) => d.franjas.some((f) => f[campo] === null);

// Eje X con los tramos completos (8:30–9:30 … 17:30–18:30); en el móvil, inclinados.
const ejeTramos = (franjas: string[], x: (f: string) => number, y0: number, estrecho: boolean) =>
  franjas
    .map((f) =>
      estrecho
        ? `<g class="eje"><text x="${x(f)}" y="${y0 + 12}" text-anchor="end" font-size="11" transform="rotate(-50 ${x(f)} ${y0 + 12})">${f}</text></g>`
        : `<g class="eje"><text x="${x(f)}" y="${y0 + 24}" text-anchor="middle" font-size="12.5">${f}</text></g>`,
    )
    .join("");
const margen = (estrecho: boolean) => ({ t: 36, r: 12, b: estrecho ? 92 : 48, l: 40 });
const rejillaY = (y: ScaleLinear<number, number>, m: { l: number; r: number }, W: number) =>
  y.ticks(6).map((v) => `<g class="eje"><line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text></g>`).join("");
// Selector «alta / baja / todos» de cada gráfico.
const conSelector = (selector: Element, alCambiar: (t: Tipo) => void) =>
  selector.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
    b.addEventListener("click", () => {
      selector.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      alCambiar(b.dataset.tipo as Tipo);
    }),
  );
const alRedimensionar = (el: HTMLElement, dibujar: () => void) => {
  let ancho = el.clientWidth;
  new ResizeObserver(() => el.clientWidth !== ancho && ((ancho = el.clientWidth), dibujar())).observe(el);
};

export async function conteos() {
  const dias = await cargar<Dia[]>("conteos.json");
  // Color según la afluencia del día, dentro de su tipo (el mismo en entradas y salidas).
  const color = new Map<Dia, string>();
  (["Valle", "Pico"] as const).forEach((tipo) =>
    dias
      .filter((d) => d.tipo_dia === tipo)
      .sort((a, b) => a.total_entradas - b.total_entradas)
      .forEach((d, k) => color.set(d, (tipo === "Valle" ? VALLE : PICO)[k])),
  );
  graficoHoras(dias, color, "entradas");
  graficoHoras(dias, color, "salidas");
  graficoBalance(dias);
  graficoReposo(dias);
}

// Una línea por día de conteo: personas que entran (o salen) en cada tramo de una hora.
function graficoHoras(dias: Dia[], color: Map<Dia, string>, campo: Campo) {
  const lienzo = document.getElementById(`grafico-${campo}`);
  const leyenda = document.getElementById(`leyenda-${campo}`);
  const selector = document.querySelector(`[data-selector-${campo}]`);
  if (!lienzo || !leyenda || !selector) return;
  const franjas = dias[0].franjas.map((f) => f.franja);
  const yMax = Math.ceil((max(dias, (d) => max(d.franjas, (f) => f[campo] ?? 0)) ?? 160) / 20) * 20;
  const verbo = campo === "entradas" ? "entran" : "salen";

  let tipo: Tipo = "Pico";
  let destacado: Dia | null = null;

  const dibujar = () => {
    // Se dibuja al ancho real: en el móvil el texto se lee igual de grande que en el ordenador.
    const W = Math.max(320, lienzo.clientWidth || 1000), estrecho = W < 640;
    const m = margen(estrecho), H = estrecho ? 404 : 480;
    const x = scalePoint(franjas, [m.l, W - m.r]).padding(0.3);
    const y = scaleLinear([0, yMax], [H - m.b, m.t]);
    const linea = line<Franja>().defined((f) => f[campo] !== null).x((f) => x(f.franja)!).y((f) => y(f[campo]!)).curve(curveMonotoneX);
    const paso = x.step();
    const visibles = dias.filter((d) => tipo === "Todos" || d.tipo_dia === tipo).sort((a, b) => a.total_entradas - b.total_entradas);
    const bandas = PICOS[campo].map((p, k) => {
      const cx = x(p)!;
      // El último tramo toca el borde: su rótulo se alinea a la derecha para no cortarse.
      const borde = cx + paso / 2 > W - m.r - 4;
      return `<rect x="${cx - paso / 2}" y="${m.t - 8}" width="${Math.min(paso, W - m.r - (cx - paso / 2))}" height="${H - m.b - m.t + 8}" fill="var(--azul-suave)" rx="8"/>
        <text class="etiqueta-pico" x="${borde ? W - m.r : cx}" y="${m.t - 16}" text-anchor="${borde ? "end" : "middle"}">${estrecho ? "Pico" : `Pico ${k === 0 ? "de la mañana" : "de la tarde"}`}</text>`;
    }).join("");
    const lineas = visibles
      .map((d) => {
        const atenuar = destacado && destacado !== d;
        return `<path d="${linea(d.franjas)}" fill="none" stroke="${color.get(d)}" stroke-width="${destacado === d ? 4.5 : 2.5}" stroke-linecap="round" opacity="${atenuar ? 0.15 : 1}" style="transition:opacity .3s"/>`;
      })
      .join("");
    lienzo.innerHTML = svg(W, H, bandas + rejillaY(y, m, W) + ejeTramos(franjas, (f) => x(f)!, H - m.b, estrecho) + lineas, `Gráfico de líneas: personas que ${verbo} del Confital por hora en cada día de conteo`);

    const orden = visibles.slice().sort((a, b) => ORDEN_MESES.indexOf(a.periodo) - ORDEN_MESES.indexOf(b.periodo) || a.tipo_dia.localeCompare(b.tipo_dia));
    leyenda.innerHTML = orden
      .map((d, k) => `<li><button type="button" aria-pressed="${destacado === d}" data-k="${k}"><span class="muestra" style="--c:${color.get(d)}"></span>${d.periodo}${tipo === "Todos" ? (d.tipo_dia === "Pico" ? " · alta afluencia" : " · baja afluencia") : ""} · ${total(d, campo).toLocaleString("es-ES")}${incompleto(d, campo) ? "*" : ""}</button></li>`)
      .join("");
    leyenda.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
      b.addEventListener("click", () => {
        const d = orden[Number(b.dataset.k)];
        destacado = destacado === d ? null : d;
        dibujar();
      }),
    );
  };

  conSelector(selector, (t) => {
    tipo = t;
    destacado = null;
    dibujar();
  });
  dibujar();
  alRedimensionar(lienzo, dibujar);
}

// Entradas frente a salidas en un día medio y el balance acumulado (quienes siguen dentro).
// Solo días con las salidas completas: al de baja afluencia de diciembre/enero le faltan las de la mañana.
function graficoBalance(dias: Dia[]) {
  const lienzo = document.getElementById("grafico-balance");
  const resumen = document.querySelector("[data-balance-resumen]");
  const selector = document.querySelector("[data-selector-balance]");
  if (!lienzo || !selector) return;
  const franjas = dias[0].franjas.map((f) => f.franja);
  let tipo: Tipo = "Todos";

  const dibujar = () => {
    const usados = dias.filter((d) => (tipo === "Todos" || d.tipo_dia === tipo) && !incompleto(d, "salidas"));
    const media = (campo: Campo, i: number) => usados.reduce((a, d) => a + (d.franjas[i][campo] ?? 0), 0) / usados.length;
    const filas = franjas.map((f, i) => ({ f, e: media("entradas", i), s: media("salidas", i) }));
    let acumulado = 0;
    const dentro = filas.map((r) => (acumulado += r.e - r.s));
    const W = Math.max(320, lienzo.clientWidth || 1000), estrecho = W < 640;
    const m = margen(estrecho), H = estrecho ? 404 : 440;
    const x = scaleBand(franjas, [m.l, W - m.r]).padding(0.22);
    const sub = scaleBand(["e", "s"], [0, x.bandwidth()]).padding(0.08);
    const yMax = Math.ceil(Math.max(...filas.map((r) => Math.max(r.e, r.s)), ...dentro) / 50) * 50;
    const y = scaleLinear([0, yMax], [H - m.b, m.t]);
    const centro = (f: string) => x(f)! + x.bandwidth() / 2;
    const barras = filas
      .map((r) => {
        const barra = (k: "e" | "s", v: number, c: string, nombre: string) =>
          `<rect x="${x(r.f)! + sub(k)!}" y="${y(v)}" width="${sub.bandwidth()}" height="${y(0) - y(v)}" rx="3" fill="${c}"><title>${r.f} · ${nombre}: ${Math.round(v)} personas (media)</title></rect>`;
        return barra("e", r.e, "var(--azul)", "entran") + barra("s", r.s, "var(--naranja)", "salen");
      })
      .join("");
    const curva = line<number>().x((_, i) => centro(franjas[i])).y((v) => y(v)).curve(curveMonotoneX);
    const puntos = dentro.map((v, i) => `<circle cx="${centro(franjas[i])}" cy="${y(v)}" r="3.5" fill="var(--tinta)"><title>${franjas[i]} · siguen dentro: ${Math.round(v)}</title></circle>`).join("");
    const final = dentro.at(-1)!;
    lienzo.innerHTML = svg(
      W, H,
      rejillaY(y, m, W) + barras + `<path d="${curva(dentro)}" fill="none" stroke="var(--tinta)" stroke-width="2.5" stroke-dasharray="6 4"/>` + puntos +
        ejeTramos(franjas, centro, H - m.b, estrecho) +
        `<text x="${centro(franjas.at(-1)!)}" y="${y(final) - 12}" text-anchor="end" font-size="13" font-weight="650" fill="var(--tinta)">${Math.round(final)} siguen dentro</text>`,
      "Gráfico de barras: media de personas que entran y salen en cada tramo horario, con el balance acumulado de quienes siguen dentro",
    );
    if (resumen) {
      const e = filas.reduce((a, r) => a + r.e, 0), s = filas.reduce((a, r) => a + r.s, 0);
      const cual = tipo === "Pico" ? " de alta afluencia" : tipo === "Valle" ? " de baja afluencia" : "";
      resumen.innerHTML = `En un día medio${cual} entran <strong>${Math.round(e).toLocaleString("es-ES")}</strong> personas y salen <strong>${Math.round(s).toLocaleString("es-ES")}</strong> por la entrada principal. A las 18:30 siguen dentro unas <strong>${Math.round(final).toLocaleString("es-ES")}</strong>, o se fueron por otros caminos.`;
    }
  };
  conSelector(selector, (t) => {
    tipo = t;
    dibujar();
  });
  dibujar();
  alRedimensionar(lienzo, dibujar);
}

function graficoReposo(dias: Dia[]) {
  const lienzo = document.getElementById("grafico-reposo");
  if (!lienzo) return;
  const LIMITE = 83; // capacidad efectiva: plataforma de madera (11) + depósitos hialoclastíticos (72)
  const W = Math.max(320, lienzo.clientWidth || 1000), estrecho = W < 640;
  const H = estrecho ? 360 : 440, m = { t: 30, r: 12, b: estrecho ? 64 : 48, l: 40 };
  const corto = (mes: string) => (mes === "Diciembre/Enero" ? "Dic–Ene" : mes.slice(0, 3));
  const maxDia = (d: Dia) => max(d.franjas, (f) => f.reposo ?? 0) ?? 0;
  const x = scaleBand(ORDEN_MESES, [m.l, W - m.r]).padding(0.28);
  const sub = scaleBand(["Valle", "Pico"], [0, x.bandwidth()]).padding(0.12);
  const y = scaleLinear([0, 160], [H - m.b, m.t]);
  const rejilla = y.ticks(8).map((v) => `<g class="eje"><line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text></g>`).join("");
  const barras = dias
    .map((d) => {
      const v = maxDia(d);
      const bx = x(d.periodo)! + sub(d.tipo_dia)!;
      const supera = v > LIMITE;
      const c = d.tipo_dia === "Pico" ? "var(--pico)" : "var(--valle)";
      return `<rect x="${bx}" y="${y(v)}" width="${sub.bandwidth()}" height="${y(0) - y(v)}" rx="5" fill="${c}" opacity="${supera ? 1 : 0.55}"><title>${d.periodo} · ${d.tipo_dia === "Pico" ? "día de alta afluencia" : "día de baja afluencia"}: ${v} personas</title></rect>
        ${supera ? `<text x="${bx + sub.bandwidth() / 2}" y="${y(v) - 8}" text-anchor="middle" font-size="${estrecho ? 12 : 15}" font-weight="700" fill="var(--pico)">${v}</text>` : ""}`;
    })
    .join("");
  const ejeX = ORDEN_MESES.map((p) => {
    const cx = x(p)! + x.bandwidth() / 2;
    return estrecho
      ? `<g class="eje"><text x="${cx}" y="${H - m.b + 14}" text-anchor="end" transform="rotate(-40 ${cx} ${H - m.b + 14})">${corto(p)}</text></g>`
      : `<g class="eje"><text x="${cx}" y="${H - m.b + 24}" text-anchor="middle">${p}</text></g>`;
  }).join("");
  const limite = `<line x1="${m.l}" x2="${W - m.r}" y1="${y(LIMITE)}" y2="${y(LIMITE)}" stroke="var(--tinta)" stroke-width="2.5" stroke-dasharray="8 6"/>
    ${estrecho ? "" : `<text x="${m.l + 6}" y="${y(LIMITE) - 10}" text-anchor="start" font-size="${estrecho ? 12 : 14}" font-weight="650" fill="var(--tinta)">Capacidad: 83 personas a la vez</text>`}`;
  lienzo.innerHTML = svg(W, H, rejilla + barras + ejeX + limite, "Gráfico de barras: máximo de personas a la vez en el área de reposo en cada día de conteo, frente a su capacidad de 83");
  if (!lienzo.dataset.observado) {
    lienzo.dataset.observado = "1";
    let ancho = lienzo.clientWidth;
    new ResizeObserver(() => lienzo.clientWidth !== ancho && ((ancho = lienzo.clientWidth), graficoReposo(dias))).observe(lienzo);
  }
}
