const STORAGE_KEYS = {
  token: "cu_token",
};

// ⚠️ ALTERE ESTA URL PARA O ENDEREÇO DO SEU BACKEND
const OAUTH_SERVER_URL = "http://localhost:3000";

// Domínios permitidos
const ALLOWED_DOMAINS = [
  "sinergiaeducacao.com.br",
  "liceufranco.g12.br",
  "cel.g12.br",
];

console.log("✅ options.js carregado");
console.log("Backend URL:", OAUTH_SERVER_URL);
console.log("Domínios permitidos:", ALLOWED_DOMAINS);

// Check if user is already authenticated
function checkAuth() {
  chrome.storage.sync.get([STORAGE_KEYS.token], (data) => {
    if (data[STORAGE_KEYS.token]) {
      getUserInfo(data[STORAGE_KEYS.token]);
    }
  });
}

// Validate token and save if domain is allowed
async function validateTokenAndSave(token, authWindow) {
  try {
    const btn = document.getElementById("oauthBtn");
    btn.innerHTML = "⏳ Validando acesso...";

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

    console.log("[OAuth] Email do usuário:", userEmail);
    console.log("[OAuth] Domínio:", emailDomain);

    // Verificar se o domínio é permitido
    const isAllowedDomain = ALLOWED_DOMAINS.some(
      (domain) => emailDomain === domain
    );

    if (!isAllowedDomain) {
      console.warn("❌ Domínio não permitido:", emailDomain);
      showStatus(
        `❌ Acesso negado! Apenas emails dos domínios: ${ALLOWED_DOMAINS.join(
          ", "
        )} são permitidos.`,
        "error"
      );

      // Close auth window if still open
      if (authWindow && !authWindow.closed) {
        authWindow.close();
      }

      btn.disabled = false;
      btn.innerHTML =
        '<img src="google.png" alt="Google" style="width: 20px; height: 20px;"> Fazer Login com ClickUp';
      return;
    }

    // Domínio permitido - salvar token
    chrome.storage.sync.set({ [STORAGE_KEYS.token]: token }, () => {
      console.log("[OAuth] Token salvo com sucesso");
      showStatus("✅ Login realizado com sucesso!", "success");
      getUserInfo(token);
    });

    // Close auth window if still open
    if (authWindow && !authWindow.closed) {
      authWindow.close();
    }
  } catch (error) {
    console.error("❌ Erro ao validar token:", error);
    showStatus("❌ Erro ao validar acesso. Tente novamente.", "error");

    if (authWindow && !authWindow.closed) {
      authWindow.close();
    }

    const btn = document.getElementById("oauthBtn");
    btn.disabled = false;
    btn.innerHTML =
      '<img src="google.png" alt="Google" style="width: 20px; height: 20px;"> Fazer Login com ClickUp';
  }
}

// Get user info from ClickUp API (called after token is already validated)
async function getUserInfo(token) {
  try {
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

    // Show user info
    document.getElementById("userName").textContent =
      user.username || user.email;
    document.getElementById("userInfo").classList.add("show");
    document.getElementById("oauthBtn").innerHTML = "✅ Já Conectado";
    document.getElementById("oauthBtn").disabled = true;
  } catch (error) {
    console.error("Erro ao verificar token:", error);
    // Token inválido, limpar
    chrome.storage.sync.remove([STORAGE_KEYS.token]);
  }
}

// OAuth Login
const oauthBtnElement = document.getElementById("oauthBtn");
if (oauthBtnElement) {
  console.log("✅ Adicionando listener ao botão OAuth");

  oauthBtnElement.addEventListener("click", (e) => {
    console.log("[OAuth] Botão clicado - evento:", e);
    console.log(
      "[OAuth] Estado do botão - disabled:",
      oauthBtnElement.disabled
    );

    const btn = document.getElementById("oauthBtn");
    btn.disabled = true;
    btn.innerHTML = "⏳ Abrindo janela de login...";

    // Open OAuth window
    console.log("[OAuth] Abrindo janela:", `${OAUTH_SERVER_URL}/auth/clickup`);

    const authWindow = window.open(
      `${OAUTH_SERVER_URL}/auth/clickup`,
      "ClickUp OAuth",
      "width=600,height=700,left=200,top=100"
    );

    if (!authWindow) {
      console.error("[OAuth] Não foi possível abrir a janela");
      showStatus(
        "❌ Não foi possível abrir a janela. Verifique se o popup não foi bloqueado.",
        "error"
      );
      btn.disabled = false;
      btn.innerHTML =
        '<img src="google.png" alt="Google" style="width: 20px; height: 20px;"> Fazer Login com ClickUp';
      return;
    }

    console.log("[OAuth] Janela aberta com sucesso");

    // Listen for message from OAuth callback
    const messageHandler = (event) => {
      console.log("[OAuth] Mensagem recebida:", event.data);

      // Aceitar ambos os formatos de mensagem
      if (
        event.data.type === "CLICKUP_AUTH_SUCCESS" ||
        event.data.type === "CLICKUP_TOKEN_RECEIVED"
      ) {
        const token = event.data.token;

        console.log("[OAuth] Token recebido, validando domínio...");

        // Validar domínio antes de salvar
        validateTokenAndSave(token, authWindow);

        // Remove listener
        window.removeEventListener("message", messageHandler);
      }
    };

    window.addEventListener("message", messageHandler);

    // Check if window was closed manually
    const checkWindowClosed = setInterval(() => {
      if (authWindow.closed) {
        console.log("[OAuth] Janela fechada");
        clearInterval(checkWindowClosed);
        window.removeEventListener("message", messageHandler);

        // Re-enable button if user closed window without completing auth
        chrome.storage.sync.get([STORAGE_KEYS.token], (data) => {
          if (!data[STORAGE_KEYS.token]) {
            btn.disabled = false;
            btn.innerHTML =
              '<img src="google.png" alt="Google" style="width: 20px; height: 20px;"> Fazer Login com ClickUp';
          }
        });
      }
    }, 500);
  });
} else {
  console.error(
    "❌ ERRO: Não foi possível adicionar listener - botão não encontrado!"
  );
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  if (!confirm("Deseja realmente sair?")) return;

  chrome.storage.sync.remove([STORAGE_KEYS.token], () => {
    document.getElementById("userInfo").classList.remove("show");
    document.getElementById("oauthBtn").innerHTML =
      '<img src="google.png" alt="Google" style="width: 20px; height: 20px;"> Fazer Login com ClickUp';
    document.getElementById("oauthBtn").disabled = false;
    showStatus("✅ Logout realizado com sucesso!", "success");
  });
});

// Manual token save
document.getElementById("save").addEventListener("click", () => {
  const token = document.getElementById("token").value.trim();

  if (!token) {
    showStatus("❌ Por favor, insira o token da API", "error");
    return;
  }

  chrome.storage.sync.set({ [STORAGE_KEYS.token]: token }, () => {
    showStatus("✅ Token salvo com sucesso!", "success");
    getUserInfo(token);
    document.getElementById("token").value = "";
  });
});

// Load current token (for manual input)
function load() {
  chrome.storage.sync.get({ [STORAGE_KEYS.token]: "" }, (data) => {
    if (data[STORAGE_KEYS.token]) {
      document.getElementById("token").placeholder = "••••••••••••••••••••";
    }
  });
}

// Show status message
function showStatus(message, type) {
  const msgEl = document.getElementById("msg");
  msgEl.textContent = message;
  msgEl.className = type;

  setTimeout(() => {
    msgEl.style.display = "none";
  }, 4000);
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOM carregado");

  // Verificar se elementos existem
  const oauthBtn = document.getElementById("oauthBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const saveBtn = document.getElementById("save");

  console.log("Elementos encontrados:");
  console.log("- oauthBtn:", oauthBtn ? "✅" : "❌");
  console.log("- logoutBtn:", logoutBtn ? "✅" : "❌");
  console.log("- saveBtn:", saveBtn ? "✅" : "❌");

  if (!oauthBtn) {
    console.error("❌ ERRO: Botão OAuth não encontrado!");
  }

  checkAuth();
  load();
});

// Listen for storage changes (logout from popup)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes[STORAGE_KEYS.token]) {
    const change = changes[STORAGE_KEYS.token];

    // If token was removed (logout)
    if (change.oldValue && !change.newValue) {
      console.log("🔄 Token removido - sincronizando logout");
      document.getElementById("userInfo").classList.remove("show");
      document.getElementById("oauthBtn").innerHTML =
        '<img src="google.png" alt="Google" style="width: 20px; height: 20px;"> Fazer Login com ClickUp';
      document.getElementById("oauthBtn").disabled = false;
      showStatus("✅ Você foi desconectado", "success");
    }
    // If token was added (login)
    else if (!change.oldValue && change.newValue) {
      console.log("🔄 Token adicionado - sincronizando login");
      getUserInfo(change.newValue);
    }
  }
});
