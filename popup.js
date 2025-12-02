// Screen Elements
const loginScreen = document.getElementById("loginScreen");
const taskScreen = document.getElementById("taskScreen");
const loginBtn = document.getElementById("loginBtn");
const loginResult = document.getElementById("loginResult");
const userName = document.getElementById("userName");
const logoutLink = document.getElementById("logoutLink");

// Task Elements
const workspaceSelect = document.getElementById("workspaceSelect");
const workspaceInfo = document.getElementById("workspaceInfo");
const filtersContainer = document.getElementById("filtersContainer");
const searchInput = document.getElementById("searchInput");
const statusFilters = document.getElementById("statusFilters");
const targetStatusSelect = document.getElementById("targetStatusSelect");
const tasksContainer = document.getElementById("tasksContainer");
const taskList = document.getElementById("taskList");
const taskCount = document.getElementById("taskCount");
const selectAllBtn = document.getElementById("selectAllBtn");
const deselectAllBtn = document.getElementById("deselectAllBtn");
const changeStatusBtn = document.getElementById("changeStatusBtn");
const msg = document.getElementById("msg");

// OAuth
const BACKEND_URL = "http://localhost:3000";

// Domínios permitidos
const ALLOWED_DOMAINS = [
  "sinergiaeducacao.com.br",
  "liceufranco.g12.br",
  "cel.g12.br",
];

let allTasks = [];
let filteredTasks = [];
let currentTeamId = null;
let currentUserId = null;
let selectedTaskIds = new Set();
let selectedStatuses = new Set();

// ============================================
// Screen Management
// ============================================

function showLoginScreen() {
  loginScreen.classList.remove("hidden");
  taskScreen.classList.add("hidden");
}

function showTaskScreen() {
  loginScreen.classList.add("hidden");
  taskScreen.classList.remove("hidden");
}

// ============================================
// OAuth Functions
// ============================================

function checkConnectionStatus() {
  chrome.storage.sync.get("cu_token", (data) => {
    if (data.cu_token) {
      showTaskScreen();
      loadUserInfo();
      loadWorkspaces();
    } else {
      showLoginScreen();
    }
  });
}

function handleOAuthCallback(event) {
  console.log("[Popup] Mensagem recebida:", event.data);

  if (
    event.data.type === "CLICKUP_AUTH_SUCCESS" ||
    event.data.type === "CLICKUP_TOKEN_RECEIVED"
  ) {
    const token = event.data.token;
    validateTokenAndSave(token);
    window.removeEventListener("message", handleOAuthCallback);
  }
}

async function validateTokenAndSave(token) {
  try {
    loginResult.innerHTML = '<span class="info">⏳ Validando acesso...</span>';

    const response = await fetch("https://api.clickup.com/api/v2/user", {
      headers: {
        Authorization: token,
      },
    });

    if (!response.ok) {
      throw new Error("Token inválido");
    }

    const data = await response.json();
    const user = data.user;
    const userEmail = user.email;
    const emailDomain = userEmail.split("@")[1];

    console.log("[Popup] Email do usuário:", userEmail);
    console.log("[Popup] Domínio:", emailDomain);

    const isAllowedDomain = ALLOWED_DOMAINS.some(
      (domain) => emailDomain === domain
    );

    if (!isAllowedDomain) {
      console.warn("❌ Domínio não permitido:", emailDomain);
      loginResult.innerHTML = `<span class="err">❌ Acesso negado!<br>Apenas emails dos domínios: ${ALLOWED_DOMAINS.join(
        ", "
      )} são permitidos.</span>`;
      return;
    }

    chrome.storage.sync.set({ cu_token: token }, () => {
      console.log("✅ Token salvo via OAuth:", token.substring(0, 20) + "...");
      loginResult.innerHTML =
        '<span class="ok">✅ Conectado com sucesso!</span>';

      setTimeout(() => {
        showTaskScreen();
        loadUserInfo();
        loadWorkspaces();
      }, 1000);
    });
  } catch (error) {
    console.error("❌ Erro ao validar token:", error);
    loginResult.innerHTML =
      '<span class="err">❌ Erro ao validar acesso. Tente novamente.</span>';
  }
}

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    console.log("[Popup] Botão Login OAuth clicado");

    const width = 600;
    const height = 700;
    const left = screen.width / 2 - width / 2;
    const top = screen.height / 2 - height / 2;

    window.open(
      `${BACKEND_URL}/auth/clickup`,
      "ClickUp OAuth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    window.addEventListener("message", handleOAuthCallback);
  });
}

if (logoutLink) {
  logoutLink.addEventListener("click", () => {
    if (confirm("Deseja realmente desconectar?")) {
      chrome.storage.sync.remove("cu_token", () => {
        showLoginScreen();
        loginResult.innerHTML =
          '<span class="ok">✅ Desconectado com sucesso!</span>';
        setTimeout(() => {
          loginResult.textContent = "";
        }, 3000);
      });
    }
  });
}

checkConnectionStatus();

// ============================================
// Task Management Functions
// ============================================

async function loadUserInfo() {
  chrome.runtime.sendMessage({ type: "GET_USER_INFO" }, (resp) => {
    if (!resp || !resp.success) {
      console.warn("Não foi possível carregar informações do usuário");
      userName.textContent = "Usuário";
      return;
    }

    const user = resp.user;
    currentUserId = user.id;

    userName.textContent = user.username || user.email || "Usuário";

    console.log("Usuário atual:", user.username, user.id);
  });
}

async function loadWorkspaces() {
  workspaceSelect.innerHTML = '<option value="">Carregando...</option>';

  chrome.runtime.sendMessage({ type: "GET_USER_TEAMS" }, (resp) => {
    if (!resp || !resp.success) {
      workspaceSelect.innerHTML = '<option value="">Erro ao carregar</option>';
      msg.innerHTML = `<span class="err">❌ ${
        resp?.message || "Configure o Token nas Opções"
      }</span>`;
      return;
    }

    const teams = resp.teams || [];

    if (teams.length === 0) {
      workspaceSelect.innerHTML =
        '<option value="">Nenhum workspace encontrado</option>';
      msg.innerHTML = '<span class="err">❌ Nenhum workspace disponível</span>';
      return;
    }

    workspaceSelect.innerHTML =
      '<option value="">Selecione um workspace...</option>';

    teams.forEach((team) => {
      const option = document.createElement("option");
      option.value = team.id;
      option.textContent = team.name;
      workspaceSelect.appendChild(option);
    });

    if (teams.length === 1) {
      workspaceSelect.value = teams[0].id;
      workspaceSelect.dispatchEvent(new Event("change"));
    }

    msg.textContent = `✅ ${teams.length} workspace(s) disponível(is)`;
    msg.className = "info";
  });
}

workspaceSelect.addEventListener("change", () => {
  const selectedId = workspaceSelect.value;

  if (!selectedId) {
    workspaceInfo.textContent = "";
    filtersContainer.classList.add("hidden");
    tasksContainer.classList.add("hidden");
    currentTeamId = null;
    allTasks = [];
    return;
  }

  currentTeamId = selectedId;

  chrome.storage.local.set({ selected_team_id: selectedId });
  chrome.storage.sync.set({ cu_team_id: selectedId });

  loadTasks();
});

// ✅ MUDANÇA: Carregar apenas MINHAS tarefas (assigneeFilter = currentUserId)
function loadTasks() {
  if (!currentTeamId) return;

  msg.textContent = "Carregando suas tarefas...";
  msg.className = "muted";
  tasksContainer.classList.add("hidden");
  filtersContainer.classList.add("hidden");

  // ✅ Passa currentUserId para filtrar apenas suas tarefas
  chrome.runtime.sendMessage(
    {
      type: "SCAN_ALL_TASKS",
      assigneeFilter: currentUserId, // ← Filtrar por usuário logado
    },
    (resp) => {
      if (!resp || !resp.success) {
        const errorMsg = resp?.message || "Erro desconhecido";
        msg.innerHTML = `<strong style="color: #c00;">❌ Erro:</strong><br><span style="font-size: 12px;">${escapeHtml(
          errorMsg
        )}</span>`;
        msg.className = "err";
        return;
      }

      allTasks = resp.tasks || [];

      if (allTasks.length === 0) {
        msg.textContent = "📭 Você não tem tarefas neste workspace.";
        msg.className = "info";
        return;
      }

      filtersContainer.classList.remove("hidden");
      tasksContainer.classList.remove("hidden");
      msg.textContent = "";

      // Usar status das tarefas já carregadas (mais rápido)
      buildStatusFilters();

      // Carregar todos os status disponíveis no workspace para o dropdown de alteração
      loadAllStatuses();

      applyFilters();
    }
  );
}

// Função para carregar TODOS os status disponíveis no workspace
function loadAllStatuses() {
  if (!currentTeamId) {
    console.warn("[Popup] Team ID não está definido");
    return;
  }

  console.log("[Popup] Carregando TODOS os status disponíveis no workspace...");

  chrome.runtime.sendMessage(
    {
      type: "GET_ALL_STATUSES",
      teamId: currentTeamId,
    },
    (resp) => {
      console.log("[Popup] Resposta GET_ALL_STATUSES:", resp);

      if (resp && resp.success && resp.statuses && resp.statuses.length > 0) {
        const allStatuses = resp.statuses;

        // Obter referência atualizada do elemento
        const targetSelect = document.getElementById("targetStatusSelect");

        if (!targetSelect) {
          console.error("[Popup] targetStatusSelect não encontrado!");
          return;
        }

        // Atualizar dropdown de alteração com TODOS os status
        targetSelect.innerHTML =
          '<option value="">Selecione um status...</option>';

        allStatuses.forEach((status) => {
          const option = document.createElement("option");
          option.value = status;
          option.textContent = status;
          targetSelect.appendChild(option);
        });

        console.log(
          `[Popup] ${allStatuses.length} status disponíveis no workspace:`,
          allStatuses
        );
      } else {
        console.warn("[Popup] Nenhum status retornado ou erro:", resp);
      }
    }
  );
}

function buildStatusFilters() {
  const statuses = [...new Set(allTasks.map((task) => task.status))].sort();

  selectedStatuses.clear();

  // Dropdown de FILTRO: Status das suas tarefas
  statusFilters.innerHTML = '<option value="all">Todos os status</option>';

  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    statusFilters.appendChild(option);
  });

  statusFilters.value = "all";

  console.log(
    `[Popup] ${statuses.length} status nas tarefas atuais:`,
    statuses
  );

  // Remover listeners antigos recriando os elementos
  const newStatusFilters = statusFilters.cloneNode(true);
  statusFilters.parentNode.replaceChild(newStatusFilters, statusFilters);

  // Reatribuir referências
  window.statusFilters = document.getElementById("statusFilters");

  // Adicionar listeners
  window.statusFilters.addEventListener("change", () => {
    selectedStatuses.clear();
    if (window.statusFilters.value !== "all") {
      selectedStatuses.add(window.statusFilters.value);
    }
    applyFilters();
  });
}

function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase().trim();

  filteredTasks = allTasks.filter((task) => {
    const matchesSearch =
      !searchTerm || task.name.toLowerCase().includes(searchTerm);

    const matchesStatus =
      selectedStatuses.size === 0 || selectedStatuses.has(task.status);

    return matchesSearch && matchesStatus;
  });

  renderTasks();
}

function renderTasks() {
  taskList.innerHTML = "";
  selectedTaskIds.clear();

  if (filteredTasks.length === 0) {
    taskList.innerHTML =
      '<div class="muted" style="padding: 20px; text-align: center;">Nenhuma tarefa encontrada com os filtros aplicados.</div>';
    taskCount.textContent = "0 tarefas";
    updateChangeStatusButton();
    return;
  }

  // Separar tarefas principais e subtarefas
  const mainTasks = filteredTasks.filter((task) => !task.parent);
  const subtasksMap = new Map();

  filteredTasks.forEach((task) => {
    if (task.parent) {
      const parentId = task.parent;
      if (!subtasksMap.has(parentId)) {
        subtasksMap.set(parentId, []);
      }
      subtasksMap.get(parentId).push(task);
    }
  });

  taskCount.textContent = `${mainTasks.length} tarefa(s) principal(is) • ${
    filteredTasks.length - mainTasks.length
  } subtarefa(s)`;

  // Renderizar tarefas principais com suas subtarefas
  mainTasks.forEach((task) => {
    const subtasks = subtasksMap.get(task.id) || [];
    const taskElement = renderTaskItem(task, false, false, subtasks.length);

    // Renderizar subtarefas desta tarefa (ocultas por padrão)
    if (subtasks.length > 0) {
      const subtaskContainer = document.createElement("div");
      subtaskContainer.className = "subtask-container hidden";
      subtaskContainer.dataset.parentId = task.id;
      subtaskContainer.style.marginLeft = "32px";
      subtaskContainer.style.borderLeft = "2px solid #e0e0e0";
      subtaskContainer.style.paddingLeft = "8px";

      subtasks.forEach((subtask) => {
        const subtaskItem = renderTaskItem(subtask, true);
        subtaskContainer.appendChild(subtaskItem);
      });

      taskList.appendChild(subtaskContainer);
    }
  });

  // Renderizar subtarefas órfãs (cujo pai não está na lista filtrada)
  filteredTasks.forEach((task) => {
    if (task.parent && !mainTasks.find((t) => t.id === task.parent)) {
      renderTaskItem(task, true, true);
    }
  });

  updateChangeStatusButton();
}

function renderTaskItem(
  task,
  isSubtask = false,
  isOrphan = false,
  subtaskCount = 0
) {
  const item = document.createElement("div");
  item.className = "task-item";
  if (isSubtask) item.classList.add("subtask-item");
  item.dataset.taskId = task.id;

  // Botão de expandir/colapsar (apenas para tarefas com subtarefas)
  if (subtaskCount > 0) {
    const toggleBtn = document.createElement("span");
    toggleBtn.className = "subtask-toggle";
    toggleBtn.innerHTML = "⮕";
    toggleBtn.dataset.parentId = task.id;
    toggleBtn.title = `${subtaskCount} subtarefa(s)`;

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const container = taskList.querySelector(
        `.subtask-container[data-parent-id="${task.id}"]`
      );
      if (container) {
        const isHidden = container.classList.contains("hidden");
        container.classList.toggle("hidden");
        toggleBtn.innerHTML = isHidden ? "⬇" : "⮕";
        toggleBtn.classList.toggle("expanded");
      }
    });

    item.appendChild(toggleBtn);
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.dataset.taskId = task.id;

  const content = document.createElement("div");
  content.className = "task-content";

  let assigneesHtml = "";
  if (task.assignees && task.assignees.length > 0) {
    const assigneeNames = task.assignees.map((a) => a.username).join(", ");
    assigneesHtml = `<span style="color: #666">👥 ${escapeHtml(
      assigneeNames
    )}</span>`;
  }

  const subtaskIcon = isSubtask ? "↳ " : "";
  const orphanLabel = isOrphan
    ? ' <span style="color: #999; font-size: 10px;">(subtarefa sem pai visível)</span>'
    : "";
  const subtaskBadge =
    subtaskCount > 0
      ? ` <span class="subtask-badge">${subtaskCount}</span>`
      : "";

  content.innerHTML = `
    <div class="task-name">${subtaskIcon}${escapeHtml(
    task.name
  )}${subtaskBadge}${orphanLabel}</div>
    <div class="task-meta">
      <span class="task-status">${escapeHtml(task.status)}</span>
      ${task.list ? `• Lista: ${escapeHtml(task.list.name)}` : ""}
      ${assigneesHtml ? `<br>${assigneesHtml}` : ""}
    </div>
  `;

  checkbox.addEventListener("change", (e) => {
    e.stopPropagation();
    if (checkbox.checked) {
      selectedTaskIds.add(task.id);
      item.classList.add("selected");
    } else {
      selectedTaskIds.delete(task.id);
      item.classList.remove("selected");
    }
    updateChangeStatusButton();
  });

  content.addEventListener("click", () => {
    if (task.url) {
      chrome.tabs.create({ url: task.url });
    }
  });

  item.appendChild(checkbox);
  item.appendChild(content);
  taskList.appendChild(item);

  return item;
}

function updateChangeStatusButton() {
  const count = selectedTaskIds.size;
  const targetStatus = targetStatusSelect.value;

  if (count === 0 || !targetStatus) {
    changeStatusBtn.disabled = true;
    changeStatusBtn.textContent = "⚙️ Alterar Status das Tarefas Selecionadas";
  } else {
    changeStatusBtn.disabled = false;
    changeStatusBtn.textContent = `⚙️ Alterar ${count} Tarefa(s) para "${targetStatus}"`;
  }
}

selectAllBtn.addEventListener("click", () => {
  selectedTaskIds.clear();
  filteredTasks.forEach((task) => selectedTaskIds.add(task.id));

  taskList.querySelectorAll(".task-checkbox").forEach((cb) => {
    cb.checked = true;
    cb.closest(".task-item").classList.add("selected");
  });

  updateChangeStatusButton();
});

deselectAllBtn.addEventListener("click", () => {
  selectedTaskIds.clear();

  taskList.querySelectorAll(".task-checkbox").forEach((cb) => {
    cb.checked = false;
    cb.closest(".task-item").classList.remove("selected");
  });

  updateChangeStatusButton();
});

searchInput.addEventListener("input", () => {
  applyFilters();
});

targetStatusSelect.addEventListener("change", () => {
  updateChangeStatusButton();
});

changeStatusBtn.addEventListener("click", () => {
  if (selectedTaskIds.size === 0) return;

  const targetStatus = targetStatusSelect.value;
  if (!targetStatus) {
    alert("Selecione um status de destino!");
    return;
  }

  const taskIds = Array.from(selectedTaskIds);
  const count = taskIds.length;

  if (
    !confirm(
      `Deseja realmente alterar ${count} tarefa(s) para "${targetStatus}"?`
    )
  ) {
    return;
  }

  changeStatusBtn.disabled = true;
  changeStatusBtn.textContent = "Alterando...";
  msg.textContent = "Alterando status das tarefas selecionadas...";
  msg.className = "muted";

  chrome.runtime.sendMessage(
    {
      type: "CHANGE_TASKS_STATUS",
      taskIds: taskIds,
      targetStatus: targetStatus,
    },
    (resp) => {
      if (!resp || !resp.success) {
        const errorMsg = resp?.message || "Erro ao alterar status das tarefas";
        msg.innerHTML = `<span class="err">❌ ${escapeHtml(errorMsg)}</span>`;
        msg.className = "err";
        changeStatusBtn.disabled = false;
        updateChangeStatusButton();
        return;
      }

      msg.textContent = `✅ ${
        resp.updated || count
      } tarefa(s) alterada(s) para "${targetStatus}" com sucesso!`;
      msg.className = "ok";

      setTimeout(() => {
        loadTasks();
      }, 1500);
    }
  );
});

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

loadUserInfo();
loadWorkspaces();
