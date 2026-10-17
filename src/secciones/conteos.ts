// Gráfico de conteos (modelo FOTO6 de Adrián): entradas por hora en cada día de conteo.
// Días tranquilos de verde claro a azul oscuro y días de mucha gente de rosa claro a rojo
// intenso, siempre ordenados por afluencia. Los dos picos de entrada van destacados.
// Y el área de reposo frente a su capacidad (modelo FOTO7).
import { max } from "d3-array";
import { scaleBand, scaleLinear, scalePoint } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";
import { cargar } from "../comun";

type Franja = { franja: string; entradas: number | null; salidas: number | null; reposo: number | null; surf: number | null };
type Dia = { periodo: string; tipo_dia: "Valle" | "Pico"; total_entradas: number; franjas: Franja[] };

const VALLE = ["#b7e4b0", "#8fd3a8", "#5fc0a8", "#36a8b4", "#2489bd", "#2166ac", "#1f4e9a", "#1a2f7a"];
const PICO = ["#f9c4d2", "#f59cb5", "#ef6f96", "#e3477a", "#cc2a5c", "#b0153f", "#8e0a2c", "#67001f"];
const ORDEN_MESES = ["Diciembre/Enero", "Marzo", "Abril", "Mayo", "Julio", "Agosto", "Septiembre", "Octubre"];
const PICOS = ["10:30–11:30", "15:30–16:30"];
const inicio = (f: string) => f.split("–")[0];
const svg = (w: number, h: number, cuerpo: string, etiqueta: string) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${etiqueta}">${cuerpo}</svg>`;

export async function conteos() {
  const dias = await cargar<Dia[]>("conteos.json");
  // Color según la afluencia del día, dentro de su tipo.
  const color = new Map<Dia, string>();
  (["Valle", "Pico"] as const).forEach((tipo) =>
    dias
      .filter((d) => d.tipo_dia === tipo)
      .sort((a, b) => a.total_entradas - b.total_entradas)
      .forEach((d, k) => color.set(d, (tipo === "Valle" ? VALLE : PICO)[k])),
  );
  graficoEntradas(dias, color);
  graficoReposo(dias);
}

function graficoEntradas(dias: Dia[], color: Map<Dia, string>) {
  const lienzo = document.getElementById("grafico-conteos");
  const leyenda = document.getElementById("leyenda-conteos");
  const selector = document.querySelector("[data-selector-conteos]");
  if (!lienzo || !leyenda || !selector) return;
  const franjas = dias[0].franjas.map((f) => f.franja);
  const yMax = Math.ceil((max(dias, (d) => max(d.franjas, (f) => f.entradas ?? 0)) ?? 160) / 20) * 20;

  let tipo: "Valle" | "Pico" | "Todos" = "Pico";
  let destacado: Dia | null = null;

  const dibujar = () => {
    // Se dibuja al ancho real: en el móvil el texto se lee igual de grande que en el ordenador.
    const W = Math.max(320, lienzo.clientWidth || 1000), estrecho = W < 640;
    const H = estrecho ? 360 : 480, m = { t: 36, r: 12, b: 48, l: 40 };
    const x = scalePoint(franjas, [m.l, W - m.r]).padding(0.3);
    const y = scaleLinear([0, yMax], [H - m.b, m.t]);
    const linea = line<Franja>().defined((f) => f.entradas !== null).x((f) => x(f.franja)!).y((f) => y(f.entradas!)).curve(curveMonotoneX);
    const paso = x.step();
    const visibles = dias.filter((d) => tipo === "Todos" || d.tipo_dia === tipo).sort((a, b) => a.total_entradas - b.total_entradas);
    const bandas = PICOS.map((p) => {
      const cx = x(p)!;
      return `<rect x="${cx - paso / 2}" y="${m.t - 8}" width="${paso}" height="${H - m.b - m.t + 8}" fill="var(--azul-suave)" rx="8"/>
        <text class="etiqueta-pico" x="${cx}" y="${m.t - 16}" text-anchor="middle">${estrecho ? "Pico" : `Pico ${p === PICOS[0] ? "de la mañana" : "de la tarde"}`}</text>`;
    }).join("");
    const rejilla = y.ticks(6).map((v) => `<g class="eje"><line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text></g>`).join("");
    const ejeX = franjas.map((f, k) => (estrecho && k % 2 ? "" : `<g class="eje"><text x="${x(f)}" y="${H - m.b + 24}" text-anchor="middle">${inicio(f)}</text></g>`)).join("");
    const lineas = visibles
      .map((d) => {
        const atenuar = destacado && destacado !== d;
        return `<path d="${linea(d.franjas)}" fill="none" stroke="${color.get(d)}" stroke-width="${destacado === d ? 4.5 : 2.5}" stroke-linecap="round" opacity="${atenuar ? 0.15 : 1}" style="transition:opacity .3s"/>`;
      })
      .join("");
    lienzo.innerHTML = svg(W, H, bandas + rejilla + ejeX + lineas + `<text x="${m.l}" y="${H - 2}" font-size="13" fill="var(--gris)">${estrecho ? "Hora · personas que entran" : "Hora de inicio de cada tramo de una hora · personas que entran"}</text>`, "Gráfico de líneas: personas que entran al Confital por hora en cada día de conteo");

    leyenda.innerHTML = visibles
      .slice()
      .sort((a, b) => ORDEN_MESES.indexOf(a.periodo) - ORDEN_MESES.indexOf(b.periodo) || a.tipo_dia.localeCompare(b.tipo_dia))
      .map((d, k) => `<li><button type="button" aria-pressed="${destacado === d}" data-k="${k}"><span class="muestra" style="--c:${color.get(d)}"></span>${d.periodo}${tipo === "Todos" ? (d.tipo_dia === "Pico" ? " · mucha gente" : " · tranquilo") : ""} · ${d.total_entradas.toLocaleString("es-ES")}</button></li>`)
      .join("");
    const ordenLeyenda = visibles.slice().sort((a, b) => ORDEN_MESES.indexOf(a.periodo) - ORDEN_MESES.indexOf(b.periodo) || a.tipo_dia.localeCompare(b.tipo_dia));
    leyenda.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
      b.addEventListener("click", () => {
        const d = ordenLeyenda[Number(b.dataset.k)];
        destacado = destacado === d ? null : d;
        dibujar();
      }),
    );
  };

  selector.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
    b.addEventListener("click", () => {
      tipo = b.dataset.tipo as typeof tipo;
      destacado = null;
      selector.querySelectorAll("button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      dibujar();
    }),
  );
  dibujar();
  let ancho = lienzo.clientWidth;
  new ResizeObserver(() => lienzo.clientWidth !== ancho && ((ancho = lienzo.clientWidth), dibujar())).observe(lienzo);
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
      return `<rect x="${bx}" y="${y(v)}" width="${sub.bandwidth()}" height="${y(0) - y(v)}" rx="5" fill="${c}" opacity="${supera ? 1 : 0.55}"><title>${d.periodo} · ${d.tipo_dia === "Pico" ? "día de mucha gente" : "día tranquilo"}: ${v} personas</title></rect>
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
