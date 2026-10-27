# Comprobación de la primera versión

Fecha: 19 de octubre de 2026. Equipo Windows; Node 26.2.0.

- 8 pruebas automatizadas aprobadas: totales en centavos, saldo negativo, división por cero, filtro inclusivo, fechas imposibles, valores inválidos, respaldo/restauración, separación de demostración y duplicados.
- TypeScript y compilación de producción aprobados.
- Revisión en el navegador: carga del resumen, guardado de una jornada de práctica, guardado y edición de combustible, separación de datos reales, guardado real temporal y conservación al recargar, eliminación del registro temporal.
- Revisión visual en escritorio y con ancho de 390 píxeles. Esto verifica la adaptación del diseño; no es una prueba en Safari ni sincronización con un iPhone.
- El espacio real se entregó sin registros de prueba. La demostración mantiene los siete días ficticios.
- El respaldo y su validación tienen pruebas automatizadas. La selección de archivos y la restauración completa mediante la interfaz no se probaron de extremo a extremo.
- Instalación de dependencias con versiones fijas y package-lock.json. La auditoría de npm durante la instalación informó cero vulnerabilidades conocidas; no sustituye una auditoría de seguridad.
- Repositorio Git local, sin remoto ni publicación.

Pendiente para próximas etapas: CSV real de Uber, consumo mediante tanque lleno, sincronización autenticada con iPhone, modelo de IA y cualquier alojamiento remoto.

## Mejoras de octubre (27 de octubre de 2026)

Equipo Linux; Node 24.19.0.

- 45 pruebas automatizadas aprobadas (`npm test`), TypeScript y compilación de producción aprobados (`npm run build`).
- Migración: respaldo v1 anonimizado (`tests/fixtures/respaldo-v1-anonimizado.json`) se convierte a v2; la primera escritura copia el original a `uber-driver-ai:real:v1:respaldo-AAAA-MM-DD`; datos dañados no se sobrescriben; ida y vuelta de respaldo v2.
- Revisión en Chromium sin interfaz: carga de datos v1 en localStorage, guardado de jornada con odómetro (rechazo de odómetro invertido), copia de migración creada, validación de porcentajes, intervalos y avisos de mantenimiento, descarga del reporte mensual, vista de 390 px sin desplazamiento horizontal y sin errores de consola.
- No probado de extremo a extremo: importación de un CSV real de Uber con horas (solo muestras sintéticas en pruebas), restauración mediante el selector de archivos.
- Pendiente: mejora 9 (datos guardados en Umbrel), que requiere autorización de acceso de red.

## Despliegue en Coolify (27 de octubre de 2026)

- Imagen Docker construida y ejecutada localmente: `/health` responde 200 y el healthcheck del contenedor queda `healthy`; rutas como `/jornadas` caen en `index.html`.
- Encabezados verificados con curl: CSP, X-Frame-Options, nosniff, Referrer-Policy y Permissions-Policy en todas las respuestas; `index.html` con `no-cache` y `/assets/` con caché de un año (un solo Cache-Control).
- La aplicación carga en Chromium con la CSP activa, sin errores de consola, y la descarga del respaldo funciona.
- No probado: despliegue real en una instancia de Coolify ni el certificado HTTPS del dominio.
