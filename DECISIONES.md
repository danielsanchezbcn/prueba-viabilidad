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
- Datos encontrados al reabrir la página: sí. Ciclo completo de restauración, copia cifrada y carpeta recordada entre sesiones: pendientes de registrar.

## Cambios

- 2026-10-31: fase 1a (prueba de viabilidad), versión `spike-1a`.
- 2026-10-31: tercera ronda, versión `spike-1a5`: cronología de eventos e historiales en el informe, escalas basadas en el volumen del usuario, variante V6 (objeto por identificador de variable) y informe del benchmark resumido. El modelo de datos principal no se ha modificado.
- 2026-10-31: segunda ronda, versión `spike-1a4`: benchmark de escritura con verificación por sesión y variable, y por cada par repetición × variable, contra los datos de origen, y registro de la durabilidad efectiva. El modelo de datos principal no se ha modificado.
