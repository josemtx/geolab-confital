// Utilidades compartidas: datos, apariciones al hacer scroll y pasos del scrollytelling.

export const BASE = import.meta.env.BASE_URL;
export const cargar = <T>(ruta: string): Promise<T> => fetch(`${BASE}data/${ruta}`).then((r) => r.json() as Promise<T>);

export const movimientoReducido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const esMovil = () => matchMedia("(max-width: 860px)").matches;
export const numeroES = (n: number) => Math.round(n).toLocaleString("es-ES", { useGrouping: true }).replace(/^(\d)(\d{3})$/, "$1.$2");

// Titulares que aparecen palabra a palabra.
export function partirPalabras(raiz: ParentNode = document) {
  raiz.querySelectorAll<HTMLElement>("[data-palabras]").forEach((el) => {
    const html = el.innerHTML.split(/(<br\s*\/?>)/);
    let i = 0;
    el.innerHTML = html
      .map((trozo) => (trozo.startsWith("<br") ? trozo : trozo.split(/\s+/).filter(Boolean).map((p) => `<span class="palabra"><span style="transition-delay:${i++ * 70}ms">${p}</span></span>`).join(" ")))
      .join("");
    el.setAttribute("data-revelar", "");
  });
}

// Aparición suave de todo lo marcado con data-revelar.
export function revelar() {
  const io = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => e.isIntersecting && (e.target.classList.add("visible"), io.unobserve(e.target))),
    { rootMargin: "0px 0px -12% 0px" },
  );
  document.querySelectorAll("[data-revelar]").forEach((el) => io.observe(el));
}

// Pasos de un scrollytelling: avisa cuando un paso cruza el centro de la pantalla.
export function pasos(contenedor: Element, alCambiar: (indice: number) => void) {
  const items = [...contenedor.querySelectorAll<HTMLElement>(".paso")];
  let actual = -1;
  const io = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const i = items.indexOf(e.target as HTMLElement);
        if (i === actual) continue;
        actual = i;
        items.forEach((el, k) => el.classList.toggle("paso--activo", k === i));
        alCambiar(i);
      }
    },
    { rootMargin: esMovil() ? "-68% 0px -27% 0px" : "-45% 0px -45% 0px" },
  );
  items.forEach((el) => io.observe(el));
}

// Ejecuta `crear` cuando el elemento se acerca a la pantalla (los mapas pesan: se cargan al llegar).
export function alAcercarse(el: Element, crear: () => void) {
  const io = new IntersectionObserver(
    (e) => {
      if (e.some((x) => x.isIntersecting)) {
        io.disconnect();
        crear();
      }
    },
    { rootMargin: "150% 0px" },
  );
  io.observe(el);
}

// Interpolación animada (requestAnimationFrame) con easing suave.
export function animar(duracion: number, cada: (t: number) => void, alTerminar?: () => void) {
  if (movimientoReducido()) {
    cada(1);
    alTerminar?.();
    return () => {};
  }
  const t0 = performance.now();
  let id = 0;
  const paso = (ahora: number) => {
    const t = Math.min(1, (ahora - t0) / duracion);
    cada(1 - Math.pow(1 - t, 3));
    if (t < 1) id = requestAnimationFrame(paso);
    else alTerminar?.();
  };
  id = requestAnimationFrame(paso);
  return () => cancelAnimationFrame(id);
}
