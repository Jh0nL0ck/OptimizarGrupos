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
  createGroupForm: document.querySelector("#createGroupForm"),
  groupName: document.querySelector("#groupName"),
  createGroupButton: document.querySelector("#createGroupButton"),
  selectedCount: document.querySelector("#selectedCount"),
  selectVisibleCameras: document.querySelector("#selectVisibleCameras"),
  assignGroupForm: document.querySelector("#assignGroupForm"),
  targetGroup: document.querySelector("#targetGroup"),
  assignGroupButton: document.querySelector("#assignGroupButton"),
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

function visibleCameras() {
  const filter = elements.cameraFilter.value.trim().toLowerCase();
  return state.cameras.filter((camera) => {
    const haystack = `${camera.name} ${camera.model} ${camera.groups.join(" ")}`.toLowerCase();
    return haystack.includes(filter);
  });
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
  elements.selectedModelLabel.textContent = model;
  elements.groupName.value = `Modelo - ${model}`.slice(0, 120);
  renderModels();
  renderCreateGroupState();
}

function renderCreateGroupState() {
  elements.createGroupButton.disabled = !state.selectedModel || !elements.groupName.value.trim();
}

function renderAssignState() {
  const count = state.selectedCameraIds.size;
  elements.selectedCount.textContent = `${count} ${count === 1 ? "camara seleccionada" : "camaras seleccionadas"}`;
  elements.selectVisibleCameras.disabled = visibleCameras().length === 0;
  elements.assignGroupButton.disabled = count === 0 || !elements.targetGroup.value;
}

function renderCameras() {
  const cameras = visibleCameras();

  elements.cameraTable.innerHTML = "";
  if (!cameras.length) {
    elements.cameraTable.innerHTML = '<tr><td colspan="4" class="empty">No hay camaras habilitadas para este filtro.</td></tr>';
    renderAssignState();
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

  renderAssignState();
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

function renderTargetGroups(preferredGroupId = "") {
  const selectedValue = preferredGroupId || elements.targetGroup.value;
  const customGroups = state.cameraGroups.filter((group) => !group.builtIn);
  elements.targetGroup.innerHTML = "";

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

function renderAll(preferredGroupId = "") {
  renderMetrics();
  renderModels();
  renderTargetGroups(preferredGroupId);
  renderCameras();
  renderGroups();
  renderCreateGroupState();
}

function setInventory(inventory, preferredGroupId = "") {
  state.cameras = inventory.cameras || [];
  state.cameraGroups = inventory.cameraGroups || [];
  state.models = inventory.models || [];
  if (!state.models.includes(state.selectedModel)) {
    state.selectedModel = "";
    elements.groupName.value = "";
    elements.selectedModelLabel.textContent = "Sin modelo";
  }
  state.selectedCameraIds = new Set(
    [...state.selectedCameraIds].filter((cameraId) => state.cameras.some((camera) => camera.id === cameraId))
  );
  renderAll(preferredGroupId);
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

elements.createGroupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(elements.createGroupButton, true, "Creando");
  try {
    const result = await api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        name: elements.groupName.value,
        model: state.selectedModel
      })
    });
    const inventory = await api("/api/inventory");
    setInventory(inventory, result.groupId);
    showToast("Grupo creado.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(elements.createGroupButton, false);
    renderCreateGroupState();
  }
});

elements.selectVisibleCameras.addEventListener("click", () => {
  for (const camera of visibleCameras()) {
    state.selectedCameraIds.add(camera.id);
  }
  renderCameras();
});

elements.assignGroupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setBusy(elements.assignGroupButton, true, "Anadiendo");
  try {
    const result = await api("/api/group-cameras", {
      method: "POST",
      body: JSON.stringify({
        groupId: elements.targetGroup.value,
        cameraIds: [...state.selectedCameraIds]
      })
    });

    const failed = result.assignments.filter((assignment) => !assignment.ok);
    if (failed.length) {
      showToast(`${failed.length} camaras no se pudieron asignar al grupo.`, "error");
    } else {
      state.selectedCameraIds.clear();
      showToast("Camaras anadidas al grupo.");
    }

    const inventory = await api("/api/inventory");
    setInventory(inventory, result.groupId);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(elements.assignGroupButton, false);
    renderAssignState();
  }
});

elements.groupName.addEventListener("input", renderCreateGroupState);
elements.targetGroup.addEventListener("change", renderAssignState);
elements.modelFilter.addEventListener("input", renderModels);
elements.cameraFilter.addEventListener("input", renderCameras);

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
