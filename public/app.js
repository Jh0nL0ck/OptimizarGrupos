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
  targetGroup: document.querySelector("#targetGroup"),
  groupName: document.querySelector("#groupName"),
  selectedCount: document.querySelector("#selectedCount"),
  selectVisibleCameras: document.querySelector("#selectVisibleCameras"),
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
  renderCameras();
}

function renderSelectionState() {
  const count = state.selectedCameraIds.size;
  const creatingGroup = elements.targetGroup.value === "__new__";
  elements.selectedCount.textContent = `${count} ${count === 1 ? "camara seleccionada" : "camaras seleccionadas"}`;
  elements.groupName.disabled = !creatingGroup;
  elements.selectVisibleCameras.disabled = !state.selectedModel || visibleCameras().length === 0;
  elements.createGroupButton.disabled = !state.selectedModel || count === 0 || (creatingGroup && !elements.groupName.value.trim());
}

function visibleCameras() {
  const filter = elements.cameraFilter.value.trim().toLowerCase();
  return state.cameras.filter((camera) => {
    if (state.selectedModel && camera.model !== state.selectedModel) {
      return false;
    }
    const haystack = `${camera.name} ${camera.model} ${camera.groups.join(" ")}`.toLowerCase();
    return haystack.includes(filter);
  });
}

function renderCameras() {
  const cameras = visibleCameras();

  elements.cameraTable.innerHTML = "";
  if (!cameras.length) {
    elements.cameraTable.innerHTML = '<tr><td colspan="4" class="empty">Selecciona un modelo o cambia el filtro.</td></tr>';
    renderSelectionState();
    return;
  }

  for (const camera of cameras) {
    const row = document.createElement("tr");
    row.className = state.selectedCameraIds.has(camera.id) ? "selected-row" : "";
    row.innerHTML = `
      <td><input class="row-check" type="checkbox" value="${camera.id}" ${state.selectedCameraIds.has(camera.id) ? "checked" : ""} aria-label="Seleccionar ${camera.name}"></td>
      <td>${camera.name}</td>
      <td>${camera.model}</td>
      <td>${camera.groups.length ? camera.groups.join(", ") : "Sin grupo"}</td>
    `;
    row.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked) {
        state.selectedCameraIds.add(camera.id);
      } else {
        state.selectedCameraIds.delete(camera.id);
      }
      renderCameras();
    });
    elements.cameraTable.append(row);
  }

  renderSelectionState();
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

function renderTargetGroups() {
  const selectedValue = elements.targetGroup.value || "__new__";
  const customGroups = state.cameraGroups.filter((group) => !group.builtIn);
  elements.targetGroup.innerHTML = '<option value="__new__">Crear grupo nuevo</option>';

  for (const group of customGroups) {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    elements.targetGroup.append(option);
  }

  if ([...elements.targetGroup.options].some((option) => option.value === selectedValue)) {
    elements.targetGroup.value = selectedValue;
  }
}

function renderAll() {
  renderMetrics();
  renderModels();
  renderTargetGroups();
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
  state.selectedCameraIds = new Set(
    [...state.selectedCameraIds].filter((cameraId) => state.cameras.some((camera) => camera.id === cameraId))
  );
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

elements.selectVisibleCameras.addEventListener("click", () => {
  for (const camera of visibleCameras()) {
    state.selectedCameraIds.add(camera.id);
  }
  renderCameras();
});

elements.groupName.addEventListener("input", renderSelectionState);
elements.targetGroup.addEventListener("change", renderSelectionState);
elements.modelFilter.addEventListener("input", renderModels);
elements.cameraFilter.addEventListener("input", renderCameras);

elements.groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const groupId = elements.targetGroup.value === "__new__" ? "" : elements.targetGroup.value;
  setBusy(elements.createGroupButton, true, "Añadiendo");
  try {
    const result = await api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        name: groupId ? "" : elements.groupName.value,
        groupId,
        model: state.selectedModel,
        cameraIds: [...state.selectedCameraIds]
      })
    });

    const failed = result.assignments.filter((assignment) => !assignment.ok);
    if (failed.length) {
      showToast(`${failed.length} camaras no se pudieron asignar al grupo.`, "error");
    } else {
      state.selectedCameraIds.clear();
      showToast(result.created ? "Grupo creado y camaras añadidas." : "Camaras añadidas al grupo.");
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
