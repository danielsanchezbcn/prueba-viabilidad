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

## Cambios

- 2026-10-31: fase 1a (prueba de viabilidad), versión `spike-1a`.
- 2026-10-31: segunda ronda, versión `spike-1a4`: benchmark de escritura con verificación por sesión y variable, y por cada par repetición × variable, contra los datos de origen, y registro de la durabilidad efectiva. El modelo de datos principal no se ha modificado.
