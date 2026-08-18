# Cuestionario · GitHub Pages

Cuestionario de opción múltiple (de 2 a 8 opciones, con varias respuestas correctas) que se arma desde un archivo CSV y se publica gratis en GitHub Pages. Todo corre en el navegador: sin servidor, sin base de datos.

## Publicarlo

1. Subí esta carpeta a un repositorio de GitHub (o usá el que ya tenés).
2. En GitHub: **Settings → Pages → Source: Deploy from a branch → Rama `main` (`/root`)** → Save.
3. En pocos minutos estará en `https://TU-USUARIO.github.io/TU-REPO/`.

Al abrir la página se carga automáticamente el archivo `data/cuestionario.csv`. Para usar tus propias preguntas, reemplazá ese archivo (y volvé a pushear), o cargá un CSV manualmente desde la página (también funciona arrastrando y soltando).

## Formato del CSV

Una fila por pregunta. La primera fila es el encabezado:

```
pregunta,categoria,opcion1,opcion2,opcion3,opcion4,opcion5,opcion6,opcion7,opcion8,correctas,explicacion
```

| Columna | Obligatoria | Descripción |
|---|---|---|
| `pregunta` | sí | Enunciado de la pregunta |
| `categoria` | no | Tema; se usa para las estadísticas |
| `opcion1` … `opcion8` | sí (2 a 8) | Las opciones, una por columna |
| `correctas` | sí | Índices (1‑based) de las correctas separados por `;` (ej. `1;3;5`) |
| `explicacion` | no | Se muestra al finalizar el cuestionario |

Reglas y tolerancias:

- Máximo **200 preguntas** por archivo.
- Mínimo 2 opciones, máximo 8; al menos una correcta.
- El delimitador puede ser `,`, `;` o tabulación (se detecta solo). Se aceptan comillas alrededor de un campo y comas dentro del campo entrecomillado.
- Los nombres de columna toleran variantes: `pregunta/question/enunciado`, `categoria/category/tema`, `correctas/respuestas/answer(s)`, `explicacion/explanation/nota` (sin tildes, se normalizan).

## Cómo funciona

- **Sin feedback durante la sesión**: no se muestra cuál es la opción correcta hasta que finalizás todas las preguntas.
- **Randomización en cada intento**: el orden de las preguntas y el de las opciones (con sus letras) se barajan con Fisher‑Yates cada vez que iniciás una sesión o la repetís.
- **División en sesiones**: con muchos temas la sesión se arma con el tamaño que elijas (15, 20, 25, 30, 40, 50 o todas). Las sesiones priorizan lo que tenés más flojo.
- **Puntaje con penalización** (puntos por pregunta, por defecto 1): si la pregunta tiene `c` respuestas correctas, cada correcta marcada suma `1/c` puntos y cada incorrecta marcada resta `1/c`. Las correctas que no marcas no suman ni restan. El mínimo por pregunta es 0.
  - Ejemplo: pregunta de 1 punto con 4 correctas, marcás 3 bien y 1 mal → `3/4 − 1/4 = 0,5` puntos.
- **Algoritmo de repetición espaciada (SM‑2 simplificado)**: cada pregunta guarda en tu navegador (localStorage) su facilidad, intervalo, próxima fecha, intentos y fallos.
  - Respuesta perfecta → el intervalo crece (1, 2, 4, 8… días, hasta 90, ajustado por la facilidad).
  - Parcial o incorrecta → se resetea y vuelve a aparecer al día siguiente.
  - La sesión toma primero las nunca vistas y las vencidas (ordenadas de más débiles a más fuertes) y completa con el resto.
  - Por eso conviene estudiar un poco todos los días: el algoritmo te hace repasar justo lo que estás por olvidar.
- **Resultados**: puntaje total (y porcentaje) al finalizar, desglose pregunta por pregunta con tus marcas vs. las correctas, y explicaciones. Botones para repetir las mismas preguntas, repetir solo las falladas o empezar otra sesión.
- **Estadísticas**: pendientes, dominadas, falladas y desempeño por categoría.

## Progreso guardado

- El progreso queda en el navegador donde estudias (localStorage), identificado por el contenido del CSV. Si cambiás el CSV, arranca un progreso nuevo (el anterior no se pierde).
- Si salís a mitad de sesión, tus respuestas quedan guardadas y podés continuarlas desde el inicio.
- Borrar los datos del sitio desde el navegador resetea todo el progreso.
- Para estudiar en otro dispositivo hay que repetir el progreso ahí (o exportar/importar `localStorage`).

## Estructura

```
├── index.html            # página única
├── css/style.css
├── js/csv.js             # parser CSV y validación (máx. 200 preguntas, 8 opciones)
├── js/scheduler.js       # repetición espaciada + barajar (Fisher-Yates)
├── js/quiz.js            # sesiones, puntaje con penalización, persistencia
├── js/storage.js         # localStorage
├── js/ui.js              # vistas
└── data/cuestionario.csv # plantilla de ejemplo (reemplazala por la tuya)
```

## Sugerencias

- **Vos hiciste tu CSV en Excel/Google Sheets**: exportá como CSV (UTF‑8). Si usa `;` como separador, se detecta automáticamente.
- Para preguntas largas, poné el enunciado entre comillas en el CSV.
- La plantilla incluida es solo un ejemplo: borrá todo y poné tus 200 preguntas en `data/cuestionario.csv` y volvé a pushear.