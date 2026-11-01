# Prueba de viabilidad, fase 1a

Una página de prueba, sin catálogo ni funciones de negocio, con **datos sintéticos**. Sirve para comprobar en tu portátil y en tu navegador (Chrome o Edge) lo que condiciona todo el diseño.

## Ficheros

`index.html`, `style.css`, `app.js`, `core.js`, `db.js`, `bench.js`, más `DECISIONES.md`. Todos deben estar en la misma carpeta del alojamiento. No hay librerías externas ni peticiones a terceros.

## Cómo ponerla en una URL

No funciona abriendo `index.html` desde el disco (`file://`): hace falta una URL HTTPS. Sirve cualquier alojamiento estático. Como la decisión de alojamiento (D3) sigue abierta, usa uno provisional solo para esta prueba; por ejemplo, un repositorio de prueba en GitHub con Pages activado (con el plan gratuito, el repositorio es público: contendría solo estos ficheros, que no tienen datos reales). Quien use otro servicio debe subir los mismos ficheros.

Importante: los datos del navegador pertenecen a cada origen (la URL base). La prueba demuestra el comportamiento de tu navegador, pero si luego cambias de alojamiento habrá que repetir la comprobación en el origen definitivo.

## Protocolo de la prueba (unos 10 minutos)

Usa una ventana normal, no privada. Abre la página con Chrome o Edge.

1. **Entorno.** Mira la tarjeta 1: contexto seguro «sí», selector de ficheros y de carpetas «sí».
2. **Persistencia.** Pulsa «Solicitar persistencia» y anota la respuesta.
3. **Datos.** Pulsa «Generar y guardar» con los valores por defecto (40 jugadores × 60 sesiones × 5 repeticiones × 19 variables, unos 228.000 valores). Anota los tiempos y el espacio usado.
4. **Copia.** Pulsa «Guardar copia (elegir ubicación)» y guárdala en el USB. Repite en la carpeta sincronizada con la nube. Prueba también una copia comprimida y otra cifrada (contraseña de 8 caracteres o más).
5. **Carpeta recordada.** Pulsa «Elegir carpeta», escoge una, y luego «Guardar copia en la carpeta recordada». Si Chrome o Edge rechaza una carpeta, anótalo en el informe.
6. **Cierre y reapertura.** Cierra todas las ventanas del navegador, ábrelo de nuevo, abre la URL y comprueba que la tarjeta 3 dice que hay datos de una sesión anterior. Mira si la carpeta recordada pide volver a conceder permiso (es lo esperable).
7. **Restauración.** Pulsa «Borrar datos de prueba». Después, en la tarjeta 5, elige una copia, pulsa «Leer y validar», revisa el resumen y «Restaurar» y acepta el cuadro de confirmación. Debe indicar que la verificación coincide.
8. **Otro navegador o perfil (opcional).** Abre la URL en otro perfil o navegador: no deben aparecer los datos hasta que restaures una copia.
9. **Red.** Pulsa «Probar bloqueo de red»: debe decir «Correcto».
10. **Informe.** Pulsa «Copiar informe» y pégalo en el chat. No contiene datos de jugadores.

## Qué se ha probado ya y qué no

Probado por mí con datos sintéticos: la lógica de copia, compresión, cifrado, validación, detección de ficheros alterados, restauración idéntica y reversión si una restauración falla, sobre una IndexedDB simulada en Node, y el cableado de la interfaz en un navegador simulado.

**No se ha podido probar** lo que depende de un navegador real: la respuesta a la solicitud de persistencia, los selectores de ficheros y carpetas, la tolerancia al tamaño real, el comportamiento tras cerrar y reabrir, y que la política de seguridad bloquee la red. Eso es justo lo que comprueba esta prueba en tu portátil.

## Cuarta ronda (versión spike-1a7)

Cambian `index.html`, `app.js` y `core.js`; el resto no cambia respecto a la versión anterior. Sustitúyelos en el repositorio, recarga con Ctrl+F5 y comprueba que el informe indica `spike-1a7` (si pone otra versión, la página usa ficheros antiguos).

Novedad: la tarjeta 5 incluye un **ciclo automático** (copia en memoria → borrar → restaurar → verificar, sin cifrar y con gzip + cifrado) que mide cada paso con tus datos de prueba y lo deja registrado en el informe. Sustituye a los pasos manuales de borrar y restaurar, que no han llegado a quedar registrados en ningún informe.

Pasos (unos 5 minutos). No recargues la página entre ellos:

1. Si la base está vacía, «Generar y guardar» con los valores por defecto.
2. «Probar ciclo completo automático» y acepta el cuadro de confirmación. Tarda aproximadamente lo que tardó «Generar y guardar», dos veces.
3. «Ejecutar benchmark» con la escala «cota baja» (la que aún no has medido). Con las variantes por defecto.
4. Restauración desde un fichero real: en la tarjeta 5 elige una de las copias guardadas en tu carpeta, «Leer y validar», «Restaurar» y acepta la confirmación.
5. «Copiar informe» y pégalo en el chat.

Opcional: guarda la página en favoritos y pulsa «Solicitar persistencia» otra vez; y, tras cerrar todo Chrome y reabrirlo, pulsa «Guardar copia en la carpeta recordada» sin volver a elegir la carpeta (ahora solo has guardado después de elegirla de nuevo).

Pruebas realizadas por mí (Node con IndexedDB simulada, escala reducida): el ciclo, las seis variantes del benchmark, los casos de alteración, la copia con y sin cifrado, la reversión de una restauración fallida y la cancelación de cuadros de confirmación. Lo que depende de tu Chrome (tiempos, permisos) solo puede medirlo él.
