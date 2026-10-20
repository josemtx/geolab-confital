"""Aprende cómo pasó Adrián las respuestas del formulario a categorías del Excel del TFM.

Uso:  python datos/aprender_recodificacion.py ../fuentes/formulario/<respuestas>.csv

Las 54 respuestas online del Excel están, fila a fila, en el mismo orden que en el formulario
(se comprueba). Para cada pregunta con texto libre o con opciones distintas, se guarda la
equivalencia «lo que escribió la persona» → «categoría del estudio». La web la usa para
recodificar las respuestas nuevas igual que el estudio (y aplica reglas de respaldo a lo nuevo).

Salida: public/data/recodificacion.json  {campo: {texto normalizado: categoría}}
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

WEB = Path(__file__).resolve().parent.parent
EXCEL = WEB.parent / "fuentes" / "INFORMACIÓN_JOSE" / "DOCUMENTOS" / "DATOS_TFM.xlsx"
CORTE = "2026-05-01"  # el estudio recoge el formulario hasta el 21/04/2026

# Pregunta del formulario (inicio del encabezado) → columna del Excel.
PREGUNTAS = {
    "Atendiendo al mapa": "Unidad_concreta",
    "Nivel de estudios": "Estudios",
    "Indique el barrio": "Lugar_concreto",
    "Indique el municipio": "Lugar_concreto",
    "Indique la isla": "Lugar_concreto",
    "Indique la provincia": "Lugar_concreto",
    "Indique el país": "Lugar_concreto",
    "¿Qué principal actividad": "Actividad_desarrollar",
    "Cuando acude al Confital, ¿A través de qué medio": "Medio_llegada",
    "¿Cómo conoció": "Conocimiento_existencia",
    "Si aumentara el número de usuarios": "Condicionante_mayor_afluencia",
    "¿Qué es lo que más valoras": "Valoras_visita",
    "¿Es para usted un condicionante": "Cierre_baño",
    "¿Considera que el cierre al acceso": "Cierre_coches",
}


def norm(s) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s).strip(" .")


def principal(v: str) -> str:
    return v.strip()[:1].upper() + v.strip()[1:].lower() if isinstance(v, str) else v


def main(csv: str):
    f = pd.read_csv(csv)
    f["_fecha"] = pd.to_datetime(f["Marca temporal"], dayfirst=True)
    frec = next(c for c in f.columns if c.startswith("¿Cuál es la frecuencia"))
    f = f[(f[frec] != "Nunca") & (f["_fecha"] < CORTE)].sort_values("_fecha").reset_index(drop=True)
    x = pd.read_excel(EXCEL, header=0)
    x = x[x["Usuarios_totales"].isna()].reset_index(drop=True)  # online
    assert len(f) == len(x), f"{len(f)} filas del formulario frente a {len(x)} online del Excel"
    dias = pd.to_datetime(x["Dia_mes"]).dt.strftime("%Y-%m-%d").values
    assert (dias == f["_fecha"].dt.strftime("%Y-%m-%d").values).all(), "El orden no coincide (fecha)"
    assert (x["Sexo"].str.strip().values == f["Sexo"].values).all(), "El orden no coincide (sexo)"

    salida: dict[str, dict[str, str]] = defaultdict(dict)
    for inicio, col_excel in PREGUNTAS.items():
        col = next(c for c in f.columns if c.startswith(inicio))
        votos: dict[str, Counter] = defaultdict(Counter)
        for v, e in zip(f[col], x[col_excel]):
            if pd.notna(v) and pd.notna(e):
                votos[norm(v)][re.sub(r"\s+", " ", str(e)).strip()] += 1
        campo = {"Cierre_baño": "Cierre_bano"}.get(col_excel, col_excel)
        for k, c in votos.items():
            salida[campo][k] = c.most_common(1)[0][0]
    # Mismas formas que en encuestas.json (frase normal, nombres de Adrián)
    for campo, tabla in salida.items():
        for k, v in tabla.items():
            if campo != "Lugar_concreto":
                v = principal(v).replace("confital", "Confital")
            tabla[k] = {"Otro municipio": "Otro municipio de Gran Canaria", "Excesivo": "Muy alto", "Ir a otra playa cercana": "Ir a una playa cercana"}.get(v, v)
    ruta = WEB / "public" / "data" / "recodificacion.json"
    ruta.write_text(json.dumps(salida, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    print(f"{ruta.name}: " + ", ".join(f"{k} ({len(v)})" for k, v in salida.items()))


if __name__ == "__main__":
    main(sys.argv[1])
