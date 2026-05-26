# XProtect Camera Group Optimizer

Web application for creating and assigning Milestone XProtect camera groups by camera hardware model.

The tool connects to the XProtect Configuration REST API, reads enabled cameras, detects their hardware models, lists existing camera groups, and helps operators create model-based groups so later configuration changes can be applied consistently at group level.

## Features

- Connects to a Milestone XProtect Management Server / API Gateway.
- Uses XProtect OAuth2 authentication.
- Lists enabled cameras only.
- Shows camera name, detected hardware model, and current camera groups.
- Lists existing camera groups.
- Builds a model list from the enabled camera inventory.
- Creates a new camera group from a selected camera model.
- Lets the user select one or more enabled cameras.
- Adds selected cameras to an existing or newly created camera group.
- Runs as a small Node.js web app with no database.

## Requirements

- Node.js 18 or later.
- npm, normally included with Node.js.
- Git, only required if cloning the repository.
- A Milestone XProtect system with the API Gateway / Configuration REST API available.
- A user account with permission to:
  - read cameras,
  - read hardware,
  - read camera groups,
  - create camera groups,
  - modify camera group members.

Some XProtect versions, roles, or licenses may require additional administrative permissions for camera group operations.

## Installation

Clone the repository:

```bash
git clone https://github.com/<user>/<repo>.git
cd <repo>
```

Install dependencies:

```bash
npm install
```

This project currently uses only Node.js built-in modules, but running `npm install` is still useful for normal Node project setup and future dependency changes.

## Run

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

On Windows PowerShell, if script execution blocks `npm`, use:

```powershell
npm.cmd run dev
```

## Configuration

The default port is `3000`. You can change it with the `PORT` environment variable:

```bash
PORT=4000 npm run dev
```

For lab systems using a self-signed certificate on the XProtect API Gateway, you can allow self-signed certificates:

```bash
XPROTECT_ALLOW_SELF_SIGNED=true npm run dev
```

Windows PowerShell:

```powershell
$env:XPROTECT_ALLOW_SELF_SIGNED="true"
npm.cmd run dev
```

Do not use `XPROTECT_ALLOW_SELF_SIGNED=true` in production unless you understand the security impact.

## Usage

1. Enter the XProtect management/API Gateway address, username, and password.
2. Connect to XProtect.
3. Review the enabled camera list and detected models.
4. Select a camera model and create a group for that model if needed.
5. Select one or more enabled cameras from the camera table.
6. Select the target camera group.
7. Click `Anadir camaras al grupo`.

## Security Notes

- User passwords are not written to disk.
- The backend exchanges credentials for an XProtect OAuth2 access token.
- The session is kept in memory and referenced by an HTTP-only cookie.
- The app is intended for trusted operator environments.
- For production use, run behind HTTPS and use valid certificates on XProtect.
- Do not commit `.env`, real server addresses, credentials, API tokens, private certificates, logs, or screenshots containing sensitive system information.

## API Endpoints Used

- `POST /API/IDP/connect/token`
- `GET /api/rest/v1/cameras`
- `GET /api/rest/v1/hardware`
- `GET /api/rest/v1/cameraGroups`
- `POST /api/rest/v1/cameraGroups`
- `POST /api/rest/v1/cameraGroups/{id}/cameras`

Official documentation: [Milestone Configuration REST API](https://doc.developer.milestonesys.com/mipvmsapi/api/config-rest/v1/).

## Project Structure

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

## Development

Run syntax checks:

```bash
npm run check
```

Windows PowerShell:

```powershell
npm.cmd run check
```

## Disclaimer

This is an independent tool and is not affiliated with, endorsed by, or sponsored by Milestone Systems.
