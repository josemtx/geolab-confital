# GeoLab Confital

Plataforma de divulgación científica y participación ciudadana sobre la playa del Confital (La Isleta, Las Palmas de Gran Canaria). Resultados de la investigación de Adrián Cabrera Sánchez (ULPGC y Universidad de Zaragoza).

## Datos

`datos/preparar_datos.py` genera `public/data/` a partir del material original (carpeta `../fuentes/`, fuera del repositorio):

```bash
pip install -r datos/requirements.txt
python datos/preparar_datos.py
```

Las correcciones aplicadas a los datos originales, con su justificación, están en `public/data/correcciones.json`.

## Licencias

- Ortofoto: GRAFCAN – Gobierno de Canarias (CC BY 4.0).
- Tipografía Inter: SIL Open Font License.
