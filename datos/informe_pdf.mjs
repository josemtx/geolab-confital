// Genera el informe mensual en PDF imprimiendo el panel de datos con todos los gráficos.
// Uso: node datos/informe_pdf.mjs <url del panel> <mes AAAA-MM>
//   (necesita puppeteer-core y Chrome; en GitHub Actions: npm i --no-save puppeteer-core)
// Escribe public/informes/<mes>.pdf y actualiza public/informes/indice.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [url, mes] = process.argv.slice(2);
if (!url || !/^\d{4}-\d{2}$/.test(mes ?? "")) throw new Error("Uso: node datos/informe_pdf.mjs <url> <AAAA-MM>");
const chrome = process.env.CHROME ?? ["/usr/bin/google-chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);

const navegador = await puppeteer.launch({ executablePath: chrome, args: ["--no-sandbox"] });
const pagina = await navegador.newPage();
const errores = [];
pagina.on("pageerror", (e) => errores.push(String(e)));
await pagina.goto(`${url}?informe=completo&mes=${mes}`, { waitUntil: "networkidle0", timeout: 120_000 });
await pagina.waitForFunction(() => document.documentElement.dataset.informe === "listo", { timeout: 120_000 });
const respuestas = await pagina.evaluate(() => Number(document.querySelector(".informe-portada__datos dd:nth-of-type(1)")?.textContent) || Number(document.querySelectorAll(".informe-portada__datos dd")[1]?.textContent?.match(/\d+/)?.[0]));
mkdirSync("public/informes", { recursive: true });
await pagina.pdf({ path: `public/informes/${mes}.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
await navegador.close();
if (errores.length) throw new Error(`Errores en la página: ${errores.join(" | ")}`);

const ruta = "public/informes/indice.json";
const indice = existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf-8")) : [];
const resto = indice.filter((i) => i.mes !== mes);
writeFileSync(ruta, JSON.stringify([{ mes, archivo: `${mes}.pdf`, respuestas, generado: new Date().toISOString() }, ...resto].sort((a, b) => b.mes.localeCompare(a.mes)), null, 1));
console.log(`Informe ${mes}: public/informes/${mes}.pdf (${respuestas} respuestas)`);
