# 🔌 Como Conectar a Extensão com o Backend

## 📁 Estrutura da Extensão

```
sua-extensao/
├── manifest.json
├── popup.html
├── popup.js
└── background.js (opcional)
```

---

## 1️⃣ manifest.json

```json
{
  "manifest_version": 3,
  "name": "ClickUp Extension",
  "version": "1.0",
  "description": "Extensão ClickUp com OAuth",
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "http://localhost:3000/*",
    "https://*.clickup.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  }
}
```

---

## 2️⃣ popup.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      width: 300px;
      padding: 20px;
      font-family: Arial, sans-serif;
    }
    .status {
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 10px;
    }
    .connected {
      background: #d4edda;
      color: #155724;
    }
    .disconnected {
      background: #f8d7da;
      color: #721c24;
    }
    button {
      width: 100%;
      padding: 10px;
      margin: 5px 0;
      cursor: pointer;
      border: none;
      border-radius: 5px;
      font-size: 14px;
    }
    .connect-btn {
      background: #7B68EE;
      color: white;
    }
    .connect-btn:hover {
      background: #6A5ACD;
    }
    .disconnect-btn {
      background: #dc3545;
      color: white;
    }
    #tokenDisplay {
      font-size: 10px;
      word-break: break-all;
      padding: 5px;
      background: #f0f0f0;
      margin: 10px 0;
      max-height: 60px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <h2>🚀 ClickUp OAuth</h2>
  
  <div id="status" class="status disconnected">
    ❌ Não conectado
  </div>

  <div id="tokenInfo" style="display: none;">
    <strong>Token:</strong>
    <div id="tokenDisplay"></div>
  </div>

  <button id="connectBtn" class="connect-btn">
    🔐 Conectar com ClickUp
  </button>

  <button id="disconnectBtn" class="disconnect-btn" style="display: none;">
    🔓 Desconectar
  </button>

  <button id="testBtn" style="display: none; background: #28a745; color: white;">
    🧪 Testar API
  </button>

  <div id="result" style="margin-top: 10px;"></div>

  <script src="popup.js"></script>
</body>
</html>
```

---

## 3️⃣ popup.js

```javascript
// URL do seu backend (altere para ngrok em produção)
const BACKEND_URL = 'http://localhost:3000';

// Elementos DOM
const statusDiv = document.getElementById('status');
const tokenInfo = document.getElementById('tokenInfo');
const tokenDisplay = document.getElementById('tokenDisplay');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const testBtn = document.getElementById('testBtn');
const resultDiv = document.getElementById('result');

// Verifica se já está conectado ao carregar
checkConnection();

// Botão de Conectar
connectBtn.addEventListener('click', () => {
  // Abre popup OAuth
  const authWindow = window.open(
    `${BACKEND_URL}/auth/clickup`,
    'ClickUp OAuth',
    'width=600,height=700'
  );

  // Escuta mensagem do backend
  window.addEventListener('message', handleOAuthCallback);
});

// Botão de Desconectar
disconnectBtn.addEventListener('click', () => {
  chrome.storage.sync.remove('clickupToken', () => {
    updateUI(false);
    resultDiv.textContent = '✅ Desconectado com sucesso!';
    setTimeout(() => resultDiv.textContent = '', 3000);
  });
});

// Botão de Testar API
testBtn.addEventListener('click', async () => {
  chrome.storage.sync.get('clickupToken', async (data) => {
    if (data.clickupToken) {
      try {
        resultDiv.textContent = '⏳ Testando...';
        
        // Testa API do ClickUp - busca informações do usuário
        const response = await fetch('https://api.clickup.com/api/v2/user', {
          headers: {
            'Authorization': data.clickupToken
          }
        });

        if (response.ok) {
          const userData = await response.json();
          resultDiv.innerHTML = `
            ✅ API funcionando!<br>
            <strong>Usuário:</strong> ${userData.user.username}<br>
            <strong>Email:</strong> ${userData.user.email}
          `;
        } else {
          resultDiv.textContent = '❌ Erro ao testar API';
        }
      } catch (error) {
        resultDiv.textContent = `❌ Erro: ${error.message}`;
      }
    }
  });
});

// Função que recebe o token do backend
function handleOAuthCallback(event) {
  // Verifica se é a mensagem correta
  if (event.data.type === 'CLICKUP_TOKEN_RECEIVED') {
    const token = event.data.token;
    
    // Salva o token no Chrome Storage
    chrome.storage.sync.set({ clickupToken: token }, () => {
      console.log('✅ Token salvo:', token);
      updateUI(true, token);
      resultDiv.textContent = '✅ Conectado com sucesso!';
      setTimeout(() => resultDiv.textContent = '', 3000);
    });

    // Remove o listener após receber
    window.removeEventListener('message', handleOAuthCallback);
  }
}

// Verifica se já existe token salvo
function checkConnection() {
  chrome.storage.sync.get('clickupToken', (data) => {
    if (data.clickupToken) {
      updateUI(true, data.clickupToken);
    } else {
      updateUI(false);
    }
  });
}

// Atualiza interface baseado no status
function updateUI(connected, token = '') {
  if (connected) {
    statusDiv.textContent = '✅ Conectado';
    statusDiv.className = 'status connected';
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
    testBtn.style.display = 'block';
    tokenInfo.style.display = 'block';
    tokenDisplay.textContent = token;
  } else {
    statusDiv.textContent = '❌ Não conectado';
    statusDiv.className = 'status disconnected';
    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
    testBtn.style.display = 'none';
    tokenInfo.style.display = 'none';
  }
}
```

---

## 🚀 Como Usar

### 1. **Adicione os arquivos acima na sua extensão**

### 2. **Carregue a extensão no Chrome:**
   - Abra `chrome://extensions/`
   - Ative "Modo do desenvolvedor"
   - Clique em "Carregar sem compactação"
   - Selecione a pasta da extensão

### 3. **Inicie o backend:**
   ```bash
   npm start
   ```

### 4. **Teste:**
   - Clique no ícone da extensão
   - Clique em "🔐 Conectar com ClickUp"
   - Autorize no ClickUp
   - O token será salvo automaticamente!
   - Clique em "🧪 Testar API" para verificar

---

## 🌐 Para usar com ngrok (Internet):

1. **Instale ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Inicie ngrok:**
   ```bash
   ngrok http 3000
   ```

3. **Atualize o .env com a URL do ngrok:**
   ```
   CLICKUP_REDIRECT_URI=https://sua-url.ngrok.io/auth/clickup/callback
   ```

4. **Atualize também no painel do ClickUp:**
   - Vá em https://app.clickup.com/settings/apps
   - Edite sua app OAuth
   - Adicione a redirect URI do ngrok

5. **Atualize o popup.js:**
   ```javascript
   const BACKEND_URL = 'https://sua-url.ngrok.io';
   ```

---

## 📝 Como Usar o Token nas Requisições

Depois de conectado, use o token em qualquer requisição:

```javascript
chrome.storage.sync.get('clickupToken', async (data) => {
  if (data.clickupToken) {
    const response = await fetch('https://api.clickup.com/api/v2/team', {
      headers: {
        'Authorization': data.clickupToken
      }
    });
    const teams = await response.json();
    console.log(teams);
  }
});
```

---

## ✅ Pronto!

Agora sua extensão está conectada ao backend e pode usar a API do ClickUp sem pedir o token manualmente ao usuário! 🎉
