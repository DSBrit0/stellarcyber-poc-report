# 🔍 Diagnóstico: Erro de Login - "Não foi possível alcançar a instância"

## ❌ Problema Identificado

Quando você insere os dados e tenta fazer login, recebe:
```
Não foi possível alcançar a instância — verifique a URL e a rede.
```

## 🔧 Raiz da Causa

O erro vem de 3 possíveis problemas no fluxo:

### 1. **URL Padrão Inválida (FIXADO)**
**Antes:**
```javascript
// Login.jsx linha 86
const [form, setForm] = useState({ 
  url: 'https://poc.stellarcyber.cloud',  // ← URL fake/não acessível
  username: '',
  password: '',
  tenantId: ''
})
```

**Depois:**
```javascript
const [form, setForm] = useState({ 
  url: '',  // ← Campo vazio, usuário deve digitar
  username: '',
  password: '',
  tenantId: ''
})
```

### 2. **Sem Validação de Conectividade (FIXADO)**
Antes: O usuário não sabia se a URL era acessível até clicar em "Conectar"

Depois: Adicionado botão "Testar Conectividade" que valida ANTES de tentar autenticar
```javascript
// Novo em auth.js
export async function testConnectivity(url) {
  // Faz HEAD request para validar se URL é acessível
  // Retorna: { reachable: true/false, status, error }
}
```

### 3. **Mensagens de Erro Genéricas (FIXADO)**
**Antes:**
```
"Não foi possível alcançar a instância — verifique a URL e a rede."
```

**Depois:**
```
"Não foi possível conectar a seu-dominio.com. Verifique:
1. URL está correta?
2. Instância está acessível?
3. Há bloqueio de firewall/VPN?"
```

---

## 📋 Fluxo Correto Agora

```
Login Page
  ↓
[1] Usuário digita URL da instância
  ↓
[2] Clica em "Testar Conectividade" (novo botão)
  ├─ ✓ URL acessível → pode prosseguir
  └─ ✗ Erro de rede → mostra motivo específico
  ↓
[3] Digita credenciais (usuário + senha)
  ↓
[4] Clica em "Conectar"
  ├─ Envia POST para: https://[URL]/connect/api/v1/access_token
  ├─ Com HTTP Basic Auth: username + password
  ├─ Recebe token JWT (ou erro MFA)
  └─ Se MFA: vai para etapa 2 (OTP)
  ↓
[5] Com token valido → redireciona para /report
```

---

## ✅ Checklist para Usar

Quando tentar fazer login:

- [ ] **Passo 1:** Insira a URL correta (ex: `https://minha-instancia.stellarcyber.com`)
- [ ] **Passo 2:** Clique em "Testar Conectividade" para validar
  - Se ✓ verde: URL está acessível, continue
  - Se ✗ vermelho: Verifique a URL, VPN, firewall
- [ ] **Passo 3:** Insira usuário e senha
- [ ] **Passo 4:** Clique em "Conectar"
- [ ] **Passo 5:** Se MFA ativado, digite o código

---

## 🔐 Fluxo de Autenticação Detalhado

```javascript
// STEP 1: Credenciais
POST https://[URL]/connect/api/v1/access_token
Headers: Authorization: Basic [base64(user:pass)]
Response: {
  access_token: "eyJhbGciOi...",  // JWT
  token_type: "Bearer",
  mfa_required: false              // ou true
}

// STEP 2 (se MFA): OTP
POST https://[URL]/connect/api/v1/access_token?otp=123456
Headers: Authorization: Basic [base64(user:pass)]
Response: {
  access_token: "eyJhbGciOi...",  // Novo JWT com MFA validado
  token_type: "Bearer"
}

// STEP 3: Chamadas autenticadas (com token)
GET https://[URL]/connect/api/v1/cases
GET https://[URL]/connect/api/v1/tenants
Headers: Authorization: Bearer [access_token]
```

---

## 🚨 Erros Comuns e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| "Não foi possível conectar a seu-dominio.com" | URL errada ou instância offline | Verifique a URL, tente testar conectividade |
| "HTTP 401 — credenciais inválidas" | Usuário/senha incorretos | Verifique credenciais |
| "Código de autenticação inválido" | OTP errado ou expirado | Gere novo código no authenticator |
| "Timeout" | Instância lenta ou rede lenta | Aguarde e tente novamente |

---

## 📝 Alterações Implementadas

### Arquivo: `src/pages/Login.jsx`
- ✅ Removido URL padrão (`https://poc.stellarcyber.cloud`)
- ✅ Adicionado ícone Check/X nos imports
- ✅ Adicionado estado `urlStatus` e `testingUrl`
- ✅ Adicionada função `handleTestUrl()`
- ✅ Adicionado botão "Testar Conectividade"
- ✅ Adicionado feedback visual (verde/vermelho) do status

### Arquivo: `src/services/auth.js`
- ✅ Adicionada função `testConnectivity(url)`
- ✅ Melhorado debug com timestamp
- ✅ Exportada função para ser usada no Login

### Arquivo: `src/utils/logger.js`
- ✅ Melhorada mensagem de erro de rede (linha 305)
- ✅ Adicionada extração do hostname
- ✅ Adicionado checklist de soluções possíveis

---

## 🧪 Como Testar

1. **Abra a aplicação:** `npm run dev` → http://localhost:5173
2. **Na página de login:**
   - Deixe o campo URL vazio e clique em "Conectar" → erro de validação
   - Digite URL inválida e clique em "Testar Conectividade" → mostra erro específico
   - Digite URL válida e clique em "Testar Conectividade" → mostra se está acessível
   - Preencha credenciais e clique em "Conectar"
3. **Verifique os logs:** F12 → DevTools → Console para ver detalhes

---

## ℹ️ Próximos Passos

Se ainda tiver erro:

1. **Verifique a URL:**
   - Está correto o domínio/IP?
   - Está usando HTTPS?
   - Há porta específica? (ex: :8443)

2. **Verifique a rede:**
   - Está conectado à VPN se necessário?
   - Há firewall/proxy bloqueando?
   - Teste acesso no navegador diretamente (apenas URL + ENTER)

3. **Verifique as credenciais:**
   - Usuário e senha estão corretos?
   - Conta tem acesso à API?
   - MFA está ativado?

4. **Verifique os logs:**
   - Abra DevTools (F12) e vá na aba Console
   - Procure por mensagens `[ERROR] [auth]`
   - Copie a mensagem de erro e verifique

---

## 🔗 Referência Rápida

- **Configuração de endpoints:** `src/services/endpoints.js`
- **Cliente HTTP:** `src/services/apiClient.js` (retry automático, Bearer token)
- **Contexto de auth:** `src/context/AuthContext.jsx` (sessionStorage, 2-step flow)
- **Logs:** Acessar via `src/utils/logger.js` → `getLogs()` no console
