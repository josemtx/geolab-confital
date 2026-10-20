// Informe en PDF a la carta: quien lo pide elige los gráficos y el navegador lo imprime.
// Estructura pedida por Adrián: portada (logo, participantes, instituciones, mes y número de
// respuestas), una página con los hallazgos principales y, después, los gráficos.
// El informe mensual automático es este mismo, con todos los gráficos (?informe=completo).
import { BASE, cargar } from "../comun";
import type { Datos, Respuesta } from "../respuestas";
import { dibujarTarjetas, type Panel } from "./panel";

const RECOMENDADOS = ["de-donde-vienen", "barrios-de-las-palmas-de-gran-canaria", "como-llegan", "espacio-disponible", "como-de-comodos-estaban", "percepcion-unidades", "son-suficientes-los-servicios", "como-valoran-cada-servicio"];
const PARTICIPANTES = ["Adrián Cabrera Sánchez", "José Mataix Pérez", "Eric Joel Castaño Santana"];
const INSTITUCIONES = ["Universidad de Las Palmas de Gran Canaria", "Unidad Técnica de Ciudad de Mar", "Ayuntamiento de Las Palmas de Gran Canaria"];
const GUARDADO = "geolab-informe-seleccion";

const nombreMes = (mes: string | null) => {
  const [a, m] = (mes ?? new Date().toISOString().slice(0, 7)).split("-").map(Number);
  const texto = new Date(a, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Vista «Crear informe» del panel de datos.
export function vistaInforme(cont: HTMLElement, panel: Panel, rs: Respuesta[]) {
  let guardada: string[] | null = null;
  try {
    guardada = JSON.parse(localStorage.getItem(GUARDADO) ?? "null");
  } catch {
    /* sin almacenamiento: se usa la selección recomendada */
  }
  const elegidas = new Set(guardada ?? RECOMENDADOS);
  cont.innerHTML = `
    <div class="contenedor informe-creador">
      <p class="sobretitulo">Informe en PDF</p>
      <h3 class="titular titular--bloque">Crea tu informe</h3>
      <p class="entradilla">Marca los gráficos que te interesan y descárgalo en PDF. Lleva portada, un resumen con los hallazgos principales y los gráficos elegidos, con los datos de hoy (${rs.length} respuestas).</p>
      <div class="informe-creador__atajos">
        <button type="button" class="boton-descarga" data-atajo="recomendados">Selección recomendada</button>
        <button type="button" class="boton-descarga" data-atajo="todo">Todos</button>
        <button type="button" class="boton-descarga" data-atajo="nada">Ninguno</button>
      </div>
      <div class="informe-creador__grupos">
        ${panel.bloques
          .map(
            (b) => `<fieldset><legend>${b.titulo}</legend>${b.tarjetas
              .map((t) => `<label><input type="checkbox" value="${t.id}" ${elegidas.has(t.id) ? "checked" : ""}/> ${t.titulo}</label>`)
              .join("")}</fieldset>`,
          )
          .join("")}
      </div>
      <div class="informe-creador__accion">
        <button type="button" class="boton boton--primario" data-generar>Descargar informe (PDF)</button>
        <p class="nota">Se abre el diálogo de impresión: elige «Guardar como PDF».</p>
      </div>
      <div class="informe-creador__archivo" data-archivo></div>
    </div>`;
  const casillas = [...cont.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
  const guardar = () => {
    try {
      localStorage.setItem(GUARDADO, JSON.stringify(casillas.filter((c) => c.checked).map((c) => c.value)));
    } catch {
      /* sin almacenamiento */
    }
  };
  cont.addEventListener("change", guardar);
  cont.querySelectorAll<HTMLButtonElement>("[data-atajo]").forEach((b) =>
    b.addEventListener("click", () => {
      casillas.forEach((c) => (c.checked = b.dataset.atajo === "todo" || (b.dataset.atajo === "recomendados" && RECOMENDADOS.includes(c.value))));
      guardar();
    }),
  );
  cont.querySelector("[data-generar]")!.addEventListener("click", async () => {
    const ids = casillas.filter((c) => c.checked).map((c) => c.value);
    if (!ids.length) return alert("Marca al menos un gráfico.");
    await construirInforme(panel, rs, null, ids, null);
    print();
  });
  // Informes mensuales ya publicados
  cargar<{ mes: string; archivo: string; respuestas: number }[]>("../informes/indice.json")
    .then((lista) => {
      const el = cont.querySelector("[data-archivo]");
      if (el && lista.length)
        el.innerHTML = `<h4>Informes mensuales</h4><ul>${lista.map((i) => `<li><a href="${BASE}informes/${i.archivo}" download>${nombreMes(i.mes)}</a> · ${i.respuestas} respuestas</li>`).join("")}</ul>`;
    })
    .catch(() => {});
}

// Monta el informe (oculto en pantalla, visible al imprimir) con las tarjetas elegidas.
export async function construirInforme(panel: Panel, rs: Respuesta[], datos: Datos | null, ids: string[], mes: string | null) {
  document.getElementById("informe")?.remove();
  const inf = document.createElement("div");
  inf.id = "informe";
  document.body.append(inf);
  const elegidas = panel.bloques.map((b) => ({ ...b, tarjetas: b.tarjetas.filter((t) => ids.includes(t.id)) })).filter((b) => b.tarjetas.length);
  const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const nuevasMes = datos && mes ? datos.nuevas.filter((r) => String(r.Dia_mes ?? "").startsWith(mes)).length : null;
  inf.innerHTML = `
    <section class="informe-pagina informe-portada">
      <img src="${BASE}img/logo-512.png" alt="GeoLab Confital" width="220"/>
      <p class="sobretitulo">GeoLab Confital · Informe de percepción</p>
      <h1>El Confital</h1>
      <p class="informe-portada__sub">Cómo viven las personas usuarias la playa del Confital</p>
      <dl class="informe-portada__datos">
        <div><dt>Mes</dt><dd>${nombreMes(mes)}</dd></div>
        <div><dt>Respuestas</dt><dd>${rs.length}${nuevasMes !== null ? ` (${nuevasMes} nuevas este mes)` : ""}</dd></div>
        <div><dt>Datos a</dt><dd>${hoy}</dd></div>
      </dl>
      <div class="informe-portada__creditos">
        <p><b>Participantes</b><br/>${PARTICIPANTES.join("<br/>")}</p>
        <p><b>Instituciones</b><br/>${INSTITUCIONES.join("<br/>")}</p>
      </div>
    </section>
    <section class="informe-pagina">
      <p class="sobretitulo">Resumen</p>
      <h2>Lo esencial, en una página</h2>
      <div class="kpis kpis--informe">${panel.kpis.map(([v, t]) => `<div class="kpi"><b>${v}</b><span>${t}</span></div>`).join("")}</div>
      <h3>Hallazgos principales</h3>
      <ul class="informe-hallazgos">${elegidas.flatMap((b) => b.tarjetas).slice(0, 9).map((t) => `<li>${t.destacado}</li>`).join("")}</ul>
      <p class="nota">Cada gráfico indica entre cuántas respuestas se calcula. Los porcentajes se redondean y pueden no sumar exactamente 100.</p>
    </section>
    ${elegidas.map((b) => `<section class="informe-bloque" data-bloque="${b.id}"><p class="sobretitulo">${b.sobretitulo}</p><h2>${b.titulo}</h2><div class="tarjetas"></div></section>`).join("")}`;
  await Promise.all(elegidas.map((b) => dibujarTarjetas(inf.querySelector(`[data-bloque="${b.id}"] .tarjetas`)!, b.tarjetas, { informe: true })));
  // Imágenes y tipografías listas antes de imprimir
  // (fuera de pantalla, la carga diferida no llegaría nunca: se fuerza, y como mucho se esperan 15 s)
  const imagenes = [...inf.querySelectorAll("img")];
  imagenes.forEach((i) => (i.loading = "eager"));
  await Promise.race([Promise.all(imagenes.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))), new Promise((r) => setTimeout(r, 15_000))]);
  await document.fonts.ready;
}

// Para el informe mensual: marca la página como lista (el script de GitHub espera esta señal).
export function informeAutomatico() {
  document.documentElement.dataset.informe = "listo";
}
