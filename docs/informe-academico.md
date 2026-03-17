# Informe Academico - FutTracker Pro

## Portada

- Titulo del proyecto: FutTracker Pro: Analisis Inteligente de Futbol con Vision por Computador
- Subtitulo: Deteccion y seguimiento de jugadores y balon en video usando OpenCV.js
- Autor(es): [Completar]
- Institucion: [Completar]
- Curso/Asignatura: [Completar]
- Docente: [Completar]
- Fecha: 17 de marzo de 2026

## Resumen

FutTracker Pro es un prototipo web de analisis de partidos de futbol mediante tecnicas de vision por computador. El sistema procesa video en navegador con OpenCV.js para detectar jugadores, arbitro y balon, estimar posesion e inferir formaciones, incorporando una calibracion por homografia para proyectar eventos al espacio real del campo. Como resultado, se obtiene una herramienta interpretable y de bajo costo para apoyo academico en analisis tactico.

Palabras clave: vision por computador, OpenCV.js, futbol, homografia, analisis tactico.

## Introduccion

El analisis de rendimiento en futbol requiere informacion espacial y temporal de alta calidad. Sin embargo, los sistemas comerciales de tracking suelen ser costosos y poco accesibles en contextos academicos. Este proyecto plantea una alternativa basada en video convencional y procesamiento de imagen en navegador.

La propuesta busca automatizar la extraccion de indicadores tacticos, reduciendo subjetividad y tiempo de analisis manual.

Objetivo general:

- Desarrollar un sistema web capaz de detectar elementos clave del juego y generar metricas tacticas en tiempo casi real.

Objetivos especificos:

- Detectar jugadores y balon a partir de segmentacion de color y contornos.
- Diferenciar equipos mediante clustering por color.
- Estimar posesion de balon por proximidad.
- Aproximar formaciones con base en distribucion espacial.
- Proyectar detecciones al campo real mediante homografia.

## Contenido

### Marco teorico

1. Vision por computador: analisis frame a frame para convertir pixeles en variables medibles.
2. Espacios de color HSV: robustez mayor ante cambios de iluminacion respecto a RGB para tareas de segmentacion.
3. Operaciones morfologicas: apertura y cierre para eliminar ruido y consolidar regiones.
4. Deteccion de contornos: identificacion de blobs candidatos por caracteristicas geometricas.
5. Clustering k-means: agrupacion no supervisada de colores para separar equipos y arbitro.
6. Homografia planar: transformacion proyectiva entre plano de imagen y plano del campo.
7. Flujo optico Lucas-Kanade: seguimiento de puntos de referencia para compensar paneo.

### Metodologia y arquitectura

Pipeline general:

1. Ingreso de video.
2. Captura de frame en canvas.
3. Ajuste de contraste y umbralizacion HSV.
4. Filtrado morfologico y mascara de campo.
5. Deteccion de contornos de jugadores y balon.
6. Clasificacion por color de uniforme.
7. Estimacion de posesion y formacion.
8. Proyeccion al campo real con homografia.
9. Visualizacion de overlays y paneles debug.

### Tabla de modulos

| Modulo | Funcion principal | Entrada | Salida |
|---|---|---|---|
| Preprocesamiento | Mejorar separabilidad de objetos | Frame RGB(A) | Frame mejorado y mascara |
| Deteccion de jugadores | Encontrar candidatos de jugadores | Mascara de campo | Bounding boxes de jugadores |
| Deteccion de balon | Identificar blob de balon | Mascara de campo para balon | Bounding box del balon |
| Clasificacion por color | Separar equipo A/B y arbitro | Colores medios de candidatos | Etiquetas por equipo |
| Analisis tactico | Calcular posesion y formacion | Posiciones de jugadores y balon | Porcentajes y formaciones |
| Homografia y territorial | Mapear a campo real y generar barra 1D | Puntos calibrados + detecciones | Inclinacion territorial |

### Tabla de parametros relevantes

| Parametro | Descripcion | Rango/Valor | Impacto |
|---|---|---|---|
| Contraste jugadores | Ganancia de contraste para umbralizacion de jugadores | 0.5x a 2.0x | Sensibilidad en deteccion de jugadores |
| Contraste balon | Ganancia de contraste para umbralizacion de balon | 0.5x a 2.0x | Sensibilidad en deteccion de balon |
| Area de balon | Filtro de area de contornos del balon | Aproximado 6 a 140 px | Reduce falsos positivos |
| Circularidad de balon | Filtro de forma circular | Umbral minimo aprox. 0.5 | Mejora precision de balon |
| Radio de snap | Ajuste a franjas blancas en calibracion | 10 a 600 px | Estabilidad de homografia |
| Decaimiento histograma | Memoria temporal de barra territorial | 0.985 | Suaviza variaciones entre frames |

## Resultados

### Resultados cualitativos

- Deteccion estable de jugadores y arbitro en escenas con iluminacion adecuada.
- Deteccion de balon razonable en planos intermedios y cercanos.
- Clasificacion inicial de equipos por color con buena interpretabilidad.
- Visualizacion continua de posesion y formaciones.
- Proyeccion territorial funcional tras calibracion de homografia.

### Resultados cuantitativos (plantilla para completar)

| Indicador | Video 1 | Video 2 | Video 3 | Promedio |
|---|---:|---:|---:|---:|
| Precision deteccion de jugadores (%) | [ ] | [ ] | [ ] | [ ] |
| Recall deteccion de jugadores (%) | [ ] | [ ] | [ ] | [ ] |
| Precision deteccion de balon (%) | [ ] | [ ] | [ ] | [ ] |
| Error posesion vs referencia (%) | [ ] | [ ] | [ ] | [ ] |
| Estabilidad de formacion (score) | [ ] | [ ] | [ ] | [ ] |

### Evidencia visual sugerida

Inserta capturas con nombres sugeridos:

1. Figura 1: Vista original y procesada lado a lado.
2. Figura 2: Paso de umbralizacion y morfologia.
3. Figura 3: Bounding boxes por equipo y arbitro.
4. Figura 4: Deteccion del balon.
5. Figura 5: Calibracion de homografia con 4 puntos.
6. Figura 6: Barra territorial 1D en juego activo.

Plantilla de insercion:

![Figura X - Descripcion](../public/video/figura-x.png)

Nota: reemplazar la ruta por la ubicacion real de cada imagen.

## Discusion

Fortalezas:

- Implementacion ejecutable en navegador sin infraestructura compleja.
- Pipeline interpretable y modular para aprendizaje academico.
- Herramientas de depuracion visual por etapas.

Limitaciones:

- Sensibilidad a calidad de video, sombras, oclusiones y perspectiva.
- Posibles errores de clasificacion cuando colores son similares.
- Deteccion de balon mas desafiante en tomas lejanas.

## Conclusion

FutTracker Pro valida la viabilidad de realizar analisis tactico asistido con tecnologias web y OpenCV.js. Aunque se trata de un prototipo, el sistema ofrece una base funcional para aplicaciones academicas, demostraciones tecnicas y evolucion hacia soluciones con mayor robustez.

## Trabajo futuro

1. Integrar seguimiento multiobjeto con identidad persistente.
2. Incorporar modelos de deteccion basados en deep learning.
3. Implementar evaluacion formal con dataset etiquetado.
4. Mejorar robustez del balon pequeno y escenas de alto ruido.

## Referencias (formato sugerido)

- Bradski, G., and Kaehler, A. Learning OpenCV.
- Szeliski, R. Computer Vision: Algorithms and Applications.
- Documentacion oficial de OpenCV.js.
- Articulos de analisis tactico en futbol basados en vision por computador.

## Anexo A - Guion breve para exposicion

- Portada: contexto, problema y objetivo general.
- Introduccion: motivacion, impacto y alcance.
- Contenido: pipeline tecnico y fundamentos teoricos.
- Resultados: evidencias y metricas.
- Conclusion: aportes, limitaciones y mejoras futuras.
