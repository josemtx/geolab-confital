// Las dos formas de enseñar los resultados:
// - en la página principal, las cifras clave y unos pocos gráficos destacados;
// - en el panel de datos (datos/), un bloque por pestaña y el creador de informes.
import { revelar } from "../comun";
import type { Respuesta } from "../respuestas";
import { construirInforme, informeAutomatico, vistaInforme } from "./informe";
import { conDatos, definir, dibujarBloque, dibujarKpis, dibujarTarjetas, type Panel } from "./panel";

const DESTACADOS = ["percepcion-unidades", "que-es-lo-que-mas-valoran", "como-valoran-cada-servicio"];

// `tambien` recibe las mismas respuestas (el mapa de procedencia), sin volver a pedirlas.
export function iniciarDestacados(tambien: (rs: Respuesta[]) => void = () => {}) {
  const cont = document.querySelector("[data-destacados]");
  if (!cont) return;
  conDatos((rs) => {
    const p = definir(rs);
    dibujarKpis(document.querySelector("[data-kpis]"), p.kpis);
    cont.innerHTML = "";
    const todas = p.bloques.flatMap((b) => b.tarjetas);
    dibujarTarjetas(cont, DESTACADOS.map((id) => todas.find((t) => t.id === id)!).filter(Boolean));
    tambien(rs);
  });
}

export function iniciarPanelDatos() {
  const vista = document.querySelector<HTMLElement>("[data-vista]");
  const pestanas = document.querySelector<HTMLElement>("[data-pestanas]");
  if (!vista || !pestanas) return;
  const params = new URLSearchParams(location.search);
  let actual: { rs: Respuesta[]; panel: Panel } | null = null;

  const mostrar = (id: string) => {
    if (!actual) return;
    pestanas.querySelectorAll<HTMLButtonElement>("[data-pestana]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pestana === id)));
    // En el móvil la fila de pestañas se desliza: se centra la elegida.
    const fila = pestanas.querySelector<HTMLElement>(".pestanas__fila")!, elegida = pestanas.querySelector<HTMLElement>(`[data-pestana="${id}"]`);
    if (elegida) fila.scrollLeft = elegida.offsetLeft - fila.offsetLeft - (fila.clientWidth - elegida.offsetWidth) / 2;
    vista.innerHTML = "";
    if (id === "informe") vistaInforme(vista, actual.panel, actual.rs);
    else {
      const b = actual.panel.bloques.find((x) => x.id === id) ?? actual.panel.bloques[0];
      dibujarBloque(vista, b);
    }
    revelar();
  };
  const pestanaActual = () => {
    const h = location.hash.slice(1);
    return h && (h === "informe" || actual?.panel.bloques.some((b) => b.id === h)) ? h : "quien";
  };
  pestanas.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-pestana]");
    if (!b) return;
    history.replaceState(null, "", `#${b.dataset.pestana}`);
    mostrar(b.dataset.pestana!);
    pestanas.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  addEventListener("hashchange", () => mostrar(pestanaActual()));

  conDatos(async (rs, datos) => {
    actual = { rs, panel: definir(rs) };
    dibujarKpis(document.querySelector("[data-kpis]"), actual.panel.kpis);
    // Informe automático (GitHub, cada mes): ?informe=completo&mes=AAAA-MM
    if (params.get("informe") === "completo") {
      await construirInforme(actual.panel, rs, datos, actual.panel.bloques.flatMap((b) => b.tarjetas.map((t) => t.id)), params.get("mes"));
      informeAutomatico();
      return;
    }
    const primera = !vista.childElementCount;
    mostrar(pestanaActual());
    // Si se llega con un apartado en la dirección (datos/#sensacion), se baja hasta él.
    if (primera && location.hash) pestanas.scrollIntoView({ block: "start" });
  });
}
