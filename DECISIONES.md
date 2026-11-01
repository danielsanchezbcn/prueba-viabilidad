# Registro de decisiones

| Id | Decisión | Estado | Fecha |
|---|---|---|---|
| D1 | Pila: JavaScript con módulos ES, sin compilación, librerías con versión fija | Aprobada (visto bueno al diseño) | 2026-10-31 |
| D2 | Navegador de uso: Chrome o Edge, con copia a carpeta elegida | Decidida | 2026-10-31 |
| D3 | Alojamiento de la URL | Aplazada hasta tener el resultado de la prueba 1a | 2026-10-31 |
| D7 | Cifrado de copias con contraseña | Opcional al crear la copia | 2026-10-31 |
| D4, D5, D6 | Manifestación por variable; resultado de sesión en perfiles de carga; lado como atributo de la repetición | Pendientes (antes de la fase 2) | |

## Resultados de la prueba 1a (primera ronda, Chrome 156, Windows)

- Copia gzip guardada en ubicación elegida, con tamaño verificado: correcto.
- Bloqueo de red por CSP: 2 de 2 intentos bloqueados.
- Guardar 228.000 valores sintéticos en filas largas con 3 índices: unos 40 s. Pendiente de comparar formas de guardado (benchmark).
- Persistencia, reapertura, restauración y carpeta recordada entre sesiones: pendientes.

## Volumen esperado (indicado por el usuario)

4 temporadas; cada temporada 10 jugadores nuevos y 15 que se repiten de la anterior; 15 tests por jugador y temporada. Pendiente de definir: repeticiones por test y variables por test (de ellas depende el número de valores).

## Resultados de la segunda ronda (spike-1a4, Chrome 156, Windows)

- Las cinco variantes del benchmark verificaron correctamente (228.000 valores, 228.000 pares repetición × variable, resúmenes SHA-256 coincidentes).
- Escritura de 228.000 valores: filas largas ≈26 s (con o sin índices; la durabilidad relajada no mostró mejora apreciable en una sola medición); filas anchas ≈1,8 s. Lectura: ≈1,3–2,5 s frente a ≈0,12 s.
- Persistencia: Chrome respondió «no» a la solicitud.
- Datos encontrados al reabrir la página: sí (creados a las 14:36 UTC y presentes al abrir a las 20:29 UTC, más de seis horas después). Ciclo completo de restauración, copia cifrada y carpeta recordada entre sesiones: pendientes de registrar.
- Repetición del benchmark (misma versión, segunda ejecución): V1 25,2 s, V2 22,3 s, V3 22,6 s, V4 1,8 s, V5 1,7 s; variación entre ejecuciones del 4 al 18 % en las filas largas.

## Resultados de la tercera ronda (spike-1a6, Chrome 156, Windows, 1 de noviembre)

- Las seis variantes verificaron correctamente en las dos escalas ejecutadas (142.500 y 228.000 valores; cada par repetición × variable comprobado).
- Cota alta del volumen del usuario (142.500 valores): escritura V2 filas largas 20,2 s; V4 filas anchas con lista 2,4 s; V6 filas anchas con objeto por identificador de variable 1,6 s. Lectura: 1,7 s frente a 0,11 s. La cota baja (13.500 valores) no se ha ejecutado.
- Escala grande (228.000): V1 26,1 s; V2 23,2 s; V3 23,8 s; V4 2,1 s; V5 1,4 s; V6 1,4 s. V6 no mostró penalización frente a la lista.
- Tres ejecuciones de V1–V5 a 228.000: sin diferencia sistemática entre variantes con y sin durabilidad relajada.
- Guardar con el modelo actual (filas largas con índices, vaciando antes): 30–41 s a 228.000 valores en las cuatro mediciones.
- Carpeta recordada: el navegador conserva la referencia entre sesiones; al abrir, el permiso figura como «prompt» y tras elegirla de nuevo, «granted». Guardado en carpeta con tamaño verificado.
- Datos creados el 31/10 a las 20:33 UTC encontrados al abrir el 1/11 a las 15:43 UTC.
- Persistencia: tercera respuesta «no».
- Decisión pendiente D8: forma de guardar las repeticiones (filas largas frente a una fila por repetición con objeto por identificador de variable). No se ha cambiado el modelo.

## Cambios

- 2026-10-31: fase 1a (prueba de viabilidad), versión `spike-1a`.
- 2026-11-01: cuarta ronda, versión `spike-1a7`: ciclo automático copia → borrar → restaurar → verificar con tiempos por paso.
- 2026-10-31: tercera ronda, versión `spike-1a6`: cronología de eventos e historiales en el informe, escalas basadas en el volumen del usuario, variante V6 (objeto por identificador de variable) informe del benchmark resumido y registro con errores y cancelaciones dentro del informe. El modelo de datos principal no se ha modificado.
- 2026-10-31: segunda ronda, versión `spike-1a4`: benchmark de escritura con verificación por sesión y variable, y por cada par repetición × variable, contra los datos de origen, y registro de la durabilidad efectiva. El modelo de datos principal no se ha modificado.
