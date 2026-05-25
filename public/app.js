const state = {
  cameras: [],
  cameraGroups: [],
  models: [],
  selectedModel: "",
  selectedCameraIds: new Set()
};

const elements = {
  loginPanel: document.querySelector("#loginPanel"),
  loginForm: document.querySelector("#loginForm"),
  dashboard: document.querySelector("#dashboard"),
  logoutButton: document.querySelector("#logoutButton"),
  cameraCount: document.querySelector("#cameraCount"),
  modelCount: document.querySelector("#modelCount"),
  groupCount: document.querySelector("#groupCount"),
  modelList: document.querySelector("#modelList"),
  modelFilter: document.querySelector("#modelFilter"),
  selectedModelLabel: document.querySelector("#selectedModelLabel"),
  groupName: document.querySelector("#groupName"),
  selectedCount: document.querySelector("#selectedCount"),
  selectModelCameras: document.querySelector("#selectModelCameras"),
  cameraPicker: document.querySelector("#cameraPicker"),
  groupForm: document.querySelector("#groupForm"),
  createGroupButton: document.querySelector("#createGroupButton"),
  cameraFilter: document.querySelector("#cameraFilter"),
  cameraTable: document.querySelector("#cameraTable"),
  groupList: document.querySelector("#groupList"),
  refreshButton: document.querySelector("#refreshButton"),
  toast: document.querySelector("#toast")
};

function showToast(message, type = "info") {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", type === "error");
  elements.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => elements.toast.classList.add("hidden"), 5200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function setBusy(button, busy, text) {
  if (!button) {
    return;
  }
  if (busy) {
    button.dataset.text = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.text || button.textContent;
    button.disabled = false;
  }
}

function modelCounts() {
  return state.cameras.reduce((acc, camera) => {
    acc.set(camera.model, (acc.get(camera.model) || 0) + 1);
    return acc;
  }, new Map());
}

function renderMetrics() {
  elements.cameraCount.textContent = state.cameras.length;
  elements.modelCount.textContent = state.models.length;
  elements.groupCount.textContent = state.cameraGroups.length;
}

function renderModels() {
  const filter = elements.modelFilter.value.trim().toLowerCase();
  const counts = modelCounts();
  const models = state.models.filter((model) => model.toLowerCase().includes(filter));

  elements.modelList.innerHTML = "";
  if (!models.length) {
    elements.modelList.innerHTML = '<p class="empty">No hay modelos.</p>';
    return;
  }

  for (const model of models) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `model-button ${state.selectedModel === model ? "active" : ""}`;
    button.innerHTML = `<span>${model}</span><span class="badge">${counts.get(model) || 0}</span>`;
    button.addEventListener("click", () => selectModel(model));
    elements.modelList.append(button);
  }
}

function selectModel(model) {
  state.selectedModel = model;
  state.selectedCameraIds.clear();
  elements.selectedModelLabel.textContent = model;
  elements.groupName.value = `Modelo - ${model}`.slice(0, 120);
  renderModels();
  renderCameraPicker();
}

function renderCameraPicker() {
  const cameras = state.cameras.filter((camera) => camera.model === state.selectedModel);
  elements.cameraPicker.innerHTML = "";

  if (!state.selectedModel) {
    elements.cameraPicker.innerHTML = '<p class="empty">Selecciona un modelo.</p>';
  } else if (!cameras.length) {
    elements.cameraPicker.innerHTML = '<p class="empty">No hay camaras para este modelo.</p>';
  } else {
    for (const camera of cameras) {
      const label = document.createElement("label");
      label.className = "camera-option";
      label.innerHTML = `
        <input type="checkbox" value="${camera.id}" ${state.selectedCameraIds.has(camera.id) ? "checked" : ""}>
        <span>${camera.name}<br><small>Modelo: ${camera.model}${camera.address ? ` | ${camera.address}` : ""}</small></span>
        <small>${camera.groups.length ? camera.groups.length : "Sin grupo"}</small>
      `;
      label.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) {
          state.selectedCameraIds.add(camera.id);
        } else {
          state.selectedCameraIds.delete(camera.id);
        }
        renderSelectionState();
      });
      elements.cameraPicker.append(label);
    }
  }

  renderSelectionState();
}

function renderSelectionState() {
  const count = state.selectedCameraIds.size;
  elements.selectedCount.textContent = `${count} ${count === 1 ? "camara seleccionada" : "camaras seleccionadas"}`;
  elements.createGroupButton.disabled = !state.selectedModel || count === 0 || !elements.groupName.value.trim();
}

function renderCameras() {
  const filter = elements.cameraFilter.value.trim().toLowerCase();
  const cameras = state.cameras.filter((camera) => {
    const haystack = `${camera.name} ${camera.model} ${camera.groups.join(" ")}`.toLowerCase();
    return haystack.includes(filter);
  });

  elements.cameraTable.innerHTML = "";
  if (!cameras.length) {
    elements.cameraTable.innerHTML = '<tr><td colspan="3" class="empty">No hay camaras.</td></tr>';
    return;
  }

  for (const camera of cameras) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${camera.name}</td>
      <td>${camera.model}</td>
      <td>${camera.groups.length ? camera.groups.join(", ") : "Sin grupo"}</td>
    `;
    elements.cameraTable.append(row);
  }
}

function renderGroups() {
  elements.groupList.innerHTML = "";
  if (!state.cameraGroups.length) {
    elements.groupList.innerHTML = '<p class="empty">No hay grupos.</p>';
    return;
  }

  for (const group of state.cameraGroups) {
    const item = document.createElement("article");
    item.className = "group-item";
    item.innerHTML = `
      <span>${group.name}<br><small>${group.builtIn ? "Integrado" : "Personalizado"}</small></span>
      <span class="badge">${group.cameraCount ?? "-"}</span>
    `;
    elements.groupList.append(item);
  }
}

function renderAll() {
  renderMetrics();
  renderModels();
  renderCameraPicker();
  renderCameras();
  renderGroups();
}

function setInventory(inventory) {
  state.cameras = inventory.cameras || [];
  state.cameraGroups = inventory.cameraGroups || [];
  state.models = inventory.models || [];
  if (!state.models.includes(state.selectedModel)) {
    state.selectedModel = "";
    state.selectedCameraIds.clear();
    elements.groupName.value = "";
    elements.selectedModelLabel.textContent = "Sin modelo";
  }
  renderAll();
}

function showDashboard() {
  elements.loginPanel.classList.add("hidden");
  elements.dashboard.classList.remove("hidden");
  elements.logoutButton.classList.remove("hidden");
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = elements.loginForm.querySelector("button[type='submit']");
  setBusy(button, true, "Conectando");
  try {
    const form = new FormData(elements.loginForm);
    const inventory = await api("/api/connect", {
      method: "POST",
      body: JSON.stringify({
        serverUrl: form.get("serverUrl"),
        username: form.get("username"),
        password: form.get("password"),
        allowSelfSigned: form.get("allowSelfSigned") === "on"
      })
    });
    setInventory(inventory);
    showDashboard();
    showToast("Conexion establecida.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(button, false);
  }
});

elements.selectModelCameras.addEventListener("click", () => {
  if (!state.selectedModel) {
    return;
  }
  for (const camera of state.cameras.filter((item) => item.model === state.selectedModel)) {
    state.selectedCameraIds.add(camera.id);
  }
  renderCameraPicker();
});

elements.groupName.addEventListener("input", renderSelectionState);
elements.modelFilter.addEventListener("input", renderModels);
elements.cameraFilter.addEventListener("input", renderCameras);

elements.groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(elements.createGroupButton, true, "Creando");
  try {
    const result = await api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        name: elements.groupName.value,
        model: state.selectedModel,
        cameraIds: [...state.selectedCameraIds]
      })
    });

    const failed = result.assignments.filter((assignment) => !assignment.ok);
    if (failed.length) {
      showToast(`Grupo creado, pero ${failed.length} camaras no se pudieron asignar.`, "error");
    } else {
      showToast("Grupo creado.");
    }

    const inventory = await api("/api/inventory");
    setInventory(inventory);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(elements.createGroupButton, false);
    renderSelectionState();
  }
});

elements.refreshButton.addEventListener("click", async () => {
  setBusy(elements.refreshButton, true, "Actualizando");
  try {
    setInventory(await api("/api/inventory"));
    showToast("Datos actualizados.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(elements.refreshButton, false);
  }
});

elements.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
  window.location.reload();
});
