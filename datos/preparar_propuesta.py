"""Propuesta de solución (TFG de Eric Joel Castaño Santana, 2025): ruta interpretativa por la
costa y la cornisa de El Confital, usos de cada tramo, paneles propuestos y el personaje Confi.

Lee las capas de INFORMACIÓN_JOSE_V2/.../ERIC/CAPAS/VISORPRUEBA2 y escribe:
  public/data/propuesta.json   rutas, usos y paneles (WGS84) con sus textos
  public/img/propuesta/*.webp  fotos de las rutas y los usos, carteles y Confi (sin fondo)

Las fotos están enlazadas en las capas (ArcGIS de la ULPGC) y se descargan; los carteles que no
tienen enlace salen de ERIC/CARTELES. Uso: python -P -E -X utf8 datos/preparar_propuesta.py
"""
import io
import json
import re
import urllib.request
from pathlib import Path

import shapefile
from PIL import Image, ImageDraw, ImageOps
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import linemerge, unary_union
from shapely.ops import transform  # noqa: (deprecado en shapely 2.1, sigue funcionando)

RAIZ = Path(__file__).resolve().parents[2]
ERIC = RAIZ / "INFORMACIÓN_JOSE_V2" / "INFORMACIÓN_JOSE_V2" / "ERIC"
CAPAS = ERIC / "CAPAS" / "VISORPRUEBA2"
CARTELES = ERIC / "CARTELES"
WEB = Path(__file__).resolve().parents[1]
IMG = WEB / "public" / "img" / "propuesta"
A_WGS = Transformer.from_crs("EPSG:32628", "EPSG:4326", always_xy=True)

# Los shapefiles cortan los textos a 254 caracteres; se terminan aquí (completando solo la palabra
# o, si está, con la frase del TFG). El texto del panel de las salinas de la cornisa llega revuelto.
ARREGLOS = {
    "forma esféri": "forma esférica.",
    "históricos y culturales": "históricos y culturales.",
    "otros espacios del entorn": "otros espacios del entorno.",
    "los antiguos canari": "los antiguos canarios.",
    "los raíles por donde se movía": "los raíles por donde se movía el equipo.",
    "Antiguas salinas de El Confital, creadas en 186Las salinas se crearon con el fin de abastecer a la ciudad de Las Palmas de Gran Canaria. Estas salinas fueron fundadas en 7 para abastecer de sal a Las Palmas de Gran Canaria y en funcionamiento hasta 1956.":
        "Antiguas salinas de El Confital, creadas en 1867 para abastecer de sal a Las Palmas de Gran Canaria y en funcionamiento hasta 1956.",
}
# Carteles de ERIC/CARTELES para los paneles que no tienen enlace en la capa
CARTEL_LOCAL = {"cornisa-6": "21.26.55", "costa-9": "21.28.14", "bienvenida": "21.28.05"}


def limpiar(v):
    v = re.sub(r"[ \t]+", " ", str(v).replace("\r\n", "\n")).strip()
    for mal, bien in ARREGLOS.items():
        if v.endswith(mal) or v == mal:
            v = v[: len(v) - len(mal)] + bien
    return v


def parrafos(valores):
    """Une los campos de texto: si uno empieza en minúscula, continúa la frase anterior."""
    out = []
    for v in valores:
        v = limpiar(v)
        if not v or v == "None" or v.startswith("http"):
            continue
        if out and v[0].islower():
            out[-1] = out[-1].rstrip(".") + ", " + v
        else:
            out.append(v)
    return [p if p[-1] in ".:!?»”)" or "\n-" in p else p + "." for p in out]


def leer(ruta):
    r = shapefile.Reader(str(CAPAS / ruta), encoding="utf-8")
    campos = [f[0] for f in r.fields[1:]]
    return [(dict(zip(campos, sr.record)), sr.shape) for sr in r.shapeRecords()]


def geometria(forma, tol=1.5, unir=False):
    g = shape(forma.__geo_interface__)
    if g.has_z:
        g = transform(lambda x, y, z=None: (x, y), g)
    if unir:  # las rutas llegan en trozos desordenados: se unen en una sola línea continua
        g = linemerge(unary_union(g))
    g = transform(lambda x, y: A_WGS.transform(x, y), g.simplify(tol))
    return json.loads(json.dumps(mapping(g)), parse_float=lambda f: round(float(f), 6))


def textos(rec, campos):
    return parrafos(rec.get(c, "") for c in campos)


def foto_enlace(rec):
    return next((v for v in rec.values() if isinstance(v, str) and "arcgis.com" in v), None)


def guardar_imagen(im, nombre, lado=1600):
    im = ImageOps.exif_transpose(im)
    im.thumbnail((lado, lado))
    im.save(IMG / f"{nombre}.webp", quality=80)
    return f"img/propuesta/{nombre}.webp"


def descargar(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")


def cartel_local(clave):
    f = next(CARTELES.glob(f"*{CARTEL_LOCAL[clave]}*"))
    return Image.open(f).convert("RGB")


def confi(im):
    """La lámina de Confi trae tres poses sobre blanco; se usa la primera (de frente, saludando),
    la única que no se solapa con su vecina, sin fondo (relleno desde las esquinas: el contorno
    negro protege el cuerpo, también blanco)."""
    ancho = im.width // 3
    rutas = []
    for i in range(1):
        pose = im.crop((i * ancho, 0, (i + 1) * ancho, im.height)).convert("RGBA")
        mascara = Image.new("L", pose.size, 255)
        gris = pose.convert("L").point(lambda v: 255 if v > 235 else 0)
        for esquina in [(0, 0), (pose.width - 1, 0), (0, pose.height - 1), (pose.width - 1, pose.height - 1)]:
            ImageDraw.floodfill(gris, esquina, 128)
        mascara = gris.point(lambda v: 0 if v == 128 else 255)
        pose.putalpha(mascara)
        pose = pose.crop(pose.getbbox())
        pose.thumbnail((600, 600))
        pose.save(IMG / f"confi_{i + 1}.webp", quality=85)
        rutas.append(f"img/propuesta/confi_{i + 1}.webp")
    return rutas


def main():
    IMG.mkdir(parents=True, exist_ok=True)
    datos = {}

    (gen, _), = leer("GENERAL/GENERAL.shp")
    datos["general"] = {"titulo": limpiar(gen["Temática"]), "textos": textos(gen, ["Text", "Text1", "Text2", "Text3", "Text4", "Text5", "Text6", "Text7"]),
                        "foto": guardar_imagen(descargar(foto_enlace(gen)), "general")}
    (con, _), = leer("CONFI/Confi.shp")
    datos["confi"] = {"textos": textos(con, ["Text", "Text1", "Text2"]), "poses": confi(descargar(foto_enlace(con)))}

    datos["rutas"] = []
    for clave, ruta, campos in [("costa", "RUTAS/TRAMO COSTA/COSTA_RUTA.shp", ["Text", "Text1", "Text2", "Text3", "Text4", "Text5"]),
                                ("cornisa", "RUTAS/TRAMO CORNISA/CORNISA_RUTA.shp", ["Text1", "Text2", "Text3", "Text4", "Text5"])]:
        (rec, forma), = leer(ruta)
        datos["rutas"].append({"id": clave, "resumen": limpiar(rec["Temática"]), "textos": textos(rec, campos), "longitud_m": round(rec["Shape_Leng"]),
                               "foto": guardar_imagen(descargar(foto_enlace(rec)), f"ruta_{clave}"), "geometry": geometria(forma, unir=True)})

    datos["usos"] = []
    for rec, forma in leer("USOS/USOS_TRAMOS.shp"):
        clave = {"Adaptado PMR": "adaptado", "Compartido": "compartido", "Deportivo": "deportivo", "Recreativo": "paseo"}[rec["Usos"]]
        datos["usos"].append({"id": clave, "nombre": {"paseo": "Paseo", "adaptado": "Adaptado a movilidad reducida"}.get(clave, rec["Usos"]),
                              "textos": textos(rec, ["Text1", "Text2", "Text3"]), "longitud_m": round(rec["Shape_Leng"]),
                              "foto": guardar_imagen(descargar(foto_enlace(rec)), f"uso_{clave}"), "geometry": geometria(forma)})

    datos["paneles"] = []
    descargadas = {}
    for ruta, archivo, orden, campos in [("costa", "PANELES_COSTA/PANELES2_COSTA.shp", "Orden", ["Texto", "Text2", "Text3", "Text4", "Text5", "Text6", "Text7", "Text8", "Text9"]),
                                         ("cornisa", "PANELES_CORNISA/PANELES2_CORNISA.shp", "orden", ["text", "Texto", "Text2", "Text3", "Text4", "Text5", "Text6", "Text7", "Text8"])]:
        for rec, forma in leer(archivo):
            pid = f"{ruta}-{rec[orden]}"
            enlace = foto_enlace(rec)
            titulo = limpiar(rec["Panel"])
            cartel = None
            if pid in CARTEL_LOCAL:
                cartel = guardar_imagen(cartel_local(pid), f"cartel_{pid}")
            elif enlace and not (titulo.startswith("Formación de la capital")):  # Eric reutiliza el cartel de la tolda
                if enlace not in descargadas:
                    descargadas[enlace] = guardar_imagen(descargar(enlace), f"cartel_{pid}")
                cartel = descargadas[enlace]
            if titulo.startswith("Bienvenida"):
                cartel = guardar_imagen(cartel_local("bienvenida"), "recreacion")
            x, y = forma.points[0][:2]
            lon, lat = A_WGS.transform(x, y)
            datos["paneles"].append({"id": pid, "ruta": ruta, "orden": rec[orden], "titulo": titulo, "tematica": limpiar(rec["Temática"]),
                                     "textos": textos(rec, campos), "cartel": cartel, "recreacion": titulo.startswith("Bienvenida"),
                                     "coordinates": [round(lon, 6), round(lat, 6)]})
    datos["paneles"].sort(key=lambda p: (p["ruta"] != "costa", p["orden"]))
    (WEB / "public" / "data" / "propuesta.json").write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"propuesta.json: {len(datos['rutas'])} rutas, {len(datos['usos'])} usos, {len(datos['paneles'])} paneles "
          f"({sum(1 for p in datos['paneles'] if p['cartel'])} con cartel)")


if __name__ == "__main__":
    main()
