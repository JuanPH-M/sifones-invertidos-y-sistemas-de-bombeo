# Sifones invertidos y sistemas de bombeo

Aplicación portátil para diseñar y verificar sifones invertidos y estaciones de bombeo. Proyecto final AA-PF-01 de Acueducto y Alcantarillado, Grupo G2, Fundación Universitaria Tecnológico Comfenalco.

## Cómo usarla

Abra `Sifones_invertidos_y_sistemas_de_bombeo.html` con doble clic. No necesita instalación ni internet. Vea `docs/Instructivo_de_uso.pdf`.

## Qué calcula

**Sifón invertido:** número y diámetro de conductos para Qmin, Qmed y Qmax; velocidades; pérdidas de entrada, fricción, codos y salida; niveles en cámaras; vertederos de regulación; perfil y cotas.

**Sistema de bombeo:** curva del sistema; punto de operación con la curva de bomba suministrada; potencia y eficiencia; NPSH disponible y requerido; velocidades en succión e impulsión; sumergencia; golpe de ariete (Joukowsky y cierre lento); pozo húmedo.

## Contenido

| Ruta | Contenido |
| --- | --- |
| `Sifones_invertidos_y_sistemas_de_bombeo.html` | La aplicación completa, en un solo archivo |
| `docs/Instructivo_de_uso.pdf` | Instructivo de una página |
| `docs/Memoria_caso_base.pdf` | Ejemplo de memoria exportada |
| `docs/Datos_caso_base.xlsx` | Ejemplo de Excel exportado, con matriz normativa y plan de pruebas |
| `src/` | Código fuente |
| `vendor/` | Librerías incluidas para funcionar sin conexión |
| `tests/` | Plan de pruebas y verificación independiente |
| `build.js` | Une todo en el archivo HTML |

## Verificación

```bash
node tests/engine.test.js
```

```bash
python tests/verificacion_independiente.py
```

El primero ejecuta 20 casos (normales, en el límite, fuera de norma e inválidos). El segundo recalcula 57 variables del caso base con fórmulas escritas aparte.

Para regenerar la aplicación después de cambiar el código:

```bash
node build.js
```

## Fuentes y criterio

- **Obligatoria:** Resolución 0330 de 2017, con las modificaciones de la Resolución 799 de 2021. Artículos 56, 78, 141, 142, 149, 150, 158, 160 y 161.
- **Guías técnicas:** RAS Título D (2016), RAS Título B y HEC-22, 4.ª ed. (FHWA-HIF-24-006, 2024).

Incumplir la Resolución se marca "No cumple". No alcanzar una guía técnica se marca "Recomendación".

### Diferencias encontradas entre fuentes

| Parámetro | Res. 0330/2017 | RAS | HEC-22 |
| --- | --- | --- | --- |
| D mínimo del sifón, sanitario | 170 mm (Art. 158.2) | 200 mm (D.7.8.2) | No lo fija |
| D mínimo del sifón, pluvial | 280 mm (Art. 158.2) | 300 mm (D.7.8.2) | No lo fija |
| Pendiente máxima | 22,5° (Art. 158.4) | 22,5° (D.7.8.4) | 15 % en el tramo que sube (§8.4.3) |
| V en succión, alcantarillado | 0,9 a 1,5 m/s (Art. 161.2) | 0,45 m/s a tabla según D (D.8.4.8.2) | No lo fija |
| V en impulsión, alcantarillado | 1,5 a 2,4 m/s (Art. 161.3) | 1,0 a menos de 6 m/s (D.8.4.8.3) | No lo fija |
| Sumergencia, alcantarillado | 2,5·Ds (Art. 161.7) | Más de 2·Ds y mínimo 0,5 m (D.8.4.7.2) | Cualitativa (§12.1.5) |
| Margen de NPSH | 0,5 m (Art. 161.4) | 20 % y mínimo 0,5 m (D.8.5.3.2) | Cualitativo (§12.1.5) |
| V de llegada al pozo | Mínimo 0,60 m/s (Art. 160.6) | Máximo 0,7 m/s (D.8.4.7.4) | No la fija |

Las tablas B.8.2 y D.8.1 también difieren en el último renglón: "mayor que 400 mm" y "mayor a 300 mm". Para acueducto, de 300 a 400 mm la aplicación usa 1,70 m/s.

### Decisiones de modelo para revisar con el docente

1. **Reparto de caudal.** Por defecto cada conducto toma su incremento (Q1 = Qmin, Q2 = Qmed − Qmin, Q3 = Qmax − Qmed), porque el Art. 158.5 exige entradas reguladas por vertederos. También hay una opción de paralelo libre.
2. **Ecuación D.7.40.** El RAS define v1 como la "velocidad en la tubería de entrada al sifón". Aquí se usa la velocidad en el conducto del sifón.
3. **Ecuación D.7.43.** Se aplica como está impresa, hs = (A3/A2 − 1)·v²/2g. Da pérdidas altas en conductos pequeños frente al colector. Con HEC-22 (Ec. 9.5) resulta menor; la aplicación muestra ambos valores.
4. **Art. 141, 142, 149 y 150.** Se escribieron para colectores. Se aplican como recomendación en el sifón, apoyados en RAS D.7.8.2, y así se indica.
5. **Carga sobre vertederos y criterio de 90 % de η máxima.** Son criterios de diseño adoptados, no límites normativos.
6. **Art. 160.6 con RAS D.8.4.7.4.** Juntos dejan una franja estrecha, de 0,60 a 0,70 m/s, que se trata como obligatoria en alcantarillado.

### Valores por confirmar

La página de Joukowsky, Michaud y Francis debe confirmarse en el texto de hidráulica que use el grupo. El coeficiente C de Hazen-Williams, la relación de Poisson y el módulo E del concreto son valores iniciales editables. La lista de diámetros es de referencia: reemplácela por los diámetros internos reales del fabricante. El caso base es ilustrativo y no es el caso de verificación del docente.

## Licencias de terceros

Incluye Three.js (MIT), jsPDF (MIT), jsPDF-AutoTable (MIT), SheetJS Community Edition (Apache 2.0) y un subconjunto de la fuente DejaVu Sans (`vendor/DejaVu-LICENSE.txt`).
