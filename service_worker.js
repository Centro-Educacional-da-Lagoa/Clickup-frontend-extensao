// ===== Storage keys =====
const STORAGE_KEYS = {
  token: "cu_token",
  teamId: "cu_team_id",
  fromStatus: "cu_from_status",
  toStatus: "cu_to_status",
  listIds: "cu_list_ids",
  spaceId: "cu_space_id",
};

const API_BASE = "https://api.clickup.com/api/v2";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getCfg() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        [STORAGE_KEYS.token]: "",
        [STORAGE_KEYS.teamId]: "9011207949",
        [STORAGE_KEYS.fromStatus]: "complete",
        [STORAGE_KEYS.toStatus]: "fechado",
        [STORAGE_KEYS.listIds]: "",
        [STORAGE_KEYS.spaceId]: "",
      },
      resolve
    );
  });
}

function authHeaders(token) {
  return { Authorization: token, "Content-Type": "application/json" };
}

async function fetchJSON(url, token) {
  const r = await fetch(url, { headers: authHeaders(token) });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} @ GET ${url}`);
  return r.json();
}

async function putJSON(url, token, body) {
  const r = await fetch(url, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let errorMsg = `${r.status} ${r.statusText}`;
    try {
      const errorBody = await r.json();
      if (errorBody.err || errorBody.error) {
        errorMsg = errorBody.err || errorBody.error;
      }
    } catch {
      // Ignore JSON parse error
    }
    throw new Error(errorMsg);
  }
  try {
    return await r.json();
  } catch {
    return {};
  }
}

// ---- ClickUp helpers ----
async function getAuthorizedUser(token) {
  const url = `${API_BASE}/user`;
  const data = await fetchJSON(url, token);
  return data.user || null;
}

async function getAuthorizedTeams(token) {
  const url = `${API_BASE}/team`;
  const data = await fetchJSON(url, token);
  return data.teams || [];
}

async function getTeamMembers(token, teamId) {
  const url = `${API_BASE}/team/${teamId}`;
  const data = await fetchJSON(url, token);
  return data.team?.members || [];
}

async function getSpaces(token, teamId) {
  const url = `${API_BASE}/team/${teamId}/space?archived=false`;
  const data = await fetchJSON(url, token);
  return data.spaces || [];
}

async function getSpaceStatuses(token, spaceId) {
  const url = `${API_BASE}/space/${spaceId}`;
  const data = await fetchJSON(url, token);

  // A API retorna { statuses: [{ statuses: [...] }] }
  const statusGroups = data.statuses || [];
  const allStatuses = [];

  statusGroups.forEach((group) => {
    if (group.statuses && Array.isArray(group.statuses)) {
      group.statuses.forEach((status) => {
        if (status.status) {
          allStatuses.push(status.status);
        }
      });
    }
  });

  return allStatuses;
}

async function getFolders(token, spaceId) {
  const url = `${API_BASE}/space/${spaceId}/folder?archived=false`;
  const data = await fetchJSON(url, token);
  return data.folders || [];
}

async function getSpaceLists(token, spaceId) {
  const url = `${API_BASE}/space/${spaceId}/list?archived=false`;
  const data = await fetchJSON(url, token);
  return data.lists || [];
}

async function getFolderLists(token, folderId) {
  const url = `${API_BASE}/folder/${folderId}/list?archived=false`;
  const data = await fetchJSON(url, token);
  return data.lists || [];
}

// Nova função: buscar tarefas por status no team inteiro
async function getAllTasksInTeam(token, teamId, assigneeFilter = null) {
  const tasks = [];
  let page = 0;

  const filterMsg = assigneeFilter
    ? ` (filtrado por usuário ${assigneeFilter})`
    : "";
  console.log(
    `[ClickUp Ext] Buscando TODAS as tarefas ativas no team ${teamId}${filterMsg}...`
  );

  while (true) {
    let url = `${API_BASE}/team/${teamId}/task?archived=false&include_closed=true&page=${page}&subtasks=true`;

    if (assigneeFilter) {
      url += `&assignees[]=${assigneeFilter}`;
    }

    try {
      const data = await fetchJSON(url, token);
      const batch = data.tasks || [];

      console.log(
        `[ClickUp Ext] Página ${page}: ${batch.length} tarefa(s) encontrada(s)`
      );

      if (batch.length === 0) break;
      tasks.push(...batch);
      page += 1;
      if (page > 200) break;
      await sleep(200);
    } catch (err) {
      console.error(
        `[ClickUp Ext] Erro ao buscar tarefas na página ${page}:`,
        err
      );
      break;
    }
  }

  console.log(`[ClickUp Ext] Total: ${tasks.length} tarefa(s) ativa(s)`);
  return tasks;
}

async function getTasksByStatusInTeam(
  token,
  teamId,
  statusName,
  assigneeFilter = null
) {
  const tasks = [];
  let page = 0;

  const filterMsg = assigneeFilter
    ? ` (filtrado por usuário ${assigneeFilter})`
    : "";
  console.log(
    `[ClickUp Ext] Buscando tarefas com status "${statusName}" no team ${teamId}${filterMsg}...`
  );

  while (true) {
    let url = `${API_BASE}/team/${teamId}/task?archived=false&include_closed=true&page=${page}&statuses[]=${encodeURIComponent(
      statusName
    )}`;

    if (assigneeFilter) {
      url += `&assignees[]=${assigneeFilter}`;
    }

    try {
      const data = await fetchJSON(url, token);
      const batch = data.tasks || [];

      console.log(
        `[ClickUp Ext] Página ${page}: ${batch.length} tarefa(s) encontrada(s)`
      );

      if (batch.length === 0) break;
      tasks.push(...batch);
      page += 1;
      if (page > 200) break;
      await sleep(200);
    } catch (err) {
      console.error(
        `[ClickUp Ext] Erro ao buscar tarefas na página ${page}:`,
        err
      );
      break;
    }
  }

  console.log(
    `[ClickUp Ext] Total: ${tasks.length} tarefa(s) com status "${statusName}"`
  );
  return tasks;
}

async function getTasksByStatus(token, listId, statusName) {
  const tasks = [];
  let page = 0;
  while (true) {
    const url = `${API_BASE}/list/${listId}/task?archived=false&include_closed=true&page=${page}&statuses[]=${encodeURIComponent(
      statusName
    )}`;
    const data = await fetchJSON(url, token);
    const batch = data.tasks || [];
    if (batch.length === 0) break;
    tasks.push(...batch);
    page += 1;
    if (page > 200) break;
    await sleep(150);
  }
  return tasks;
}

async function updateTaskStatus(token, taskId, toStatus) {
  const url = `${API_BASE}/task/${taskId}`;
  console.log(
    `[ClickUp] Atualizando tarefa ${taskId} para status "${toStatus}"`
  );
  console.log(`[ClickUp] Body:`, { status: toStatus });
  return putJSON(url, token, { status: toStatus });
}

// ---- Core ----
async function collectTargetLists(token, { teamId, spaceId, listIds }) {
  // priority: listIds > spaceId > teamId
  console.log(
    `[ClickUp Ext] collectTargetLists - listIds: "${listIds}", spaceId: "${spaceId}", teamId: "${teamId}"`
  );

  if (listIds) {
    const ids = listIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    console.log(`[ClickUp Ext] Usando List IDs: ${ids.length} lista(s)`);
    return ids.map((id) => ({ id, name: `Lista ${id}` }));
  }
  if (spaceId) {
    console.log(`[ClickUp Ext] Buscando listas do Space ID: ${spaceId}...`);
    const lists = [];
    try {
      const direct = await getSpaceLists(token, spaceId);
      console.log(`[ClickUp Ext] ${direct.length} lista(s) direta(s) no space`);
      lists.push(...direct);

      try {
        const folders = await getFolders(token, spaceId);
        console.log(`[ClickUp Ext] ${folders.length} pasta(s) encontrada(s)`);

        for (const f of folders) {
          try {
            const inside = await getFolderLists(token, f.id);
            console.log(
              `[ClickUp Ext] Pasta "${f.name}": ${inside.length} lista(s)`
            );
            lists.push(...inside);
            await sleep(100);
          } catch (folderErr) {
            console.warn(
              `[ClickUp Ext] Erro ao buscar listas da pasta ${f.id}, continuando...`,
              folderErr.message
            );
          }
        }
      } catch (folderErr) {
        console.warn(
          `[ClickUp Ext] Erro ao buscar pastas (provavelmente falta permissão), usando só listas diretas.`,
          folderErr.message
        );
      }
    } catch (err) {
      console.error(
        `[ClickUp Ext] Erro ao buscar listas do Space ${spaceId}:`,
        err
      );
      throw err;
    }
    console.log(`[ClickUp Ext] Total: ${lists.length} lista(s) no space`);
    return lists;
  }
  if (teamId) {
    console.log(`[ClickUp Ext] Buscando listas do Team ID: ${teamId}...`);
    const lists = [];
    try {
      const spaces = await getSpaces(token, teamId);
      console.log(
        `[ClickUp Ext] ${spaces.length} space(s) encontrado(s) no team`
      );

      for (const sp of spaces) {
        console.log(
          `[ClickUp Ext] Processando space "${sp.name}" (${sp.id})...`
        );

        try {
          const direct = await getSpaceLists(token, sp.id);
          console.log(`[ClickUp Ext] - ${direct.length} lista(s) direta(s)`);
          lists.push(...direct);

          try {
            const folders = await getFolders(token, sp.id);
            console.log(`[ClickUp Ext] - ${folders.length} pasta(s)`);

            for (const f of folders) {
              try {
                const inside = await getFolderLists(token, f.id);
                console.log(
                  `[ClickUp Ext] - Pasta "${f.name}": ${inside.length} lista(s)`
                );
                lists.push(...inside);
                await sleep(100);
              } catch (folderErr) {
                console.warn(
                  `[ClickUp Ext] Erro ao buscar listas da pasta ${f.id}, continuando...`
                );
              }
            }
          } catch (folderErr) {
            console.warn(
              `[ClickUp Ext] Erro ao buscar pastas do space ${sp.id}, usando só listas diretas.`
            );
          }
        } catch (spaceErr) {
          console.warn(
            `[ClickUp Ext] Erro ao buscar listas do space ${sp.id}, continuando...`
          );
        }
      }
    } catch (err) {
      console.error(
        `[ClickUp Ext] Erro ao buscar listas do Team ${teamId}:`,
        err
      );
      throw err;
    }
    console.log(`[ClickUp Ext] Total: ${lists.length} lista(s) no team`);
    return lists;
  }
  throw new Error("Informe List IDs, Space ID ou Team ID nas Opções.");
}

async function runMigration() {
  const cfg = await getCfg();
  const token = cfg[STORAGE_KEYS.token];
  const teamId = (cfg[STORAGE_KEYS.teamId] || "").trim();
  const spaceId = (cfg[STORAGE_KEYS.spaceId] || "").trim();
  const listIds = (cfg[STORAGE_KEYS.listIds] || "").trim();
  const fromStatusRaw = (cfg[STORAGE_KEYS.fromStatus] || "").trim();
  const toStatus = (cfg[STORAGE_KEYS.toStatus] || "").trim();

  if (!token) {
    console.warn("[ClickUp Ext] Configure o token em Options.");
    return { updated: 0, errors: 1, message: "Token ausente" };
  }
  if (!fromStatusRaw || !toStatus) {
    return {
      updated: 0,
      errors: 1,
      message: "Preencha 'De' e 'Para' nas Opções.",
    };
  }

  // permite múltiplos "De" separados por vírgula
  const fromStatuses = fromStatusRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let updated = 0,
    scanned = 0;

  try {
    let allTasks = [];

    // Se tem Team ID e NÃO tem List IDs específicos, busca globalmente no team
    if (teamId && !listIds && !spaceId) {
      console.log(
        `[ClickUp Ext] Buscando tarefas globalmente no Team ID: ${teamId}`
      );

      for (const s of fromStatuses) {
        try {
          const batch = await getTasksByStatusInTeam(token, teamId, s);
          allTasks.push(...batch);
          scanned += batch.length;
        } catch (err) {
          console.error(
            `[ClickUp Ext] Erro ao buscar tarefas com status "${s}":`,
            err
          );
        }
      }
    } else {
      // Busca tradicional por listas
      const targetLists = await collectTargetLists(token, {
        teamId,
        spaceId,
        listIds,
      });

      if (!targetLists.length) {
        return {
          updated: 0,
          errors: 1,
          message: "Nenhuma lista encontrada com os filtros.",
        };
      }

      for (const list of targetLists) {
        let tasks = [];
        for (const s of fromStatuses) {
          const batch = await getTasksByStatus(token, list.id, s);
          tasks.push(...batch);
          await sleep(100);
        }
        // dedup
        const seen = new Set();
        tasks = tasks.filter((t) => !seen.has(t.id) && seen.add(t.id));
        allTasks.push(...tasks);
        scanned += tasks.length;
      }
    }

    // Dedup geral
    const seen = new Set();
    allTasks = allTasks.filter((t) => !seen.has(t.id) && seen.add(t.id));
    scanned = allTasks.length;

    // Atualizar todas as tarefas
    for (const t of allTasks) {
      try {
        await updateTaskStatus(token, t.id, toStatus);
        updated += 1;
        await sleep(150);
      } catch (e) {
        console.error("[ClickUp Ext] Falha ao atualizar", t.id, e);
      }
    }

    console.log(`[ClickUp Ext] OK. scanned=${scanned} | updated=${updated}`);
    return { updated, errors: 0, message: "OK" };
  } catch (e) {
    console.warn("[ClickUp Ext] Erro:", e.message || e);
    return { updated, errors: 1, message: String(e) };
  }
}

// ---- Scan without updating ----
async function scanTasks(assigneeFilter = null) {
  const cfg = await getCfg();
  const token = cfg[STORAGE_KEYS.token];
  const teamId = (cfg[STORAGE_KEYS.teamId] || "").trim();
  const spaceId = (cfg[STORAGE_KEYS.spaceId] || "").trim();
  const listIds = (cfg[STORAGE_KEYS.listIds] || "").trim();
  const fromStatusRaw = (cfg[STORAGE_KEYS.fromStatus] || "").trim();

  if (!token) {
    return {
      success: false,
      message: "Token ausente. Configure em Opções.",
      tasks: [],
    };
  }
  if (!fromStatusRaw) {
    return {
      success: false,
      message: "Status de origem não configurado",
      tasks: [],
    };
  }

  const fromStatuses = fromStatusRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    let allTasks = [];

    // Se tem Team ID e NÃO tem List IDs específicos, busca globalmente no team
    if (teamId && !listIds && !spaceId) {
      const filterMsg = assigneeFilter
        ? ` (filtrado por usuário ${assigneeFilter})`
        : "";
      console.log(
        `[ClickUp Ext] Buscando tarefas globalmente no Team ID: ${teamId}${filterMsg}`
      );

      for (const s of fromStatuses) {
        try {
          const batch = await getTasksByStatusInTeam(
            token,
            teamId,
            s,
            assigneeFilter
          );
          allTasks.push(
            ...batch.map((t) => ({
              id: t.id,
              name: t.name || "Sem título",
              status: t.status?.status || s,
              url: t.url || "",
              assignees: (t.assignees || []).map((a) => ({
                id: String(a.id),
                username: a.username || "Sem nome",
              })),
              list: {
                id: t.list?.id || "unknown",
                name: t.list?.name || "Lista desconhecida",
              },
            }))
          );
        } catch (err) {
          console.error(
            `[ClickUp Ext] Erro ao buscar tarefas com status "${s}":`,
            err
          );
        }
      }
    } else {
      // Busca tradicional por listas
      console.log(
        `[ClickUp Ext] Buscando listas com Team ID: ${teamId}, Space ID: ${spaceId}, List IDs: ${listIds}`
      );

      const targetLists = await collectTargetLists(token, {
        teamId,
        spaceId,
        listIds,
      });

      console.log(
        `[ClickUp Ext] ${targetLists.length} lista(s) encontrada(s):`,
        targetLists.map((l) => ({ id: l.id, name: l.name }))
      );

      if (!targetLists.length) {
        return {
          success: false,
          message: "Nenhuma lista encontrada com os filtros.",
          tasks: [],
        };
      }

      for (const list of targetLists) {
        console.log(
          `[ClickUp Ext] Buscando tarefas na lista "${list.name || list.id}"...`
        );

        for (const s of fromStatuses) {
          try {
            console.log(
              `[ClickUp Ext] Procurando status "${s}" na lista ${list.id}...`
            );
            const batch = await getTasksByStatus(token, list.id, s);
            console.log(
              `[ClickUp Ext] Encontradas ${batch.length} tarefa(s) com status "${s}"`
            );

            allTasks.push(
              ...batch.map((t) => ({
                id: t.id,
                name: t.name || "Sem título",
                status: t.status?.status || s,
                url: t.url || "",
                assignees: (t.assignees || []).map((a) => ({
                  id: String(a.id),
                  username: a.username || "Sem nome",
                })),
                list: { id: list.id, name: list.name || list.id || "Lista" },
              }))
            );
            await sleep(100);
          } catch (err) {
            console.error(
              `[ClickUp Ext] Erro ao buscar tarefas da lista ${list.id}:`,
              err
            );
            // Continue com as outras listas mesmo se uma falhar
          }
        }
      }
    }

    // dedup
    const seen = new Set();
    allTasks = allTasks.filter((t) => !seen.has(t.id) && seen.add(t.id));

    return {
      success: true,
      message: `${allTasks.length} tarefa(s) encontrada(s)`,
      tasks: allTasks,
    };
  } catch (e) {
    console.error("[ClickUp Ext] Erro ao escanear:", e);

    // Mensagem mais específica para erro 401
    let errorMsg = String(e.message || e);
    if (errorMsg.includes("401")) {
      errorMsg =
        "Erro de autenticação (401). Verifique se o Token está correto nas Opções.";
    }

    return {
      success: false,
      message: errorMsg,
      tasks: [],
    };
  }
}

// messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "RUN_MIGRATION_NOW") {
    runMigration().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "SCAN_TASKS") {
    const assigneeFilter = msg.assigneeFilter || null;
    scanTasks(assigneeFilter).then(sendResponse);
    return true;
  }
  if (msg && msg.type === "SCAN_ALL_TASKS") {
    const assigneeFilter = msg.assigneeFilter || null;
    (async () => {
      const cfg = await getCfg();
      const token = cfg[STORAGE_KEYS.token];
      const teamId = (cfg[STORAGE_KEYS.teamId] || "").trim();

      if (!token) {
        return {
          success: false,
          message: "Token ausente. Configure em Opções.",
          tasks: [],
        };
      }

      if (!teamId) {
        return {
          success: false,
          message: "Team ID não configurado",
          tasks: [],
        };
      }

      try {
        const allTasks = await getAllTasksInTeam(token, teamId, assigneeFilter);

        const mappedTasks = allTasks.map((t) => ({
          id: t.id,
          name: t.name || "Sem título",
          status: t.status?.status || "sem status",
          url: t.url || "",
          parent: t.parent || null,
          assignees: (t.assignees || []).map((a) => ({
            id: String(a.id),
            username: a.username || "Sem nome",
          })),
          list: {
            id: t.list?.id || "unknown",
            name: t.list?.name || "Lista desconhecida",
          },
        }));

        return {
          success: true,
          message: `${mappedTasks.length} tarefa(s) encontrada(s)`,
          tasks: mappedTasks,
        };
      } catch (e) {
        console.error("[ClickUp Ext] Erro ao buscar todas as tarefas:", e);
        return {
          success: false,
          message: String(e.message || e),
          tasks: [],
        };
      }
    })().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "GET_USER_INFO") {
    (async () => {
      const cfg = await getCfg();
      const token = cfg[STORAGE_KEYS.token];
      if (!token) {
        return { success: false, message: "Token não configurado", user: null };
      }
      try {
        const user = await getAuthorizedUser(token);
        return { success: true, user };
      } catch (err) {
        return {
          success: false,
          message: String(err.message || err),
          user: null,
        };
      }
    })().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "CLOSE_TASKS") {
    (async () => {
      const cfg = await getCfg();
      const token = cfg[STORAGE_KEYS.token];
      const toStatus = (cfg[STORAGE_KEYS.toStatus] || "fechado").trim();
      const taskIds = msg.taskIds || [];

      if (!token) {
        return { success: false, message: "Token não configurado", updated: 0 };
      }

      if (taskIds.length === 0) {
        return {
          success: false,
          message: "Nenhuma tarefa selecionada",
          updated: 0,
        };
      }

      console.log(`[ClickUp Ext] Fechando ${taskIds.length} tarefa(s)...`);

      let updated = 0;
      const errors = [];

      for (const taskId of taskIds) {
        try {
          await updateTaskStatus(token, taskId, toStatus);
          updated++;
          console.log(`[ClickUp Ext] ✓ Tarefa ${taskId} fechada`);
          await sleep(150);
        } catch (err) {
          console.error(
            `[ClickUp Ext] ✗ Erro ao fechar tarefa ${taskId}:`,
            err
          );
          errors.push(`${taskId}: ${err.message || err}`);
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          message: `${updated} tarefa(s) fechada(s), ${errors.length} erro(s)`,
          updated,
          errors,
        };
      }

      return {
        success: true,
        message: `${updated} tarefa(s) fechada(s) com sucesso`,
        updated,
      };
    })().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "CHANGE_TASKS_STATUS") {
    (async () => {
      const cfg = await getCfg();
      const token = cfg[STORAGE_KEYS.token];
      const targetStatus = msg.targetStatus;
      const taskIds = msg.taskIds || [];

      if (!token) {
        return { success: false, message: "Token não configurado", updated: 0 };
      }

      if (!targetStatus) {
        return {
          success: false,
          message: "Status de destino não informado",
          updated: 0,
        };
      }

      if (taskIds.length === 0) {
        return {
          success: false,
          message: "Nenhuma tarefa selecionada",
          updated: 0,
        };
      }

      console.log(
        `[ClickUp Ext] Alterando ${taskIds.length} tarefa(s) para "${targetStatus}"...`
      );

      let updated = 0;
      const errors = [];

      for (const taskId of taskIds) {
        try {
          await updateTaskStatus(token, taskId, targetStatus);
          updated++;
          console.log(
            `[ClickUp Ext] ✓ Tarefa ${taskId} alterada para "${targetStatus}"`
          );
          await sleep(150);
        } catch (err) {
          console.error(
            `[ClickUp Ext] ✗ Erro ao alterar tarefa ${taskId}:`,
            err
          );
          errors.push(`${taskId}: ${err.message || err}`);
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          message: `${updated} tarefa(s) alterada(s), ${errors.length} erro(s)`,
          updated,
          errors,
        };
      }

      return {
        success: true,
        message: `${updated} tarefa(s) alterada(s) com sucesso`,
        updated,
      };
    })().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "GET_USER_TEAMS") {
    (async () => {
      const cfg = await getCfg();
      const token = cfg[STORAGE_KEYS.token];
      if (!token) {
        return { success: false, message: "Token não configurado", teams: [] };
      }
      try {
        const teams = await getAuthorizedTeams(token);
        return { success: true, teams };
      } catch (err) {
        return {
          success: false,
          message: String(err.message || err),
          teams: [],
        };
      }
    })().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "GET_TEAM_MEMBERS") {
    (async () => {
      const cfg = await getCfg();
      const token = cfg[STORAGE_KEYS.token];
      const teamId = msg.teamId;

      if (!token || !teamId) {
        return {
          success: false,
          message: "Token ou Team ID não fornecido",
          members: [],
        };
      }

      try {
        const members = await getTeamMembers(token, teamId);
        // Retornar apenas info necessária
        const formattedMembers = members.map((m) => ({
          id: m.user?.id || m.id,
          username: m.user?.username || "Sem nome",
          email: m.user?.email || "",
          color: m.user?.color || "#7b68ee",
        }));
        return { success: true, members: formattedMembers };
      } catch (err) {
        console.error("[ClickUp Ext] Erro ao buscar membros:", err);
        return {
          success: false,
          message: String(err.message || err),
          members: [],
        };
      }
    })().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "GET_ALL_STATUSES") {
    (async () => {
      const cfg = await getCfg();
      const token = cfg[STORAGE_KEYS.token];
      const teamId = msg.teamId;

      if (!token || !teamId) {
        return {
          success: false,
          message: "Token ou Team ID não fornecido",
          statuses: [],
        };
      }

      try {
        console.log(`[ClickUp Ext] GET_ALL_STATUSES - Team ID: ${teamId}`);

        // SOLUÇÃO: Buscar status diretamente das tarefas (mais confiável)
        console.log(`[ClickUp Ext] Buscando status via tarefas...`);
        const allTasks = await getAllTasksInTeam(token, teamId, null);
        console.log(`[ClickUp Ext] ${allTasks.length} tarefas encontradas`);

        const allStatuses = new Set();
        allTasks.forEach((task) => {
          if (task.status && task.status.status) {
            allStatuses.add(task.status.status);
          }
        });

        const statusesArray = Array.from(allStatuses).sort();
        console.log(
          `[ClickUp Ext] Total de status únicos: ${statusesArray.length}`,
          statusesArray
        );

        return {
          success: true,
          statuses: statusesArray,
        };
      } catch (err) {
        console.error("[ClickUp Ext] Erro ao buscar todos os status:", err);
        return {
          success: false,
          message: String(err.message || err),
          statuses: [],
        };
      }
    })().then(sendResponse);
    return true;
  }
  if (msg && msg.type === "GET_SPACES_WITH_TASKS") {
    (async () => {
      const cfg = await getCfg();
      const token = cfg[STORAGE_KEYS.token];
      const teamId = msg.teamId;
      const fromStatusRaw = cfg[STORAGE_KEYS.fromStatus] || "complete";

      if (!token || !teamId) {
        return {
          success: false,
          message: "Token ou Team ID não fornecido",
          spaces: [],
        };
      }

      try {
        const fromStatuses = fromStatusRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const spaces = await getSpaces(token, teamId);

        // Para cada space, contar tarefas com status especificado
        const spacesWithCount = await Promise.all(
          spaces.map(async (space) => {
            let taskCount = 0;

            // Buscar tarefas do space usando a API global
            for (const status of fromStatuses) {
              try {
                // Buscar tarefas no team filtradas por space
                const url = `${API_BASE}/team/${teamId}/task?archived=false&space_ids[]=${
                  space.id
                }&statuses[]=${encodeURIComponent(status)}`;
                const data = await fetchJSON(url, token);
                taskCount += (data.tasks || []).length;
              } catch (err) {
                console.warn(
                  `[ClickUp Ext] Erro ao contar tarefas do space ${space.id}:`,
                  err
                );
              }
            }

            return {
              id: space.id,
              name: space.name,
              taskCount,
              color: space.color || null,
            };
          })
        );

        // Filtrar apenas spaces com tarefas
        const spacesWithTasks = spacesWithCount.filter((s) => s.taskCount > 0);

        return {
          success: true,
          spaces: spacesWithTasks,
          allSpaces: spacesWithCount,
        };
      } catch (err) {
        return {
          success: false,
          message: String(err.message || err),
          spaces: [],
        };
      }
    })().then(sendResponse);
    return true;
  }
});

// sanity log
chrome.runtime.onInstalled.addListener(() => {
  console.log("[ClickUp Ext] installed");
});
