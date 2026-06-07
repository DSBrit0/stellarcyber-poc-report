# Validação de Variáveis - Texto Conclusão do PoC

## Variáveis Utilizadas no Novo Texto

| Variável | Origem | Tipo | Exemplo | Validação |
|----------|--------|------|---------|-----------|
| `{pocStartDate}` | `pocMeta.pocStartDate` | Date | 2026-06-01 | ✅ Preenchido pelo usuário na tela de Report |
| `{pocEndDate}` | `pocMeta.pocEndDate` | Date | 2026-06-30 | ✅ Preenchido pelo usuário na tela de Report |
| `{clientName}` | `pocMeta.clientName` | String | Acme Corp | ✅ Preenchido pelo usuário na tela de Report |
| `{caseCount}` | Calculado: `totalCasesCount` | Number | 127 | ✅ Vindo da API Stellar Cyber |
| `{mitrePct}` | Calculado: `mitreCovPct` | Number | 86 | ✅ Vindo da API Stellar Cyber |

## Fluxo de Dados

```
Tela de Report (User Input)
    ↓
pocMeta.pocStartDate, pocStartDate, clientName
    ↓
API Stellar Cyber
    ↓
cases[], recommendations[]
    ↓
Cálculo: totalCasesCount, mitreCovPct, detectedTactics
    ↓
pdfReport.js - generatePDFReport()
    ↓
body10 replacements com todas as variáveis
    ↓
PDF Gerado com texto completo e dinâmico
```

## Locais de Integração

### 1. Arquivo: `src/i18n/locales/pt.js` (linha 456)
```javascript
body10: 'O PoC executado no período de {pocStartDate} até {pocEndDate} validou que...'
```

### 2. Arquivo: `src/i18n/locales/en.js` (linha 456)
```javascript
body10: 'The PoC executed from {pocStartDate} to {pocEndDate} validated that...'
```

### 3. Arquivo: `src/i18n/locales/es.js` (linha 456)
```javascript
body10: 'El PoC ejecutado en el período de {pocStartDate} a {pocEndDate} validó que...'
```

### 4. Arquivo: `src/services/pdfReport.js` (linhas 1505-1514)
```javascript
const body10 = (s.body10 || "...").replace(...)
  .replace('{pocStartDate}', fmtDate(pocMeta.pocStartDate))
  .replace('{pocEndDate}', fmtDate(pocMeta.pocEndDate))
  .replace('{clientName}', pocMeta.clientName || '...')
  .replace('{caseCount}', totalCasesStr)
  .replace('{mitrePct}', String(mitreCovPct))
```

## Dados Reais do PoC

Todas as variáveis são preenchidas com dados reais:

- **pocStartDate / pocEndDate**: Período do PoC definido pelo usuário
- **clientName**: Nome da organização cliente preenchido no formulário
- **caseCount**: Quantidade real de cases detectados pela plataforma (de `cases[]`)
- **mitrePct**: Percentual real de cobertura MITRE ATT&CK calculado a partir das detecções

## Fallbacks

Caso alguma variável não seja preenchida:
- `pocStartDate` → Usa formatação de data vazia como "—"
- `pocEndDate` → Usa formatação de data vazia como "—"
- `clientName` → Usa placeholder: "the client" / "el cliente" / "o cliente"
- `caseCount` → Usa "0" se não houver cases
- `mitrePct` → Usa "0%" se não houver detecções

## Status de Implementação

✅ **CONCLUÍDO** - Todas as variáveis validadas e integradas
- [x] Português (PT-BR)
- [x] Inglês (EN-US)
- [x] Espanhol (ES-MX)
- [x] Replacements no pdfReport.js
