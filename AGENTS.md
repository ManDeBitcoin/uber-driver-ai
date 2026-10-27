# Stonic Driver AI

Aplicación personal local para un conductor principiante en Windows, con Kia Stonic en Guayaquil.

- Explica los cambios en español y con pasos breves y concretos.
- Mantén React + TypeScript y el arranque mediante INICIAR.cmd. Usa npm.cmd en PowerShell.
- Ejecuta npm.cmd test y npm.cmd run build cuando cambies cálculos, almacenamiento o formularios.
- Conserva la separación de demostración y datos reales. No sobrescribas datos dañados al iniciar.
- El almacenamiento real está en localStorage, clave uber-driver-ai:real:v1, con formato interno version 2. Se migra solo desde version 1 y desde stonic-driver-ai:real:v1; antes de la primera escritura se copia el original en uber-driver-ai:real:v1:respaldo-AAAA-MM-DD. Cambiar la clave o el formato exige migración y respaldo.
- Usa USD, kilómetros, galones estadounidenses y fechas locales de America/Guayaquil.
- Distingue ingresos del conductor, compras de combustible y saldo registrado. No etiquetes el saldo como utilidad neta.
- Mantén el servidor en 127.0.0.1:5173 con strictPort para conservar el origen del almacenamiento.
- No agregues conexiones con Uber, scraping, captura de pantalla ni automatización de viajes. No solicites credenciales de Uber.
- La importación CSV es una etapa posterior: requiere una muestra anonimizada y vista previa, validación y deduplicación antes de guardar.
- La versión actual no llama a un modelo de IA y no requiere API keys. No incluyas claves en el frontend.
- No publiques código o datos ni actives acceso de red externo salvo que el usuario lo solicite.
- No incluyas datos personales, CSV ni respaldos reales en Git. El proyecto se mantiene local y privado.
