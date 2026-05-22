# XProtect Camera Group Optimizer

Aplicacion web en Node.js para conectar con Milestone XProtect y crear grupos de camaras por modelo de dispositivo mediante la Configuration REST API.

## Funcionalidad

- Login contra el API Gateway de XProtect con servidor de gestion, usuario y clave.
- Lectura de camaras, hardware y grupos de camaras.
- Tabla de camaras con nombre, modelo y grupos actuales.
- Selector de modelos detectados.
- Seleccion manual de camaras para crear grupos por modelo.
- Creacion de grupo y asignacion de camaras desde la interfaz.

## Requisitos

- Node.js 18 o superior.
- npm, incluido normalmente con Node.js.
- Git, solo si se va a clonar el repositorio desde GitHub.
- XProtect con API Gateway disponible.
- Usuario con permisos para leer camaras, hardware y grupos.
- Permisos suficientes para crear grupos y modificar miembros.

> Nota: en algunas versiones/licencias de XProtect, leer o modificar `cameraGroups` requiere permisos administrativos o permisos especificos sobre Management Server.

## Preparacion de un PC nuevo

1. Instala Node.js 18 o superior desde [nodejs.org](https://nodejs.org/). La version LTS es una buena opcion.
2. Instala Git desde [git-scm.com](https://git-scm.com/) si quieres descargar el proyecto con `git clone`.
3. Comprueba las versiones:

```bash
node --version
npm --version
git --version
```

Si `node` y `npm` muestran version, el PC ya puede ejecutar la aplicacion.

## Uso local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

Si el API Gateway usa un certificado autofirmado en laboratorio:

```bash
XPROTECT_ALLOW_SELF_SIGNED=true npm run dev
```

En Windows PowerShell:

```powershell
$env:XPROTECT_ALLOW_SELF_SIGNED="true"
npm run dev
```

## Estructura

```text
.
|-- public/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- src/
|   |-- server.js
|   `-- xprotectClient.js
|-- .env.example
|-- .gitignore
|-- package.json
`-- README.md
```

## Seguridad

La clave del usuario no se guarda. El backend obtiene un token OAuth2 de XProtect y mantiene la sesion en memoria con una cookie HTTP-only. Para produccion, ejecuta la app detras de HTTPS y usa certificados validos en XProtect.

## API de XProtect utilizada

- `POST /API/IDP/connect/token`
- `GET /api/rest/v1/cameras`
- `GET /api/rest/v1/hardware`
- `GET /api/rest/v1/cameraGroups`
- `POST /api/rest/v1/cameraGroups`
- `POST /api/rest/v1/cameraGroups/{id}/cameras`

La documentacion oficial esta en [Milestone Configuration REST API](https://doc.developer.milestonesys.com/mipvmsapi/api/config-rest/v1/).
