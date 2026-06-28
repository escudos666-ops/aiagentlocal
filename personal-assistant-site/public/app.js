const groupOrder = ["assistant", "automation", "memory", "observability"];
const groupLabels = new Map();
const refreshButton = document.querySelector("#refresh");
const lastCheck = document.querySelector("#last-check");
const onlineCount = document.querySelector("#online-count");
const offlineCount = document.querySelector("#offline-count");
const overallPill = document.querySelector("#overall-pill");
const serviceGroups = document.querySelector("#service-groups");
const workflowForm = document.querySelector("#workflow-form");
const workflowInput = document.querySelector("#workflow-input");
const workflowResult = document.querySelector("#workflow-result");

function serviceStatusText(service) {
  if (service.ok) {
    const speed = typeof service.durationMs === "number" ? ` in ${service.durationMs}ms` : "";
    return `Online${speed}`;
  }
  if (service.status === "degraded") return `Degraded: HTTP ${service.code}`;
  return service.error ? `Offline: ${service.error}` : "Offline";
}

function renderServices(payload) {
  const grouped = new Map();
  for (const service of payload.services) {
    if (!grouped.has(service.groupKey)) grouped.set(service.groupKey, []);
    grouped.get(service.groupKey).push(service);
    groupLabels.set(service.groupKey, service.group);
  }

  serviceGroups.innerHTML = "";

  for (const key of groupOrder) {
    const services = grouped.get(key) || [];
    const online = services.filter((service) => service.ok).length;
    const group = document.createElement("section");
    group.id = key;
    group.innerHTML = `
      <div class="group-title">
        <strong>${groupLabels.get(key) || key}</strong>
        <span>${online}/${services.length} online</span>
      </div>
      <div class="service-list"></div>
    `;

    const list = group.querySelector(".service-list");
    for (const service of services) {
      const item = document.createElement("article");
      item.className = `service ${service.status}`;
      const action = service.publicUrl
        ? `<a href="${service.publicUrl}" target="_blank" rel="noreferrer">${service.action}</a>`
        : `<span>${service.action}</span>`;
      item.innerHTML = `
        <div class="service-head">
          <div>
            <h3>${service.name}</h3>
            <p>${service.role}</p>
          </div>
          <span class="dot" aria-label="${service.status}"></span>
        </div>
        <div class="service-meta">
          <span>${serviceStatusText(service)}</span>
          ${action}
        </div>
      `;
      list.append(item);
    }

    serviceGroups.append(group);
  }
}

function updateSummary(payload) {
  onlineCount.textContent = `${payload.online}/${payload.total}`;
  offlineCount.textContent = String(payload.offline);
  lastCheck.textContent = `Last check ${new Date(payload.checkedAt).toLocaleTimeString()}`;

  overallPill.classList.remove("offline", "degraded");
  if (payload.offline === 0 && payload.degraded === 0) {
    overallPill.textContent = "Stack ready";
  } else if (payload.online > 0) {
    overallPill.textContent = "Partial service";
    overallPill.classList.add("degraded");
  } else {
    overallPill.textContent = "No services online";
    overallPill.classList.add("offline");
  }
}

async function refreshServices() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Checking";
  try {
    const response = await fetch("/api/services", { cache: "no-store" });
    const payload = await response.json();
    renderServices(payload);
    updateSummary(payload);
  } catch (error) {
    lastCheck.textContent = `Check failed: ${error.message}`;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";
  }
}

workflowForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const instruction = workflowInput.value.trim();
  if (!instruction) return;

  workflowResult.textContent = "Dispatching task...";
  try {
    const response = await fetch("/api/workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instruction })
    });
    const payload = await response.json();
    workflowResult.textContent = payload.ok
      ? "Workflow accepted the task."
      : payload.message || "Workflow did not accept the task.";
  } catch (error) {
    workflowResult.textContent = `Dispatch failed: ${error.message}`;
  }
});

refreshButton.addEventListener("click", refreshServices);
refreshServices();
setInterval(refreshServices, 30000);
