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
7. **Restauración.** Pulsa «Borrar datos de prueba». Después, en la tarjeta 5, elige una copia, pulsa «Leer y validar», revisa el resumen y «Restaurar». Debe indicar que la verificación coincide.
8. **Otro navegador o perfil (opcional).** Abre la URL en otro perfil o navegador: no deben aparecer los datos hasta que restaures una copia.
9. **Red.** Pulsa «Probar bloqueo de red»: debe decir «Correcto».
10. **Informe.** Pulsa «Copiar informe» y pégalo en el chat. No contiene datos de jugadores.

## Qué se ha probado ya y qué no

Probado por mí con datos sintéticos: la lógica de copia, compresión, cifrado, validación, detección de ficheros alterados, restauración idéntica y reversión si una restauración falla, sobre una IndexedDB simulada en Node, y el cableado de la interfaz en un navegador simulado.

**No se ha podido probar** lo que depende de un navegador real: la respuesta a la solicitud de persistencia, los selectores de ficheros y carpetas, la tolerancia al tamaño real, el comportamiento tras cerrar y reabrir, y que la política de seguridad bloquee la red. Eso es justo lo que comprueba esta prueba en tu portátil.

## Tercera ronda (versión spike-1a5)

Sustituye en el repositorio estos cinco ficheros: `index.html`, `style.css`, `app.js`, `core.js` y `bench.js` (`db.js` no cambia). Recarga con Ctrl+F5 y comprueba que el informe indica `spike-1a5`. Tus datos de prueba anteriores se conservan.

Qué cambia:

- **Informe con cronología.** Ahora incluye `eventos` (qué operaciones hiciste y en qué orden), el historial completo de copias (`copias`), de restauraciones (`restauraciones`: con recuentos antes y después, tiempo y si la verificación coincide), de borrados y de guardados en carpeta. El estado de la carpeta se registra por separado al abrir (`carpetaAlAbrir`), tras elegirla (`carpetaTrasElegir`) y tras guardar (`carpetaTrasGuardar`), para distinguir si el permiso se conserva entre sesiones.
- **Benchmark con tu volumen.** Escalas basadas en lo que has indicado (4 temporadas × 25 jugadores = 100 temporadas-jugador, 15 sesiones cada una): cota alta (5 repeticiones y 19 variables por sesión, 142.500 valores), cota baja (3 repeticiones y 3 variables, 13.500 valores) y la escala grande anterior. Por defecto solo se ejecutan V2 (filas largas), V4 (filas anchas con lista) y la nueva V6 (filas anchas con un objeto por identificador de variable, v000…), porque V1, V3 y V5 ya están medidas; se pueden incluir con la casilla.
- **Informe del benchmark más corto.** Cada variante muestra los recuentos, las diferencias y si coinciden los resúmenes SHA-256; el detalle completo con ejemplos solo aparece si una verificación falla.

Pasos (unos 15 minutos):

1. **Ciclo de restauración.** Con datos de prueba en la base: «Guardar copia (elegir ubicación)»; «Borrar datos de prueba»; en la tarjeta 5 elige esa copia, «Leer y validar», «Restaurar». Debe indicar que la verificación coincide.
2. **Copia cifrada.** Marca «Cifrar con contraseña» (8 caracteres o más), guarda una copia, borra los datos y restáurala con su contraseña.
3. **Carpeta recordada.** «Elegir carpeta» (si ya hay una, vale la recordada). Cierra todas las ventanas de Chrome, reábrelo, abre la URL y pulsa «Guardar copia en la carpeta recordada».
4. **Persistencia (opcional).** Guarda la página en favoritos y pulsa de nuevo «Solicitar persistencia».
5. **Benchmark.** Escala «cota alta» con las variantes por defecto, y después «cota baja». Sin cerrar la pestaña.
6. «Copiar informe» y pégalo en el chat.

Pruebas realizadas por mí (Node con IndexedDB simulada, escala reducida): las seis variantes verifican; se detectan intercambios dentro de una repetición y entre repeticiones de la misma sesión, filas o claves perdidas, claves sobrantes, pares duplicados y cambios de 0,001; y se cubren los casos de durabilidad. La copia, el cifrado, la restauración y la reversión de una restauración fallida también están probados. No he ejecutado el benchmark completo, porque depende de tu Chrome.
