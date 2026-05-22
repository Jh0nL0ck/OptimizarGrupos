import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const TOKEN_ENDPOINTS = [
  "/API/IDP/connect/token",
  "/api/idp/connect/token",
  "/IDP/connect/token",
  "/idp/connect/token"
];

const API_ROOT = "/api/rest/v1";

function normalizeServerUrl(serverUrl) {
  const trimmed = String(serverUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("Server URL is required.");
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function safeMessage(statusCode, body) {
  if (!body) {
    return `HTTP ${statusCode}`;
  }

  if (typeof body === "string") {
    return body.slice(0, 300);
  }

  return body.error_description || body.error || body.message || JSON.stringify(body).slice(0, 300);
}

function request({ method, url, token, body, form, allowSelfSigned = false }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const isHttps = target.protocol === "https:";
    const payload = form
      ? new URLSearchParams(form).toString()
      : body === undefined
        ? undefined
        : JSON.stringify(body);

    const headers = {
      Accept: "application/json"
    };

    if (payload !== undefined) {
      headers["Content-Type"] = form ? "application/x-www-form-urlencoded" : "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const options = {
      method,
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      headers,
      agent: isHttps ? new https.Agent({ rejectUnauthorized: !allowSelfSigned }) : undefined
    };

    const transport = isHttps ? https : http;
    const req = transport.request(options, (res) => {
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        const contentType = res.headers["content-type"] || "";
        const parsed = raw && contentType.includes("application/json") ? JSON.parse(raw) : raw;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: parsed });
          return;
        }

        const error = new Error(safeMessage(res.statusCode, parsed));
        error.statusCode = res.statusCode;
        error.body = parsed;
        reject(error);
      });
    });

    req.on("error", reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

async function requestWithFallback(paths, options) {
  let lastError;
  for (const path of paths) {
    try {
      return await request({ ...options, url: `${options.baseUrl}${path}` });
    } catch (error) {
      lastError = error;
      if (![400, 404, 405].includes(error.statusCode)) {
        throw error;
      }
    }
  }
  throw lastError;
}

function relationId(item, relationName = "parent") {
  return item?.relations?.[relationName]?.id || item?.[`${relationName}Id`] || item?.parent?.id || null;
}

function pathFor(type, id) {
  return { type, id };
}

export class XProtectClient {
  constructor({ serverUrl, token, allowSelfSigned = false }) {
    this.baseUrl = normalizeServerUrl(serverUrl);
    this.token = token;
    this.allowSelfSigned = allowSelfSigned;
  }

  static async login({ serverUrl, username, password, allowSelfSigned = false }) {
    const baseUrl = normalizeServerUrl(serverUrl);
    const response = await requestWithFallback(TOKEN_ENDPOINTS, {
      baseUrl,
      method: "POST",
      allowSelfSigned,
      form: {
        grant_type: "password",
        username,
        password,
        client_id: "GrantValidatorClient"
      }
    });

    if (!response.body?.access_token) {
      throw new Error("XProtect did not return an access token.");
    }

    return new XProtectClient({
      serverUrl: baseUrl,
      token: response.body.access_token,
      allowSelfSigned
    });
  }

  async api(method, path, body) {
    const response = await request({
      method,
      url: `${this.baseUrl}${API_ROOT}${path}`,
      token: this.token,
      body,
      allowSelfSigned: this.allowSelfSigned
    });
    return response.body;
  }

  async getCollection(resource, { disabled = true, pageSize = 500 } = {}) {
    const items = [];
    for (let page = 0; page < 200; page += 1) {
      const params = new URLSearchParams({ page: String(page), size: String(pageSize) });
      if (disabled) {
        params.append("disabled", "");
      }
      const body = await this.api("GET", `/${resource}?${params.toString()}`);
      const batch = Array.isArray(body?.array) ? body.array : [];
      items.push(...batch);
      if (batch.length < pageSize) {
        return items;
      }
    }
    return items;
  }

  async getInventory() {
    const [cameras, hardware, cameraGroups] = await Promise.all([
      this.getCollection("cameras"),
      this.getCollection("hardware"),
      this.getCollection("cameraGroups").catch((error) => {
        error.message = `Could not read camera groups: ${error.message}`;
        throw error;
      })
    ]);

    const hardwareById = new Map(hardware.map((device) => [device.id?.toLowerCase(), device]));
    const groupsByCameraId = new Map();

    for (const group of cameraGroups) {
      for (const camera of group.cameras || []) {
        const cameraId = camera.id?.toLowerCase();
        if (!cameraId) {
          continue;
        }
        const groupList = groupsByCameraId.get(cameraId) || [];
        groupList.push(group.displayName || group.name);
        groupsByCameraId.set(cameraId, groupList);
      }
    }

    const normalizedCameras = cameras.map((camera) => {
      const hardwareId = relationId(camera);
      const device = hardwareId ? hardwareById.get(hardwareId.toLowerCase()) : null;
      return {
        id: camera.id,
        name: camera.displayName || camera.name || camera.id,
        enabled: camera.enabled,
        hardwareId,
        model: device?.model || device?.displayName || "Unknown model",
        address: device?.address || "",
        groups: groupsByCameraId.get(camera.id?.toLowerCase()) || []
      };
    });

    const models = [...new Set(normalizedCameras.map((camera) => camera.model))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return {
      cameras: normalizedCameras.sort((a, b) => a.name.localeCompare(b.name)),
      cameraGroups: cameraGroups.map((group) => ({
        id: group.id,
        name: group.displayName || group.name,
        builtIn: Boolean(group.builtIn),
        cameraCount: Array.isArray(group.cameras) ? group.cameras.length : null
      })).sort((a, b) => a.name.localeCompare(b.name)),
      models
    };
  }

  async createCameraGroup({ name, description = "" }) {
    const result = await this.api("POST", "/cameraGroups", {
      name,
      displayName: name,
      description
    });
    return result?.result || result?.data || result;
  }

  async addCameraToGroup(groupId, cameraId) {
    const payloads = [
      pathFor("cameras", cameraId),
      { path: pathFor("cameras", cameraId) },
      { camera: `cameras/${cameraId}` },
      { id: cameraId },
      { type: "cameras", id: cameraId }
    ];

    let lastError;
    for (const payload of payloads) {
      try {
        await this.api("POST", `/cameraGroups/${groupId}/cameras`, payload);
        return { cameraId, ok: true };
      } catch (error) {
        lastError = error;
        if (![400, 404, 405, 415].includes(error.statusCode)) {
          break;
        }
      }
    }

    return {
      cameraId,
      ok: false,
      error: lastError?.message || "Unknown error"
    };
  }

  async createGroupWithCameras({ name, model, cameraIds }) {
    const group = await this.createCameraGroup({
      name,
      description: `Created by XProtect Camera Group Optimizer for model: ${model}`
    });

    const groupId = group.id || group.path?.id;
    if (!groupId) {
      throw new Error("Camera group was created, but XProtect did not return its id.");
    }

    const assignments = [];
    for (const cameraId of cameraIds) {
      assignments.push(await this.addCameraToGroup(groupId, cameraId));
    }

    return {
      groupId,
      name,
      assignments
    };
  }
}
