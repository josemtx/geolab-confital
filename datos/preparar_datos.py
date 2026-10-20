"""Prepara los datos de la web a partir del material original de Adrián (que no se modifica).

Uso:  python datos/preparar_datos.py            (desde web/)

Lee  ../fuentes/INFORMACIÓN_JOSE/  y escribe  public/data/:
  encuestas.json   174 respuestas del TFM, limpias y con las correcciones de CORRECCIONES aplicadas
  conteos.json     conteos manuales por periodo, tipo de día y franja (entradas, salidas, reposo, surf)
  capacidad.json   capacidad de carga física, real y efectiva por unidad y uso (CALCULOS_CCT)
  correcciones.json  qué se ha corregido y por qué (se enseña en la web, por transparencia)
  geo/*.json       capas en GeoJSON (WGS84)
Al final imprime la comprobación de cifras frente al TFM (ver ../DISCREPANCIAS.md).
"""
import json
import re
import sys
from pathlib import Path

import docx
import pandas as pd
import shapefile
from pyproj import Transformer
from shapely import transform as transformar
from shapely.geometry import mapping, shape

WEB = Path(__file__).resolve().parent.parent
FUENTES = WEB.parent / "fuentes" / "INFORMACIÓN_JOSE"
DOCS, CAPAS = FUENTES / "DOCUMENTOS", FUENTES / "CAPAS_SHAPEFILE"
SALIDA = WEB / "public" / "data"

# --- Encuestas -----------------------------------------------------------------------------

# Nombres de columna sin tildes ni eñes (las claves viajan a JavaScript).
COLUMNAS = {"Tipo_compañía": "Tipo_compania", "Número_usuarios": "Numero_usuarios_percibido", "Numero_usuarios": "Numero_usuarios_estimado",
            "Situación_playa": "Situacion_playa", "Cierre_baño": "Cierre_bano", "Iluminación": "Iluminacion", "Señalización": "Senalizacion",
            "Franja_Horaria": "Franja_horaria"}

# Correcciones con causa demostrada. Cada una localiza filas por su contenido (Numero_Encuesta se repite).
CORRECCIONES = [
    {
        "id": "procedencia-triana",
        "donde": {"Lugar_concreto": "Triana", "Procedencia": "Otro municipio"},
        "cambio": {"Procedencia": "Mismo municipio"},
        "por_que": "Triana es un barrio de Las Palmas de Gran Canaria. La respuesta (online, 19/03/2026) se anotó como «Otro municipio». "
                   "El propio mapa de barrios del TFM ya la cuenta como del municipio.",
    },
    {
        "id": "procedencia-almatriche",
        "donde": {"Lugar_concreto": "Almatriche Bajo", "Procedencia": "Otro municipio"},
        "cambio": {"Procedencia": "Mismo municipio"},
        "por_que": "Almatriche es un barrio de Las Palmas de Gran Canaria. La respuesta (online, 23/03/2026) se anotó como «Otro municipio». "
                   "El propio mapa de barrios del TFM ya la cuenta como del municipio.",
    },
]

# Erratas de escritura: misma categoría escrita de varias formas.
UNIFICADAS = []  # se rellena al limpiar: variantes de mayúsculas que se han unido
UNIFICAR = {"Otro municipio": "Otro municipio de Gran Canaria", "Otra isla": "Otra isla canaria"}


def limpiar_texto(v):
    if not isinstance(v, str):
        return v
    v = re.sub(r"\s+", " ", v).strip()
    return v[:1].upper() + v[1:].lower() if v.isupper() or re.match(r"^[A-ZÁÉÍÓÚ]{2}[a-z]", v) else v


FORMULARIO = sorted((WEB.parent / "fuentes" / "formulario").glob("respuestas_formulario_*.csv"))


def corregir_socorrismo(t):
    """La columna Socorrismo del Excel no coincide con lo respondido en el formulario (solo el 67 %
    de las 54 respuestas online; las otras cinco valoraciones coinciden al 100 %). Se toma la
    respuesta original. Las filas online del Excel están en el mismo orden que el formulario."""
    if not FORMULARIO:
        return []
    f = pd.read_csv(FORMULARIO[-1])
    f["_fecha"] = pd.to_datetime(f["Marca temporal"], dayfirst=True)
    frec = next(c for c in f.columns if c.startswith("¿Cuál es la frecuencia"))
    f = f[(f[frec] != "Nunca") & (f["_fecha"] < "2026-04-22")].sort_values("_fecha").reset_index(drop=True)
    online = t.index[t["Usuarios_totales"].isna()]
    assert len(online) == len(f), "El formulario no cuadra con las respuestas online del Excel"
    assert (pd.to_datetime(t.loc[online, "Dia_mes"]).dt.strftime("%Y-%m-%d").values == f["_fecha"].dt.strftime("%Y-%m-%d").values).all()
    escala = ["Muy mejorable", "Mejorable", "Adecuado", "Bueno", "Muy bueno"]
    col = next(c for c in f.columns if c.endswith("[Socorrismo]"))
    nuevo = f[col].map(lambda v: escala[int(str(v).strip()[0]) - 1] if pd.notna(v) else None).values
    antes = t.loc[online, "Socorrismo"].astype(str).str.strip().str.capitalize().values
    cambios = int((antes != nuevo).sum())
    t.loc[online, "Socorrismo"] = nuevo
    return [{
        "id": "socorrismo-formulario",
        "donde": {"Modalidad": "Online", "columna": "Socorrismo"},
        "cambio": {"Socorrismo": "respuesta original del formulario"},
        "por_que": "En el Excel, la valoración del socorrismo de las respuestas online no coincide con lo que la gente marcó en el "
                   "formulario (las otras cinco valoraciones de servicios sí coinciden al 100 %). Se usa la respuesta original.",
        "filas": cambios,
    }]


def encuestas():
    t = pd.read_excel(DOCS / "DATOS_TFM.xlsx", header=0).dropna(axis=1, how="all")
    t = t.rename(columns=COLUMNAS)
    for c in t.columns:
        if t[c].dtype == object or str(t[c].dtype).startswith("str"):
            t[c] = t[c].map(limpiar_texto)
    # Mayúsculas inconsistentes dentro de una misma columna ("Muy Amplio" / "Muy amplio"): se unifica a la forma más frecuente.
    for c in t.columns:
        if t[c].dtype == object or str(t[c].dtype).startswith("str"):
            formas = t[c].dropna().astype(str)
            # Preferencia: la forma «Frase normal» si existe (p. ej. «Muy amplio» frente a «Muy Amplio»); si no, la más frecuente.
            canon = formas.groupby(formas.str.lower()).agg(lambda s: next((f for f in s.unique() if f == f[:1].upper() + f[1:].lower()), s.value_counts().index[0]))
            variantes = formas.groupby(formas.str.lower()).agg(lambda s: sorted(set(s)))
            for formas_k in variantes[variantes.map(len) > 1]:
                UNIFICADAS.append(f"{c}: {' / '.join(formas_k)}")
            t[c] = t[c].map(lambda v: canon.get(str(v).lower(), v) if isinstance(v, str) else v)
    # Escritura de frase en las respuestas («Muy Amplio» → «Muy amplio»), salvo nombres de lugar.
    for c in t.columns:
        if c != "Lugar_concreto" and (t[c].dtype == object or str(t[c].dtype).startswith("str")):
            antes = t[c].copy()
            t[c] = t[c].map(lambda v: (v[:1].upper() + v[1:].lower()).replace("confital", "Confital") if isinstance(v, str) else v)
            cambios = sorted({f"{a} → {b}" for a, b in zip(antes, t[c]) if isinstance(a, str) and a != b})
            UNIFICADAS.extend(f"{c}: {x}" for x in cambios)
    aplicadas = []
    for cor in CORRECCIONES:
        filas = pd.Series(True, index=t.index)
        for k, v in cor["donde"].items():
            filas &= t[k] == v
        assert filas.sum() == 1, f"La corrección {cor['id']} debía afectar a 1 fila y afecta a {filas.sum()}"
        for k, v in cor["cambio"].items():
            t.loc[filas, k] = v
        aplicadas.append({**cor, "filas": int(filas.sum())})
    aplicadas += corregir_socorrismo(t)
    t["Procedencia"] = t["Procedencia"].replace(UNIFICAR)
    # La misma respuesta escrita de dos formas, y la escala de saturación con los nombres de Adrián.
    t["Que_harias_mas_usuarios"] = t["Que_harias_mas_usuarios"].replace({"Ir a otra playa cercana": "Ir a una playa cercana"})
    t["Numero_usuarios_percibido"] = t["Numero_usuarios_percibido"].replace({"Excesivo": "Muy alto"})
    t["Dia_mes"] = pd.to_datetime(t["Dia_mes"]).dt.strftime("%Y-%m-%d")
    # Presencial = se contó a la gente de la playa en ese turno (Usuarios_totales); el resto, online. Da 120 / 54, como el TFM.
    t["Modalidad"] = t["Usuarios_totales"].map(lambda v: "Presencial" if pd.notna(v) else "Online")
    t["Fuente"] = "Estudio TFM"
    return t, aplicadas


# --- Conteos -------------------------------------------------------------------------------

def conteos():
    c = pd.read_excel(DOCS / "DATOS_CONTEOS.xlsx", header=None)
    periodos = []
    for i, r in c.iterrows():
        cab = str(r[1])
        if "ENTRADAS" not in cab.upper():
            continue
        tipo = "Pico" if "PICO" in cab.upper() else "Valle"
        # Lo que va detrás de «VALLE» o «PICO»: «- MARZO», «ENERO-DICIEMBRE», «- ENERO/DICIEMBRE»…
        resto = re.split(r"VALLE|PICO", cab.upper(), maxsplit=1)[-1].strip(" -–")
        mes = "Diciembre/Enero" if "ENERO" in resto and "DICIEMBRE" in resto else resto.strip().capitalize()
        franjas = []
        for _, f in c.iloc[i + 1:i + 11].iterrows():
            num = lambda v: None if pd.isna(v) else int(v)
            franjas.append({"franja": re.sub(r"\s*[–-]\s*", "–", str(f[1]).strip()), "entradas": num(f[2]), "salidas": num(f[3]), "reposo": num(f[4]), "surf": num(f[5])})
        periodos.append({"periodo": mes, "tipo_dia": tipo, "total_entradas": int(c.iloc[i + 1][6]), "franjas": franjas})
    return periodos


# --- Capacidad de carga (CALCULOS_CCT.docx) -----------------------------------------------

USOS = [("D", "Pasarela de madera (tránsito)", None), ("C", "Plataforma de madera (estancia y reposo)", "C.1"), ("C", "Depósitos hialoclastíticos erosionados", "C.2"),
        ("E", "Depósitos eólicos degradados", "Solárium"), ("E", "Depósitos eólicos degradados", "Reposo"), ("F", "Pista de tierra", "Bicicleta"),
        ("F", "Pista de tierra", "Andar o correr"), ("A1", "Zona de surf intermareal", None), ("A2", "Zona de surf submareal", None)]


def capacidad():
    tabla = docx.Document(DOCS / "CALCULOS_CCT.docx").tables[0]
    filas = {r.cells[0].text.strip(): [c.text.strip() for c in r.cells[1:]] for r in tabla.rows}
    n = lambda s: int(re.sub(r"[^\d]", "", s))
    out = [{"codigo": cod, "unidad": uni, "uso": uso, "ccf": n(filas["CCF"][i]), "ccr": n(filas["CCR"][i]), "cce": n(filas["CCE"][i]),
            "capacidad_manejo": filas["CM"][i]} for i, (cod, uni, uso) in enumerate(USOS)]
    out += [{"codigo": "B", "unidad": "Área supramareal", "uso": None, "ccf": None, "ccr": None, "cce": None, "nota": "Sin cálculo: no tiene uso por parte de los usuarios"},
            {"codigo": "G", "unidad": "Talud coluvial", "uso": None, "ccf": None, "ccr": None, "cce": None, "nota": "Sin cálculo: no tiene uso por parte de los usuarios"}]
    return out


# --- Capas geográficas ---------------------------------------------------------------------

A_WGS = {e: Transformer.from_crs(e, "EPSG:4326", always_xy=True) for e in ("EPSG:3857", "EPSG:32628")}
CAPAS_GEO = [  # nombre, ruta, EPSG, campos, tolerancia de simplificación (m)
    ("zonificacion", "ZONIFICACIÓN/Zonificacion_Confital.shp", "EPSG:32628", {"COD", "DEFINCIÓN", "CCF", "CCR", "CCE"}, 0),
    ("ciudad_baja", "CIUDAD_BAJA/Ciudad_baja.shp", "EPSG:32628", {"barrio"}, 4),
    ("barrios", "Procedencia_municipal/Barrios_zonas.shp", "EPSG:32628", {"barrio"}, 4),
    ("flujos_barrios", "Procedencia_municipal/Procedencia_lineas.shp", "EPSG:32628", {"nom_prov"}, 0),
    ("municipios", "Procedencia_insular/Zonas_catastro.shp", "EPSG:32628", {"MUNICIPI"}, 60),
    ("flujos_municipios", "Procedencia_insular/Lineas_procedencia.shp", "EPSG:4326", {"municipio"}, 0),
    ("conflicto_puntos", "Zonas de conflicto/Puntos.shp", "EPSG:3857", {"punto", "des", "Descripci", "opiniones", "opiniones2"}, 0),
    ("conflicto_zonas", "Zonas de conflicto/Poligonos.shp", "EPSG:3857", {"poligono", "Título", "Descripci", "opiniones"}, 0),
    ("conflicto_lineas", "Zonas de conflicto/Lineas.shp", "EPSG:3857", {"Descripci", "opiniones", "opiniones2"}, 1),
]

DISOLVER = {"barrios": 10, "ciudad_baja": 10, "municipios": 40}  # m que se cierran entre parcelas


def geo():
    out = SALIDA / "geo"
    out.mkdir(parents=True, exist_ok=True)
    for nombre, ruta, epsg, campos, tol in CAPAS_GEO:
        r = shapefile.Reader(str(CAPAS / ruta), encoding="utf-8")
        nombres = [f[0] for f in r.fields[1:]]
        feats = []
        for sr in r.shapeRecords():
            g = shape(sr.shape.__geo_interface__)
            if nombre in DISOLVER:  # parcelas del catastro → una sola forma por barrio o municipio
                g = g.buffer(DISOLVER[nombre]).buffer(-DISOLVER[nombre])
            if tol:
                g = g.simplify(tol, preserve_topology=True)
            if epsg != "EPSG:4326":
                g = transformar(g, lambda xy: list(zip(*A_WGS[epsg].transform(xy[:, 0], xy[:, 1]))))
            props = {k: v for k, v in zip(nombres, sr.record) if k in campos}
            feats.append({"type": "Feature", "properties": props, "geometry": json.loads(json.dumps(mapping(g)), parse_float=lambda f: round(float(f), 6))})
        guardar(f"geo/{nombre}.json", {"type": "FeatureCollection", "features": feats})


# --- Salida y comprobación -----------------------------------------------------------------

def guardar(nombre, datos):
    ruta = SALIDA / nombre
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  {nombre:28s} {ruta.stat().st_size / 1024:7.0f} KB")


def comprobar(t, cont, cap):
    pct = lambda col, v, n=None: 100 * (t[col] == v).sum() / (n or t[col].notna().sum())
    filas = [
        ("Respuestas válidas", "174", f"{len(t)}"),
        ("Del mismo municipio", "57 % (99)", f"{pct('Procedencia', 'Mismo municipio'):.1f} % ({(t['Procedencia'] == 'Mismo municipio').sum()})"),
        ("Llega a pie", "64 %", f"{pct('Medio_llegada', 'Caminando'):.1f} %"),
        ("Transporte público", "9 % (resultados) / <2 % (discusión)", f"{pct('Medio_llegada', 'Transporte público'):.1f} %"),
        ("Solo o en pareja", "86 %", f"{100 * t['Tipo_compania'].isin(['Solo', '2 personas']).mean():.1f} %"),
        ("Espacio amplio o muy amplio", "73,99 %", f"{100 * t['Superficie_disponible'].isin(['Amplio', 'Muy amplio']).mean():.1f} %"),
        ("No abandonaría si hay más gente", "63 %", f"{pct('Condicionante_mayor_afluencia', 'No'):.1f} %"),
        ("No le condiciona el cierre del baño", "62 %", f"{pct('Cierre_bano', 'No'):.1f} %"),
        ("No le condiciona el cierre al tráfico", "91 %", f"{pct('Cierre_coches', 'No'):.1f} %"),
        ("Servicios insuficientes (n = 120)", "75 %", f"{pct('Servicios_suficientes', 'No'):.1f} % (n = {t['Servicios_suficientes'].notna().sum()})"),
        ("Pasear como actividad principal", "60,92 % (fig. 17) / 51 % (discusión)", f"{pct('Actividad_desarrollar', 'Pasear'):.1f} %"),
        ("Telde", "10 (TFM) / 9 (visor)", f"{(t['Lugar_concreto'] == 'Telde').sum()}"),
        ("Guanarteme / Santa Catalina", "14 / 9 (mapa TFM)", f"{(t['Lugar_concreto'] == 'Guanarteme').sum()} / {(t['Lugar_concreto'] == 'Santa Catalina - Las Canteras').sum()}"),
        ("Sábado de más entradas", "1.250", f"{max(p['total_entradas'] for p in cont)}"),
        ("Pasarela: física → real → efectiva", "283 → 94 → 24", "{ccf} → {ccr} → {cce}".format(**next(c for c in cap if c["codigo"] == "D"))),
    ]
    print("\nComprobación frente al TFM y el brief:")
    for a, b, c in filas:
        print(f"  {a:40s} TFM/brief: {b:38s} datos web: {c}")


if __name__ == "__main__":
    print("Generando public/data/ …")
    t, aplicadas = encuestas()
    cont, cap = conteos(), capacidad()
    # Se publican anónimas: sin número de encuesta (no aporta nada y evitaría cruzar respuestas).
    guardar("encuestas.json", json.loads(t.drop(columns=["Numero_Encuesta"]).to_json(orient="records", force_ascii=False)))
    guardar("conteos.json", cont)
    guardar("capacidad.json", cap)
    guardar("correcciones.json", [{k: v for k, v in a.items()} for a in aplicadas])
    if "--sin-geo" not in sys.argv:
        geo()
    print("\nVariantes de escritura unificadas:", *UNIFICADAS, sep="\n  ")
    comprobar(t, cont, cap)
