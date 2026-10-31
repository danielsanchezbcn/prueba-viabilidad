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

## Segunda ronda (versión spike-1a4)

Cambios respecto a la entrega anterior: `bench.js` rehecho, y cambios en `app.js`, `core.js` e `index.html` (texto de la tarjeta 7). Sustituye esos cuatro ficheros en el repositorio; `db.js` y `style.css` no cambian. Después recarga la página forzando la caché (Ctrl+F5) y comprueba que el informe indica la versión `spike-1a4`. Tus datos de prueba anteriores se conservan, porque la URL no cambia.

Qué hace ahora el benchmark (siempre en bases temporales, que se borran al terminar; no toca tus datos de prueba ni el modelo de datos principal):

- Calcula una referencia a partir de los datos de origen y, tras guardar cada variante, lee lo guardado y compara: recuento de filas (con `count()` y con las filas leídas), recuento de valores, resultados por sesión, por variable y por sesión × variable (n y suma exacta en milésimas) y un resumen SHA-256 del conjunto. Ya no se usa una media global única.
- Compara además cada par repetición × variable (valor esperado frente a valor leído, en variantes long y wide). El informe indica cuántos pares se comprobaron, cuántos difieren (faltantes, sobrantes, con valor distinto o duplicados), hasta cinco ejemplos con repetición, variable, valor esperado y valor leído, y el resumen SHA-256 de los pares.
- Para las variantes con durabilidad relajada, el informe indica si el navegador aceptó la opción y qué durabilidad efectiva declara la transacción. Si el navegador no la expone, el informe dice «no verificable» en lugar de suponer que se aplicó.
- Por separado, se miden la escritura, la lectura y la agregación en memoria.

Pasos que faltan del protocolo y el nuevo:

1. Pulsa «Solicitar persistencia» y anota la respuesta.
2. Cierra todas las ventanas de Chrome, ábrelo de nuevo y abre la URL: la tarjeta 3 debe indicar que hay datos de una sesión anterior, y la tarjeta 4 si la carpeta recordada pide permiso otra vez.
3. «Guardar copia en la carpeta recordada» y una copia cifrada con contraseña.
4. «Borrar datos de prueba», luego restaurar una copia (tarjeta 5) hasta que diga que la verificación coincide.
5. «Ejecutar benchmark» (tarjeta 7): entre uno y tres minutos, sin cerrar la pestaña.
6. «Copiar informe» y pégalo en el chat.

Pruebas realizadas por mí (Node con IndexedDB simulada, escala reducida de 4 jugadores × 6 sesiones): las cinco variantes verifican correctamente; se detectan un intercambio de dos variables dentro de una repetición (que la media global no detectaba), un intercambio del valor de una variable entre dos repeticiones de la misma sesión (que solo detecta la comparación por par), una fila perdida, un par duplicado, un valor sobrante, un cambio de 0,001 y un valor nulo; y se cubren los casos de durabilidad aplicada, no aplicada, rechazada y no verificable. Lo que depende del navegador real (tiempos, durabilidad efectiva) solo puede medirlo tu Chrome.
