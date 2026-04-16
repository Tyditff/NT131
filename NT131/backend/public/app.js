const STORAGE_KEYS = {
  apiBase: "parking-admin-api-base",
  token: "parking-admin-access-token",
  user: "parking-admin-user",
};

const defaultApiBase = `${window.location.origin}/api/v1`;

const loadStoredUser = () => {
  const rawUser = window.localStorage.getItem(STORAGE_KEYS.user);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
};

const state = {
  apiBase: window.localStorage.getItem(STORAGE_KEYS.apiBase) || defaultApiBase,
  token: window.localStorage.getItem(STORAGE_KEYS.token) || "",
  user: loadStoredUser(),
  residents: [],
  vehicles: [],
  cards: [],
};

const elements = {
  apiBase: document.querySelector("#api-base"),
  saveApiBase: document.querySelector("#save-api-base"),
  refreshAll: document.querySelector("#refresh-all"),
  logout: document.querySelector("#logout"),
  sessionSummary: document.querySelector("#session-summary"),
  feedback: document.querySelector("#feedback"),
  loginForm: document.querySelector("#login-form"),
  residentForm: document.querySelector("#resident-form"),
  vehicleForm: document.querySelector("#vehicle-form"),
  rfidForm: document.querySelector("#rfid-form"),
  residentTable: document.querySelector("#resident-table"),
  vehicleTable: document.querySelector("#vehicle-table"),
  rfidTable: document.querySelector("#rfid-table"),
  residentCount: document.querySelector("#resident-count"),
  vehicleCount: document.querySelector("#vehicle-count"),
  rfidCount: document.querySelector("#rfid-count"),
  refreshResidents: document.querySelector("#refresh-residents"),
  refreshVehicles: document.querySelector("#refresh-vehicles"),
  refreshRfids: document.querySelector("#refresh-rfids"),
  vehicleResidentSelect: document.querySelector("#vehicle-resident-id"),
  rfidVehicleSelect: document.querySelector("#rfid-vehicle-id"),
  cardType: document.querySelector("#card-type"),
  monthlyFields: document.querySelector("#monthly-fields"),
  editResidentModal: document.querySelector("#edit-resident-modal"),
  editResidentForm: document.querySelector("#edit-resident-form"),
};

const authOnlySelectors = [
  "#refresh-all",
  "#logout",
  "#refresh-residents",
  "#refresh-vehicles",
  "#refresh-rfids",
  "[data-auth-only='true']",
  "[data-auth-only='true'] input",
  "[data-auth-only='true'] select",
  "[data-auth-only='true'] button",
];

const guestOnlySelectors = ["[data-guest-only='true']"];

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeApiBase = (value) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || defaultApiBase;
};

const extractId = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "_id" in value) {
    return String(value._id);
  }

  return String(value);
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
  }).format(date);
};

const setFeedback = (message, kind = "info") => {
  elements.feedback.textContent = message;
  elements.feedback.className = `feedback ${kind}`;
};

const persistSession = () => {
  if (state.token) {
    window.localStorage.setItem(STORAGE_KEYS.token, state.token);
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.token);
  }

  if (state.user) {
    window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user));
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.user);
  }
};

const persistApiBase = () => {
  window.localStorage.setItem(STORAGE_KEYS.apiBase, state.apiBase);
};

const toggleAuthControls = (enabled) => {
  document.querySelectorAll(authOnlySelectors.join(", ")).forEach((element) => {
    if (
      element.tagName === "INPUT" ||
      element.tagName === "SELECT" ||
      element.tagName === "BUTTON"
    ) {
      element.disabled = !enabled;
    } else {
      element.style.display = enabled ? "" : "none";
    }
  });
};

const toggleGuestControls = (enabled) => {
  document
    .querySelectorAll(guestOnlySelectors.join(", "))
    .forEach((element) => {
      element.style.display = enabled ? "" : "none";
    });
};

const updateSessionSummary = () => {
  if (!state.token || !state.user) {
    elements.sessionSummary.textContent =
      "Not logged in. Use an admin or operator account.";
    toggleAuthControls(false);
    toggleGuestControls(true);
    return;
  }

  const safeUsername = escapeHtml(state.user.username);
  const safeRole = escapeHtml(state.user.role);
  elements.sessionSummary.innerHTML = `Logged in as <strong>${safeUsername}</strong> (${safeRole})`;
  toggleAuthControls(true);
  toggleGuestControls(false);
};

const setBusyState = (button, busy, idleText) => {
  if (!button) {
    return;
  }

  if (!button.dataset.idleText) {
    button.dataset.idleText = idleText || button.textContent || "";
  }

  button.disabled = busy;
  button.textContent = busy ? "Working..." : button.dataset.idleText;
};

const buildErrorMessage = (payload, fallbackMessage) => {
  if (!payload) {
    return fallbackMessage;
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return payload.errors
      .map((item) => `${item.field}: ${item.message}`)
      .join(" | ");
  }

  if (Array.isArray(payload.details) && payload.details.length > 0) {
    return payload.details.join(" | ");
  }

  if (payload.message) {
    return payload.message;
  }

  return fallbackMessage;
};

const clearSession = () => {
  state.token = "";
  state.user = null;
  persistSession();
  updateSessionSummary();
};

const request = async (path, options = {}) => {
  const { auth = true, method = "GET", body } = options;
  const headers = {
    Accept: "application/json",
  };

  if (auth) {
    if (!state.token) {
      throw new Error("Login required before calling protected APIs.");
    }

    headers.Authorization = `Bearer ${state.token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${normalizeApiBase(state.apiBase)}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }

    throw new Error(
      buildErrorMessage(payload, `Request failed (${response.status})`),
    );
  }

  return payload;
};

const renderEmptyRow = (columnCount, message) =>
  `<tr><td colspan="${columnCount}" class="muted-cell">${escapeHtml(message)}</td></tr>`;

const renderResidentOptions = () => {
  const currentValue = elements.vehicleResidentSelect.value;
  const options = state.residents
    .map((resident) => {
      const residentId = extractId(resident._id);
      const label = `${resident.full_name} - ${resident.apartment_no}`;
      return `<option value="${escapeHtml(residentId)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  elements.vehicleResidentSelect.innerHTML = `<option value="">No resident</option>${options}`;
  elements.vehicleResidentSelect.value = currentValue;
};

const renderVehicleOptions = () => {
  const currentValue = elements.rfidVehicleSelect.value;
  const options = state.vehicles
    .map((vehicle) => {
      const vehicleId = extractId(vehicle._id);
      return `<option value="${escapeHtml(vehicleId)}">${escapeHtml(vehicle.plate_number)}</option>`;
    })
    .join("");

  elements.rfidVehicleSelect.innerHTML =
    options || `<option value="">No vehicles available</option>`;

  if (options) {
    elements.rfidVehicleSelect.value =
      currentValue || extractId(state.vehicles[0]?._id);
  }
};

const renderResidents = () => {
  elements.residentCount.textContent = String(state.residents.length);

  if (state.residents.length === 0) {
    elements.residentTable.innerHTML = renderEmptyRow(6, "No residents yet.");
    renderResidentOptions();
    return;
  }

  elements.residentTable.innerHTML = state.residents
    .map(
      (resident) => `
        <tr>
          <td>${escapeHtml(resident.full_name)}</td>
          <td>${escapeHtml(resident.apartment_no)}</td>
          <td>${escapeHtml(resident.phone || "-")}</td>
          <td>
            <span class="status-pill ${resident.is_active ? "" : "inactive"}">
              ${resident.is_active ? "Active" : "Inactive"}
            </span>
          </td>
          <td class="muted-cell">${escapeHtml(extractId(resident._id))}</td>
          <td>
            <div class="action-buttons">
              <button type="button" class="edit-resident" data-resident-id="${escapeHtml(extractId(resident._id))}">Edit</button>
              <button type="button" class="delete-resident delete" data-resident-id="${escapeHtml(extractId(resident._id))}">Delete</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");

  renderResidentOptions();
};

const renderVehicles = () => {
  const residentMap = new Map(
    state.residents.map((resident) => [extractId(resident._id), resident]),
  );

  elements.vehicleCount.textContent = String(state.vehicles.length);

  if (state.vehicles.length === 0) {
    elements.vehicleTable.innerHTML = renderEmptyRow(4, "No vehicles yet.");
    renderVehicleOptions();
    return;
  }

  elements.vehicleTable.innerHTML = state.vehicles
    .map((vehicle) => {
      const resident = residentMap.get(extractId(vehicle.resident_id));
      const residentCell = resident
        ? `${escapeHtml(resident.full_name)}<br /><span class="muted-cell">${escapeHtml(resident.apartment_no)}</span>`
        : `<span class="muted-cell">No resident</span>`;

      return `
        <tr>
          <td>${escapeHtml(vehicle.plate_number)}</td>
          <td>${escapeHtml(vehicle.vehicle_type)}</td>
          <td>${residentCell}</td>
          <td class="muted-cell">${escapeHtml(extractId(vehicle._id))}</td>
        </tr>
      `;
    })
    .join("");

  renderVehicleOptions();
};

const renderCards = () => {
  const vehicleMap = new Map(
    state.vehicles.map((vehicle) => [extractId(vehicle._id), vehicle]),
  );

  elements.rfidCount.textContent = String(state.cards.length);

  if (state.cards.length === 0) {
    elements.rfidTable.innerHTML = renderEmptyRow(5, "No RFID cards yet.");
    return;
  }

  elements.rfidTable.innerHTML = state.cards
    .map((card) => {
      const vehicle = vehicleMap.get(extractId(card.vehicle_id));
      const vehicleCell = vehicle
        ? `${escapeHtml(vehicle.plate_number)}<br /><span class="muted-cell">${escapeHtml(vehicle.vehicle_type)}</span>`
        : `<span class="muted-cell">Missing vehicle</span>`;
      const typeCell =
        card.card_type === "monthly"
          ? `monthly<br /><span class="muted-cell">${escapeHtml(String(card.monthly_fee || 0))} VND | ${escapeHtml(formatDate(card.monthly_started_at))} - ${escapeHtml(formatDate(card.monthly_expires_at))}</span>`
          : "guest";

      return `
        <tr>
          <td>${escapeHtml(card.uid)}</td>
          <td>${vehicleCell}</td>
          <td>${typeCell}</td>
          <td>
            <span class="status-pill ${card.is_active ? "" : "inactive"}">
              ${card.is_active ? "Active" : "Inactive"}
            </span>
          </td>
          <td class="muted-cell">${escapeHtml(extractId(card._id))}</td>
        </tr>
      `;
    })
    .join("");
};

const renderAll = () => {
  renderResidents();
  renderVehicles();
  renderCards();
};

const loadResidents = async () => {
  const response = await request("/residents");
  state.residents = response.data || [];
  renderResidents();
};

const loadAll = async () => {
  if (!state.token) {
    state.residents = [];
    state.vehicles = [];
    state.cards = [];
    renderAll();
    return;
  }

  try {
    await loadResidents();
  } catch (error) {
    console.error("[ERROR] Failed to load residents:", error);
    state.residents = [];
  }

  try {
    const vehiclesResponse = await request("/vehicles");
    state.vehicles = vehiclesResponse.data || [];
  } catch (error) {
    console.error("Failed to load vehicles:", error);
    state.vehicles = [];
  }

  try {
    const cardsResponse = await request("/rfid-cards");
    state.cards = cardsResponse.data || [];
  } catch (error) {
    console.error("Failed to load cards:", error);
    state.cards = [];
  }

  renderVehicles();
  renderCards();
};

const openEditResidentModal = (residentId) => {
  const resident = state.residents.find((r) => extractId(r._id) === residentId);
  if (!resident) return;

  const form = elements.editResidentForm;
  form.querySelector("[name='resident_id']").value = residentId;
  form.querySelector("[name='full_name']").value = resident.full_name || "";
  form.querySelector("[name='phone']").value = resident.phone || "";
  form.querySelector("[name='apartment_no']").value =
    resident.apartment_no || "";
  form.querySelector("[name='is_active']").checked =
    resident.is_active || false;

  elements.editResidentModal.hidden = false;
};

const closeEditResidentModal = () => {
  elements.editResidentModal.hidden = true;
  elements.editResidentForm.reset();
};

const deleteResident = async (residentId) => {
  if (!confirm("Are you sure you want to delete this resident?")) {
    return;
  }

  try {
    setBusyState(
      document.querySelector(
        `button[data-resident-id="${residentId}"].delete-resident`,
      ),
      true,
    );
    await request(`/residents/${residentId}`, {
      method: "DELETE",
    });
    setFeedback("Resident deleted successfully.", "success");
    await loadResidents();
    renderVehicles();
  } catch (error) {
    setFeedback(error.message || "Failed to delete resident.", "error");
  } finally {
    const btn = document.querySelector(
      `button[data-resident-id="${residentId}"].delete-resident`,
    );
    if (btn) setBusyState(btn, false);
  }
};

const createEditResidentPayload = (form) => {
  const formData = new FormData(form);
  const payload = {
    full_name: String(formData.get("full_name") || "").trim(),
    apartment_no: String(formData.get("apartment_no") || "").trim(),
    is_active: form.querySelector("[name='is_active']").checked,
  };
  const phone = String(formData.get("phone") || "").trim();

  if (phone) {
    payload.phone = phone;
  }

  return payload;
};

const toggleMonthlyFields = () => {
  const isMonthly = elements.cardType.value === "monthly";
  elements.monthlyFields.hidden = !isMonthly;

  elements.monthlyFields.querySelectorAll("input").forEach((input) => {
    input.disabled = !isMonthly;
    input.required = isMonthly;

    if (!isMonthly) {
      input.value = "";
    }
  });
};

const createResidentPayload = (form) => {
  const formData = new FormData(form);
  const isActiveInput = form.querySelector("[name='is_active']");
  const payload = {
    full_name: String(formData.get("full_name") || "").trim(),
    apartment_no: String(formData.get("apartment_no") || "").trim(),
    is_active: isActiveInput ? isActiveInput.checked : true,
  };
  const phone = String(formData.get("phone") || "").trim();

  if (phone) {
    payload.phone = phone;
  }

  console.log("[DEBUG] Resident payload:", payload);
  return payload;
};

const createVehiclePayload = (form) => {
  const formData = new FormData(form);
  const payload = {
    vehicle_type: String(formData.get("vehicle_type") || ""),
    plate_number: String(formData.get("plate_number") || "").trim(),
  };
  const residentId = String(formData.get("resident_id") || "").trim();

  if (residentId) {
    payload.resident_id = residentId;
  }

  return payload;
};

const createRfidPayload = (form) => {
  const formData = new FormData(form);
  const payload = {
    uid: String(formData.get("uid") || "").trim(),
    vehicle_id: String(formData.get("vehicle_id") || "").trim(),
    card_type: String(formData.get("card_type") || "guest"),
    is_active: formData.get("is_active") === "on",
  };

  if (payload.card_type === "monthly") {
    const monthlyFee = String(formData.get("monthly_fee") || "").trim();
    const startedAt = String(formData.get("monthly_started_at") || "").trim();
    const expiresAt = String(formData.get("monthly_expires_at") || "").trim();

    if (monthlyFee) {
      payload.monthly_fee = Number(monthlyFee);
    }

    if (startedAt) {
      payload.monthly_started_at = startedAt;
    }

    if (expiresAt) {
      payload.monthly_expires_at = expiresAt;
    }
  }

  return payload;
};

const handleAsyncAction = async (action, successMessage, submitButton) => {
  try {
    setBusyState(submitButton, true);
    await action();
    setFeedback(successMessage, "success");
  } catch (error) {
    setFeedback(error.message || "Request failed.", "error");
  } finally {
    setBusyState(submitButton, false);
  }
};

elements.apiBase.value = state.apiBase;
updateSessionSummary();
toggleMonthlyFields();
renderAll();

elements.saveApiBase.addEventListener("click", () => {
  state.apiBase = normalizeApiBase(elements.apiBase.value);
  elements.apiBase.value = state.apiBase;
  persistApiBase();
  setFeedback(`API base saved: ${state.apiBase}`, "info");
});

elements.logout.addEventListener("click", () => {
  clearSession();
  state.residents = [];
  state.vehicles = [];
  state.cards = [];
  closeEditResidentModal();
  renderAll();
  setFeedback("Session cleared.", "info");
});

elements.refreshAll.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  await handleAsyncAction(() => loadAll(), "All lists refreshed.", button);
});

elements.refreshResidents.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  await handleAsyncAction(
    async () => {
      await loadResidents();
      renderVehicles();
    },
    "Residents refreshed.",
    button,
  );
});

elements.refreshVehicles.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  await handleAsyncAction(
    async () => {
      const response = await request("/vehicles");
      state.vehicles = response.data || [];
      renderVehicles();
      renderCards();
    },
    "Vehicles refreshed.",
    button,
  );
});

elements.refreshRfids.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  await handleAsyncAction(
    async () => {
      const response = await request("/rfid-cards");
      state.cards = response.data || [];
      renderCards();
    },
    "RFID cards refreshed.",
    button,
  );
});

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter;
  const username = elements.loginForm.username.value.trim();
  const password = elements.loginForm.password.value.trim();

  await handleAsyncAction(
    async () => {
      const response = await request("/auth/login", {
        auth: false,
        method: "POST",
        body: { username, password },
      });

      state.token = response.data.accessToken;
      state.user = response.data.user;
      persistSession();
      updateSessionSummary();
      await loadAll();
      elements.loginForm.reset();
    },
    "Login successful.",
    submitButton,
  );
});

elements.residentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter;
  const payload = createResidentPayload(elements.residentForm);

  await handleAsyncAction(
    async () => {
      console.log("[DEBUG] Submitting resident with payload:", payload);
      await request("/residents", {
        method: "POST",
        body: payload,
      });
      console.log("[DEBUG] Resident created successfully");

      elements.residentForm.reset();
      elements.residentForm.querySelector("[name='is_active']").checked = true;

      await loadResidents();
      renderVehicles();
    },
    "Resident created.",
    submitButton,
  );
});

elements.vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter;
  const payload = createVehiclePayload(elements.vehicleForm);

  await handleAsyncAction(
    async () => {
      await request("/vehicles", {
        method: "POST",
        body: payload,
      });
      elements.vehicleForm.reset();
      await loadAll();
    },
    "Vehicle created.",
    submitButton,
  );
});

elements.rfidForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter;
  const payload = createRfidPayload(elements.rfidForm);

  await handleAsyncAction(
    async () => {
      await request("/rfid-cards", {
        method: "POST",
        body: payload,
      });
      elements.rfidForm.reset();
      elements.rfidForm.querySelector("[name='is_active']").checked = true;
      elements.cardType.value = "guest";
      toggleMonthlyFields();
      await loadAll();
    },
    "RFID card created.",
    submitButton,
  );
});

elements.cardType.addEventListener("change", toggleMonthlyFields);

// Modal management
document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const modalId = button.getAttribute("data-close-modal");
    const modal = document.querySelector(`#${modalId}`);
    if (modal) {
      modal.hidden = true;
    }
  });
});

// Edit resident form
elements.editResidentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.submitter;
  const residentId = elements.editResidentForm.querySelector(
    "[name='resident_id']",
  ).value;
  const payload = createEditResidentPayload(elements.editResidentForm);

  await handleAsyncAction(
    async () => {
      await request(`/residents/${residentId}`, {
        method: "PATCH",
        body: payload,
      });
      closeEditResidentModal();
      await loadResidents();
      renderVehicles();
    },
    "Resident updated.",
    submitButton,
  );
});

// Edit resident button handler
document.addEventListener("click", async (event) => {
  if (event.target.classList.contains("edit-resident")) {
    const residentId = event.target.getAttribute("data-resident-id");
    openEditResidentModal(residentId);
  } else if (event.target.classList.contains("delete-resident")) {
    const residentId = event.target.getAttribute("data-resident-id");
    await deleteResident(residentId);
  }
});

if (state.token) {
  loadAll()
    .then(() => {
      setFeedback("Session restored. Lists loaded.", "success");
    })
    .catch((error) => {
      setFeedback(error.message || "Could not restore session.", "error");
    });
}
