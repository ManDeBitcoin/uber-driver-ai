# Uber Driver AI

Tu bitácora personal y copiloto privado para conductores de Uber. Primera versión local en React + TypeScript + Vite, ejecutable en Windows y empaquetada para Umbrel OS.

## 1. Lo que ya está preparado en tu Windows

Se comprobó que este equipo tiene Node.js 22+, npm y Git. No necesitas una base de datos externa ni un editor adicional para comenzar. Nada de esto necesita tu contraseña de Uber.

Node ejecuta las herramientas del proyecto. React construye la pantalla; TypeScript ayuda a detectar errores; Vite abre la aplicación en tu navegador. Git permite guardar versiones del código.

En otro equipo: instala la versión **LTS** de [Node.js desde su sitio oficial](https://nodejs.org/en/download), con las opciones predeterminadas. Este proyecto requiere Node 22.18 o posterior.

## 2. Abrir la aplicación en Windows

1. Abre esta carpeta en el Explorador de archivos de Windows.
2. Haz doble clic en **INICIAR.cmd** (Windows puede mostrarlo como «INICIAR»).
3. Se abrirá una ventana de comandos y luego el navegador. La primera vez se descargarán las dependencias.
4. Usa siempre **http://127.0.0.1:5173**, en el mismo navegador y perfil. No sustituyas `127.0.0.1` por `localhost`: cada dirección tiene un almacenamiento separado.
5. Mantén abierta la ventana de comandos mientras utilizas la aplicación. Para detenerla, pulsa Ctrl+C.

Alternativa desde PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

## 3. Umbrel OS (Servidor personal)

Esta aplicación incluye empaquetado nativo para Umbrel OS:
- Carpeta de manifiestos: `uber-driver-ai/`
- Tienda comunitaria: `umbrel-app-store.yml`
- Imagen de contenedor multi-arquitectura: `ghcr.io/mandebitcoin/uber-driver-ai` (puerto `5174` en Umbrel).

## 4. Coolify (servidor propio, privado, sin dominio personalizado)

La imagen es estática: nginx entrega la aplicación y los registros siguen en el navegador de cada dispositivo. El servidor no guarda datos, no necesita volumen ni variables de entorno.

1. En Coolify: **+ New** → **Public Repository** (o **Private Repository (GitHub App)** si haces el repo privado).
2. URL: `https://github.com/ManDeBitcoin/uber-driver-ai`, rama `main`.
3. **Build Pack**: `Dockerfile`. **Base Directory**: `/`. **Dockerfile Location**: `/Dockerfile`.
4. **Ports Exposes**: `80`. Deja **Ports Mappings** vacío; Coolify enruta por dominio.
5. **Domains**: pulsa **Generate Domain**. Sin dominio propio, Coolify crea uno tipo `http://<id>.<ip-del-servidor>.sslip.io`. Cambia `http://` por `https://` y guarda **antes de registrar datos**: `http://` y `https://` son direcciones distintas y cada una tiene su propio almacenamiento.
6. **Configuration → General → Security → Authentication**: elige **HTTP Basic Authentication**, pon un usuario y una contraseña larga y guarda. Deja **Label management** en «Managed by Coolify». Si tu versión de Coolify no muestra esa opción, usa el middleware `basicauth` de Traefik con etiquetas ([guía de Coolify](https://coolify.io/docs/core/networking/proxy/traefik/basic-auth)).
7. **Health Check**: activado, ruta `/health`, puerto `80`. Se ejecuta dentro del contenedor, así que la contraseña no lo bloquea.
8. **Deploy**. Abre el dominio en una ventana de incógnito: debe pedir usuario y contraseña antes de mostrar la app. Para actualizar, vuelve a desplegar.

Si el navegador avisa de un certificado no válido, Let's Encrypt no pudo emitirlo (puertos 80 y 443 cerrados o servidor sin IP pública) y Coolify usa uno autofirmado. La app funciona igual en `http://`, pero la contraseña de la autenticación básica viaja sin cifrar.

Notas:
- Tu dominio de Coolify es una dirección distinta de `127.0.0.1:5173` y de Umbrel: empieza vacía. Pasa tus datos con **Descargar respaldo** y **Restaurar respaldo real**.
- Elige un solo dispositivo y navegador para registrar (por ejemplo, el navegador de tu celular). Otro dispositivo no ve esos registros: no hay sincronización.
- Al guardar el primer registro con `https://`, la app pide al navegador almacenamiento persistente para que no lo borre cuando falte espacio.
- En iPhone, Safari puede borrar los datos de un sitio que no abres durante 7 días de uso del navegador. Descarga el respaldo cada semana y guárdalo fuera del celular.
- `index.html` se sirve sin caché y los archivos de `/assets/` con caché larga, así que cada despliegue se ve al recargar.

## 5. Tu primer recorrido, paso a paso

1. Entra en **Resumen**. La app inicia en tus registros reales (vacíos por defecto: $0 / 0 viajes / 0 cargas).
2. Haz clic en **Configurar vehículo** en la barra lateral o ve a **Mis datos → Tu Vehículo y Preferencias** para ingresar el modelo de tu auto, placa opcional y tu ciudad. Se guardan solo en tu navegador.
3. Abre **Jornadas** para registrar una jornada manualmente tras terminar de conducir (horas, km, viajes, ingresos netos en USD, otros gastos).
4. O usa **Importar de Uber (CSV)** para cargar tu extracto oficial de `drivers.uber.com`, con vista previa interactiva y detección de duplicados.
5. Abre **Combustible** para registrar tus cargas de gasolina con fecha, galones, costo y odómetro. Marca **Llené el tanque** para calcular el consumo real (km/galón y costo por km).
6. Abre **Mantenimiento** para anotar aceite, filtros, frenos, llantas, etc. En **Mis datos** llena los intervalos según el manual de tu vehículo para recibir avisos.
7. En **Mis datos** define tu meta diaria, horas máximas y los porcentajes para mantenimiento e impuestos.
8. En **Mis datos**, pulsa **Descargar respaldo** y guarda una copia JSON regularmente. Si pasan más de 7 días con cambios nuevos, Resumen te lo recuerda.
9. Cada mes, descarga el **Reporte del mes** (CSV) para tu contador.

## 6. Privacidad y almacenamiento local

- Los registros personales viven en `localStorage` bajo la clave `uber-driver-ai:real:v1` (formato interno versión 2, con migración automática desde la versión 1; el original se copia en `uber-driver-ai:real:v1:respaldo-AAAA-MM-DD`).
- La configuración (vehículo, metas, intervalos de mantenimiento y fecha del último respaldo) vive en `uber-driver-ai:settings:v1`. No va dentro del respaldo JSON.
- Ningún dato personal (tu carro, tu ciudad, tus placas, tus ingresos ni tus reportes CSV) se incluye en el código ni se transmite a servidores remotos.
- El repositorio público se mantiene limpio y sin información privada.

## 7. Comprobar el proyecto

```powershell
npm.cmd test
npm.cmd run build
```

Las pruebas cubren cálculos de jornadas, odómetro, saldo por hora y por km, consumo con tanque lleno, mantenimiento, metas y apartados, mejores días, franjas horarias del CSV de Uber, reporte mensual, migración v1 a v2 y respaldos JSON.
