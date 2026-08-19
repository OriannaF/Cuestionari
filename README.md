# Cuestionario · GitHub Pages

Cuestionario de opción múltiple (de 2 a 8 opciones, con varias respuestas correctas) que se arma desde un archivo CSV y se publica gratis en GitHub Pages. Todo corre en el navegador: sin servidor, sin base de datos.

## Publicarlo

1. Subí esta carpeta a un repositorio de GitHub (o usá el que ya tenés).
2. En GitHub: **Settings → Pages → Source: Deploy from a branch → Rama `main` (`/root`)** → Save.
3. En pocos minutos estará en `https://TU-USUARIO.github.io/TU-REPO/`.

Al abrir la página se recupera el último CSV que cargaste (guardado localmente en tu navegador) o, si no, te pide que subas uno. También podés dejar un archivo `data/cuestionario.csv` en el repo: si existe, se usa en primer lugar.

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

- Máximo **1000 preguntas** por archivo.
- Mínimo 2 opciones, máximo 8; al menos una correcta.
- El delimitador puede ser `,`, `;` o tabulación (se detecta solo). Se aceptan comillas alrededor de un campo y comas dentro del campo entrecomillado.
- Los nombres de columna toleran variantes: `pregunta/question/enunciado`, `categoria/category/tema`, `correctas/respuestas/answer(s)`, `explicacion/explanation/nota` (sin tildes, se normalizan).

### Imágenes en preguntas, opciones y explicaciones

Para incluir una imagen escribí dentro del texto de cualquier celda (pregunta, opción o explicación):

```
![texto opcional](ruta-de-la-imagen)
```

Ejemplo:

```
pregunta,categoria,opcion1,opcion2,opcion3,correctas,explicacion
"Dado el siguiente diagrama. La relación E representa: ![diagrama](img/diagrama-e.png)","UML","Generalizacion","Asociacion","<<extend>>","3","Es una asociación, ver ![resumen](img/resumen.png)"
```

- La ruta puede ser relativa (ej. `img/diagrama.png`, `./img/x.jpg`, `../img/y.gif`) o absoluta (`https://...`, `//cdn...`, `data:image/png;base64,...`).
- Las rutas relativas se resuelven contra la página, así que conviene subir las imágenes junto al CSV (ej. en una carpeta `img/` al lado de `data/cuestionario.csv`) y usar rutas como `../img/...` o absolutas.
- La imagen se muestra dentro de la pregunta, debajo del texto de la opción, o dentro de la explicación en los resultados.

### Preguntas con respuestas desplegables (dropdown)

En vez de opciones a marcar, la pregunta puede pedir completar espacios con un menú desplegable por espacio:

```
pregunta,categoria,respuesta1,respuesta2,respuesta3,opciones,explicacion
"La capital de Francia es ___ y la de Italia es ___.","Geo","París","Roma","","París;Berlín;Madrid;Roma;Londres","Ver apunte"
```

| Columna | Obligatoria | Descripción |
|---|---|---|
| `respuesta1` … `respuestaN` | sí (al menos 1) | Texto de la respuesta correcta en esa posición |
| `opciones` | sí (mínimo 2) | Todas las opciones posibles del desplegable, separadas por `;` (o `\|`) |

- Cada valor de `respuestaN` debe coincidir textualmente con una de las opciones de la columna `opciones`; si no coincide o falta la columna, la fila se omite con un aviso.
- El puntaje de una pregunta dropdown es `1 / cant. de respuestas` por cada espacio correcto, y se descuenta lo mismo por cada espacio mal respondido (los espacios sin responder suman 0).
- Un mismo archivo puede combinar preguntas con `opcion1…opcion8` + `correctas` y preguntas con `respuesta1…` + `opciones`; cada fila se interpreta según sus columnas.

### Preguntas de completar (fill)

Si el encabezado **no tiene columnas de opciones ni `respuesta1…N`**, el archivo se interpreta como preguntas de escribir la respuesta en un cuadro de texto. La columna `correctas` lleva la o las respuestas correctas como **texto literal**; para aceptar más de una variante separalas con `;` (o `|`):

```
pregunta,categoria,correctas,explicacion
"¿Cuál es la capital de Francia?","Geo","París","Ver apunte"
"Código del país","Geo","ARG;Argentina;República Argentina",""
```

- La comparación ignora mayúsculas, tildes y espacios extra (ej. `paris`, `PARÍS` y `parís ` son todas correctas).
- Puntaje: +1 si la respuesta escrita coincide, −1 si no coincide (y no está vacía), 0 si se deja vacía.
- Un archivo fill no puede mezclarse con preguntas de opciones o dropdown: si el encabezado tiene `opcion1…` u `opciones` + `respuesta1…`, el resto de las filas siguen esas reglas.

## Cómo funciona

- **Sin feedback durante la sesión**: no se muestra cuál es la opción correcta hasta que finalizás todas las preguntas.
- **Randomización en cada intento**: el orden de las preguntas y el de las opciones (con sus letras) se barajan con Fisher‑Yates cada vez que iniciás una sesión o la repetís.
- **División en sesiones**: elegís el **tipo de sesión** (Para hoy / Aleatorias / Solo nuevas / Solo falladas / Todas) y un **tope por sesión** (15, 20, 25, 30, 40, 50 o sin tope). "Para hoy" toma las nunca vistas más las vencidas, ordenadas de más débiles a más fuertes.
- **Espaciado inteligente**: al planificar un repaso, si el día destino ya tiene muchas tarjetas el algoritmo lo corre al día siguiente con espacio, para que la carga diaria quede pareja (≈ 1 tarjeta cada 30).
- **Fecha del parcial**: cada cuestionario puede tener su propia fecha límite (y cada tema/categoría la suya, con herencia: si un tema no tiene fecha usa la del cuestionario). Las tarjetas nunca se planifican después de esas fechas (los intervalos se recortan a los días restantes) y el inicio te muestra la próxima fecha (en rojo si faltan 3 o menos). Las fechas se guardan por cuestionario (por contenido del CSV), así cada materia conserva la suya al cambiar de CSV.
- **Calendario de repasos**: en el inicio hay un calendario mensual con la cantidad de preguntas planificadas por día; al hacer clic en un día se listan esas preguntas. Los días con fecha de parcial se marcan.
- **Puntaje con penalización** (puntos por pregunta, por defecto 1): si la pregunta tiene `c` respuestas correctas, cada correcta marcada suma `1/c` puntos y cada incorrecta marcada resta `1/c`. Las correctas que no marcas no suman ni restan. El puntaje de una pregunta puede ser negativo si marcás más incorrectas que correctas.
  - Ejemplo: pregunta de 1 punto con 4 correctas, marcás 3 bien y 1 mal → `3/4 − 1/4 = 0,5` puntos.
- **Algoritmo de repetición espaciada (SM‑2 simplificado)**: cada pregunta guarda en tu navegador (localStorage) su facilidad, intervalo, próxima fecha, intentos y fallos.
  - Respuesta perfecta → el intervalo crece (1, 2, 4, 8… días, hasta 90, ajustado por la facilidad).
  - Parcial o incorrecta → se resetea y vuelve a aparecer al día siguiente.
  - La sesión toma primero las nunca vistas y las vencidas (ordenadas de más débiles a más fuertes) y completa con el resto.
  - Por eso conviene estudiar un poco todos los días: el algoritmo te hace repasar justo lo que estás por olvidar.
- **Resultados**: puntaje total (y porcentaje) al finalizar, desglose pregunta por pregunta con tus marcas vs. las correctas, y explicaciones. Podés finalizar aunque queden preguntas sin responder (las sin responder valen 0 y cuentan como falladas). Botones para repetir las mismas preguntas, repetir solo las falladas o empezar otra sesión.
- **Estadísticas**: pendientes, dominadas, falladas y desempeño por categoría.

## Progreso guardado

- El progreso queda en el navegador donde estudias (localStorage), identificado por el contenido del CSV. Si cambiás el CSV, arranca un progreso nuevo (el anterior no se pierde).
- El último CSV cargado también se guarda en el navegador: al reabrir la página tenés las mismas preguntas, sin volver a subirlo.
- Si salís a mitad de sesión, tus respuestas quedan guardadas y podés continuarlas desde el inicio.
- Borrar los datos del sitio desde el navegador resetea todo el progreso y el CSV guardado.
- Para estudiar en otro dispositivo hay que repetir el progreso ahí (o exportar/importar `localStorage`).

## Estructura

```
├── index.html            # página única
├── css/style.css
├── js/csv.js             # parser CSV y validación (máx. 1000 preguntas, 8 opciones)
├── js/scheduler.js       # repetición espaciada + barajar (Fisher-Yates)
├── js/quiz.js            # sesiones, puntaje con penalización, persistencia
├── js/storage.js         # localStorage (progreso y último CSV cargado)
├── js/ui.js              # vistas
```

## Sugerencias

- **Vos hiciste tu CSV en Excel/Google Sheets**: exportá como CSV (UTF‑8). Si usa `;` como separador, se detecta automáticamente.
- Para preguntas largas, poné el enunciado entre comillas en el CSV.
- Si querés que la página incluya un CSV de una vez (sin depender del navegador), borrá el archivo `data/cuestionario.csv` reemplazándolo por el tuyo y volvé a pushear.