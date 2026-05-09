#!/usr/bin/env node

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── ANSI Color Codes ─────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  bgBlack: '\x1b[40m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgMagenta: '\x1b[45m',
};

// ─── Models ───────────────────────────────────────────────────────────────────
const MODELS = {
  'devmind-ultra2.0': {
    name: 'DevMind Ultra 2.0',
    id: 'devmind-ultra2.0',
    description: 'Máxima capacidade. Raciocínio profundo e análise complexa.',
    tokenMin: 30000,
    tokenMax: 200000,
    badge: `${c.bgMagenta}${c.bold}${c.white} ULTRA ${c.reset}`,
    color: c.brightMagenta,
    icon: '◆',
  },
  'devmind-performance2.0': {
    name: 'DevMind Performance 2.0',
    id: 'devmind-performance2.0',
    description: 'Alto desempenho. Equilíbrio entre velocidade e inteligência.',
    tokenMin: 20000,
    tokenMax: 140000,
    badge: `${c.bgBlue}${c.bold}${c.white} PERF ${c.reset}`,
    color: c.brightBlue,
    icon: '●',
  },
  'devmind-basico2.0': {
    name: 'DevMind Básico 2.0',
    id: 'devmind-basico2.0',
    description: 'Eficiente e rápido. Ideal para tarefas do dia-a-dia.',
    tokenMin: 10000,
    tokenMax: 100000,
    badge: `${c.bgGreen}${c.bold}${c.black} BASIC ${c.reset}`,
    color: c.brightGreen,
    icon: '○',
  },
  'devmind-flash': {
    name: 'DevMind Flash',
    id: 'devmind-flash',
    description: 'Ultra-rápido. Respostas instantâneas para tarefas leves.',
    tokenMin: 15000,
    tokenMax: 160000,
    badge: `${c.bgYellow}${c.bold}${c.black} FLASH ${c.reset}`,
    color: c.brightYellow,
    icon: '⚡',
  },
};

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  currentModel: MODELS['devmind-performance2.0'],
  mode: 'auto', // auto | plan | code | ask
  messages: [],
  totalTokens: 0,
  sessionStart: Date.now(),
  planMode: false,
  cwd: process.cwd(),
  projectName: path.basename(process.cwd()),
  version: '1.0.0',
};

// ─── Config persistence ───────────────────────────────────────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.devmind');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (cfg.model && MODELS[cfg.model]) {
        state.currentModel = MODELS[cfg.model];
      }
    }
  } catch (_) {}
}

function saveConfig() {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ model: state.currentModel.id }, null, 2));
  } catch (_) {}
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTokens(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

function formatDuration(ms) {
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function terminalWidth() {
  return process.stdout.columns || 80;
}

function pad(str, len, char = ' ') {
  const visible = stripAnsi(str).length;
  return str + char.repeat(Math.max(0, len - visible));
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function centerText(text, width) {
  const visible = stripAnsi(text).length;
  const padding = Math.max(0, Math.floor((width - visible) / 2));
  return ' '.repeat(padding) + text;
}

function horizontalLine(char = '─', width) {
  width = width || terminalWidth();
  return char.repeat(width);
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
class Spinner {
  constructor(text = '', color = c.cyan) {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.text = text;
    this.color = color;
    this.idx = 0;
    this.timer = null;
    this.active = false;
  }

  start() {
    this.active = true;
    process.stdout.write('\x1b[?25l'); // hide cursor
    this.timer = setInterval(() => {
      const frame = this.frames[this.idx % this.frames.length];
      process.stdout.write(`\r${this.color}${frame}${c.reset} ${c.gray}${this.text}${c.reset}   `);
      this.idx++;
    }, 80);
    return this;
  }

  update(text) {
    this.text = text;
  }

  stop(finalText = '', success = true) {
    if (this.timer) clearInterval(this.timer);
    this.active = false;
    const icon = success ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    process.stdout.write(`\r${icon} ${finalText}${' '.repeat(20)}\n`);
    process.stdout.write('\x1b[?25h'); // show cursor
  }
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
async function progressBar(label, steps, color = c.cyan) {
  const width = 30;
  for (let i = 0; i <= steps; i++) {
    const pct = i / steps;
    const filled = Math.floor(pct * width);
    const bar = `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(width - filled)}${c.reset}`;
    const pctStr = `${Math.floor(pct * 100)}%`.padStart(4);
    process.stdout.write(`\r  ${c.gray}${label}${c.reset} [${bar}] ${c.bold}${pctStr}${c.reset}`);
    await sleep(randomInt(20, 60));
  }
  process.stdout.write('\n');
}

// ─── Banner ───────────────────────────────────────────────────────────────────
function printBanner() {
  const w = Math.min(terminalWidth(), 80);
  console.log();
  console.log(c.dim + horizontalLine('─', w) + c.reset);
  console.log();

  const title = [
    ` ██████╗ ███████╗██╗   ██╗███╗   ███╗██╗███╗   ██╗██████╗ `,
    ` ██╔══██╗██╔════╝██║   ██║████╗ ████║██║████╗  ██║██╔══██╗`,
    ` ██║  ██║█████╗  ██║   ██║██╔████╔██║██║██╔██╗ ██║██║  ██║`,
    ` ██║  ██║██╔══╝  ╚██╗ ██╔╝██║╚██╔╝██║██║██║╚██╗██║██║  ██║`,
    ` ██████╔╝███████╗ ╚████╔╝ ██║ ╚═╝ ██║██║██║ ╚████║██████╔╝`,
    ` ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ `,
  ];

  title.forEach(line => {
    console.log(centerText(c.brightCyan + c.bold + line + c.reset, w));
  });

  console.log();
  console.log(centerText(`${c.dim}v${state.version} · AI Engineering Assistant${c.reset}`, w));
  console.log();
  console.log(c.dim + horizontalLine('─', w) + c.reset);
  console.log();

  // Model info
  const m = state.currentModel;
  console.log(
    `  ${c.gray}Modelo ativo:${c.reset}  ${m.badge} ${m.color}${m.name}${c.reset}  ` +
    `${c.dim}(${formatTokens(m.tokenMin)}–${formatTokens(m.tokenMax)} tokens/prompt)${c.reset}`
  );
  console.log(
    `  ${c.gray}Projeto:${c.reset}       ${c.bold}${state.projectName}${c.reset}  ` +
    `${c.dim}${state.cwd}${c.reset}`
  );
  console.log(
    `  ${c.gray}Modo:${c.reset}          ${state.planMode ? c.yellow + '◈ Plano' : c.green + '◉ Auto'}${c.reset}`
  );
  console.log();
  console.log(
    `  ${c.dim}Digite ${c.reset}${c.cyan}/help${c.reset}${c.dim} para ver todos os comandos · ` +
    `Ctrl+C para sair${c.reset}`
  );
  console.log();
  console.log(c.dim + horizontalLine('─', w) + c.reset);
  console.log();
}

// ─── Help ─────────────────────────────────────────────────────────────────────
function printHelp() {
  const w = Math.min(terminalWidth(), 80);
  console.log();
  console.log(`  ${c.bold}${c.brightCyan}Comandos DevMind${c.reset}`);
  console.log(`  ${c.dim}${horizontalLine('─', w - 4)}${c.reset}`);

  const cmds = [
    ['  Prompts & Conversa', null],
    ['/help', 'Mostra esta ajuda'],
    ['/clear', 'Limpa o ecrã e reinicia a conversa'],
    ['/reset', 'Reinicia a sessão completamente'],
    ['/exit, /quit', 'Sair do DevMind'],
    ['  Modelos', null],
    ['/models', 'Lista todos os modelos disponíveis'],
    ['/model <id>', 'Troca o modelo ativo'],
    ['  Modos', null],
    ['/plan', 'Ativa o modo Plano (só planeia, não executa)'],
    ['/auto', 'Volta ao modo Automático'],
    ['/mode', 'Mostra o modo atual'],
    ['  Sessão', null],
    ['/tokens', 'Mostra o uso de tokens desta sessão'],
    ['/status', 'Mostra o estado completo da sessão'],
    ['/history', 'Mostra o histórico da conversa'],
    ['  Atalhos de Teclado', null],
    ['Ctrl+C', 'Interrompe / sai'],
    ['Ctrl+L', 'Limpa o ecrã'],
    ['↑ / ↓', 'Navegar no histórico de comandos'],
    ['Tab', 'Auto-completar comandos'],
  ];

  cmds.forEach(([cmd, desc]) => {
    if (!desc) {
      console.log();
      console.log(`  ${c.bold}${c.yellow}${cmd}${c.reset}`);
    } else {
      const cmdStr = `  ${c.cyan}${cmd}${c.reset}`;
      const padding = 30 - stripAnsi(cmdStr).length;
      console.log(`${cmdStr}${' '.repeat(Math.max(1, padding))}${c.gray}${desc}${c.reset}`);
    }
  });
  console.log();
}

// ─── Model list ───────────────────────────────────────────────────────────────
function printModels() {
  console.log();
  console.log(`  ${c.bold}${c.brightCyan}Modelos DevMind Disponíveis${c.reset}`);
  console.log(`  ${c.dim}${horizontalLine('─', 60)}${c.reset}`);
  console.log();

  Object.values(MODELS).forEach(m => {
    const active = m.id === state.currentModel.id ? ` ${c.brightGreen}← ativo${c.reset}` : '';
    console.log(`  ${m.badge} ${c.bold}${m.color}${m.name}${c.reset}${active}`);
    console.log(`  ${c.dim}ID: ${m.id}${c.reset}`);
    console.log(`  ${c.dim}${m.description}${c.reset}`);
    console.log(
      `  ${c.dim}Tokens: ${c.reset}${c.yellow}${formatTokens(m.tokenMin)}${c.reset}${c.dim}–${c.reset}${c.yellow}${formatTokens(m.tokenMax)}${c.reset}${c.dim} por prompt${c.reset}`
    );
    console.log();
  });

  console.log(`  ${c.dim}Usar: ${c.reset}${c.cyan}/model <id>${c.reset}${c.dim} para trocar de modelo${c.reset}`);
  console.log();
}

// ─── Status ───────────────────────────────────────────────────────────────────
function printStatus() {
  const elapsed = Date.now() - state.sessionStart;
  const m = state.currentModel;
  console.log();
  console.log(`  ${c.bold}${c.brightCyan}Estado da Sessão${c.reset}`);
  console.log(`  ${c.dim}${horizontalLine('─', 50)}${c.reset}`);
  console.log(`  ${c.gray}Modelo:${c.reset}      ${m.badge} ${m.color}${m.name}${c.reset}`);
  console.log(`  ${c.gray}Modo:${c.reset}        ${state.planMode ? c.yellow + '◈ Plano' : c.green + '◉ Auto'}${c.reset}`);
  console.log(`  ${c.gray}Projeto:${c.reset}     ${c.bold}${state.projectName}${c.reset}`);
  console.log(`  ${c.gray}Diretório:${c.reset}   ${c.dim}${state.cwd}${c.reset}`);
  console.log(`  ${c.gray}Tokens usados:${c.reset} ${c.yellow}${formatTokens(state.totalTokens)}${c.reset}`);
  console.log(`  ${c.gray}Mensagens:${c.reset}   ${state.messages.length}`);
  console.log(`  ${c.gray}Tempo de sessão:${c.reset} ${formatDuration(elapsed)}`);
  console.log();
}

// ─── Token usage ──────────────────────────────────────────────────────────────
function printTokenUsage() {
  const m = state.currentModel;
  const pct = Math.min(100, (state.totalTokens / (m.tokenMax * 5)) * 100);
  const barWidth = 30;
  const filled = Math.floor((pct / 100) * barWidth);
  const bar = `${c.cyan}${'█'.repeat(filled)}${c.dim}${'░'.repeat(barWidth - filled)}${c.reset}`;

  console.log();
  console.log(`  ${c.bold}Uso de Tokens${c.reset}`);
  console.log(`  [${bar}] ${c.yellow}${formatTokens(state.totalTokens)}${c.reset} tokens totais nesta sessão`);
  console.log(`  ${c.dim}Custo por prompt: ${formatTokens(m.tokenMin)}–${formatTokens(m.tokenMax)} tokens${c.reset}`);
  console.log();
}

// ─── Typing animation ─────────────────────────────────────────────────────────
async function typeText(text, delay = 12) {
  const lines = text.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // fast for non-code lines
    const charDelay = line.startsWith('  ') || line.startsWith('\t') ? 4 : delay;
    for (const char of line) {
      process.stdout.write(char);
      if (Math.random() < 0.3) await sleep(charDelay);
    }
    if (li < lines.length - 1) process.stdout.write('\n');
  }
  process.stdout.write('\n');
}

// ─── Simulate response ────────────────────────────────────────────────────────
async function simulateResponse(prompt) {
  const m = state.currentModel;
  const tokens = randomInt(m.tokenMin, m.tokenMax);
  state.totalTokens += tokens;

  const promptLower = prompt.toLowerCase();

  // ─── Plan mode ────────────────────────────────────────────────────────────
  if (state.planMode) {
    const spinner = new Spinner(`${m.color}A analisar o pedido...${c.reset}`, m.color).start();
    await sleep(randomInt(600, 1200));
    spinner.update('A elaborar plano de execução...');
    await sleep(randomInt(500, 900));
    spinner.stop(`Plano gerado com sucesso  ${c.dim}(${formatTokens(tokens)} tokens)${c.reset}`);

    console.log();
    console.log(`${c.bold}${c.yellow}◈ MODO PLANO${c.reset}`);
    console.log(`${c.dim}${horizontalLine('─', 50)}${c.reset}`);
    console.log(`${c.dim}O DevMind vai planear mas não executar nenhuma ação.${c.reset}`);
    console.log();

    const planSteps = generatePlan(prompt);
    planSteps.forEach((step, i) => {
      console.log(`  ${c.cyan}${i + 1}.${c.reset} ${step}`);
    });

    console.log();
    console.log(`${c.dim}Para executar: ${c.reset}${c.cyan}/auto${c.reset}${c.dim} e repete o pedido.${c.reset}`);
    return;
  }

  // ─── Auto mode – simulate execution ───────────────────────────────────────
  const tasks = generateTasks(promptLower);

  console.log();
  console.log(`${m.color}${c.bold}${m.icon} DevMind (${m.name})${c.reset}`);
  console.log(`${c.dim}${horizontalLine('─', 50)}${c.reset}`);
  console.log();

  // Show thinking
  const spinner = new Spinner(`A processar com ${m.name}...`, m.color);
  spinner.start();
  await sleep(randomInt(800, 1600));
  spinner.update('A analisar contexto do projeto...');
  await sleep(randomInt(400, 800));
  spinner.stop(`Processamento concluído  ${c.dim}(${formatTokens(tokens)} tokens)${c.reset}`);
  console.log();

  // Execute tasks with progress
  for (const task of tasks) {
    await progressBar(task.label, 20, task.color || c.cyan);
    await sleep(randomInt(50, 150));
    console.log(`  ${c.green}✓${c.reset} ${c.bold}${task.label}${c.reset} ${c.dim}— concluído${c.reset}`);
    await sleep(randomInt(100, 250));
  }

  console.log();
  await sleep(300);

  // Generate contextual response
  const response = generateResponse(prompt);
  await typeText(response, 10);

  console.log();
  console.log(
    `${c.dim}${c.italic}─── ${m.name} · ${formatTokens(tokens)} tokens · ` +
    `${formatDuration(randomInt(1200, 4000))} ───${c.reset}`
  );
  console.log();
}

// ─── Generate plan steps ──────────────────────────────────────────────────────
function generatePlan(prompt) {
  const pl = prompt.toLowerCase();
  const plans = [
    [`Analisar a estrutura atual do projeto`, `Identificar ficheiros relevantes para a tarefa`, `Planear as alterações necessárias`, `Validar dependências e imports`, `Executar as modificações em sequência`, `Testar o resultado final`],
    [`Compreender o objetivo principal do pedido`, `Decompor em sub-tarefas menores`, `Definir ordem de execução`, `Identificar possíveis conflitos ou riscos`, `Preparar plano de rollback se necessário`, `Documentar as alterações planeadas`],
    [`Rever o código existente relacionado`, `Planear a nova funcionalidade`, `Definir interface e contratos`, `Planear testes unitários`, `Planear integração com o sistema existente`],
  ];

  if (pl.includes('fix') || pl.includes('bug') || pl.includes('erro')) {
    return ['Identificar a causa raiz do problema', 'Isolar o componente afetado', 'Planear a correção mínima necessária', 'Verificar impacto noutras partes do código', 'Planear testes de regressão'];
  }
  if (pl.includes('test') || pl.includes('teste')) {
    return ['Analisar o código a testar', 'Identificar casos de teste críticos', 'Planear estrutura dos testes', 'Definir mocks e stubs necessários', 'Planear cobertura de código alvo'];
  }
  if (pl.includes('refactor') || pl.includes('optimiz') || pl.includes('melhora')) {
    return ['Analisar o código atual', 'Identificar pontos de melhoria', 'Planear refatoração sem quebrar funcionalidades', 'Definir métricas de sucesso', 'Planear execução incremental'];
  }

  return plans[randomInt(0, plans.length - 1)];
}

// ─── Generate tasks ───────────────────────────────────────────────────────────
function generateTasks(prompt) {
  const taskSets = {
    default: [
      { label: 'Ler contexto do projeto', color: c.cyan },
      { label: 'Analisar dependências', color: c.blue },
      { label: 'Gerar solução', color: c.magenta },
      { label: 'Aplicar alterações', color: c.yellow },
      { label: 'Verificar consistência', color: c.green },
    ],
    create: [
      { label: 'Preparar estrutura de ficheiros', color: c.cyan },
      { label: 'Gerar código base', color: c.magenta },
      { label: 'Adicionar lógica de negócio', color: c.blue },
      { label: 'Escrever ficheiros', color: c.yellow },
      { label: 'Validar saída', color: c.green },
    ],
    fix: [
      { label: 'Analisar stack trace', color: c.red },
      { label: 'Localizar causa do erro', color: c.yellow },
      { label: 'Aplicar correção', color: c.magenta },
      { label: 'Verificar regressões', color: c.cyan },
      { label: 'Confirmar resolução', color: c.green },
    ],
    test: [
      { label: 'Analisar código a testar', color: c.cyan },
      { label: 'Gerar casos de teste', color: c.blue },
      { label: 'Escrever asserções', color: c.magenta },
      { label: 'Configurar mocks', color: c.yellow },
      { label: 'Executar suite de testes', color: c.green },
    ],
  };

  if (prompt.includes('fix') || prompt.includes('bug') || prompt.includes('erro')) return taskSets.fix;
  if (prompt.includes('test') || prompt.includes('spec')) return taskSets.test;
  if (prompt.includes('cria') || prompt.includes('add') || prompt.includes('novo') || prompt.includes('faz')) return taskSets.create;
  return taskSets.default;
}

// ─── Generate response ────────────────────────────────────────────────────────
function generateResponse(prompt) {
  const pl = prompt.toLowerCase();

  if (pl.includes('hello') || pl.includes('olá') || pl.includes('oi')) {
    return `Olá! Sou o **DevMind**, o teu assistente de engenharia de software.\n\nPodes pedir-me para criar código, corrigir bugs, refatorar, escrever testes, ou qualquer tarefa de desenvolvimento. Estou pronto para ajudar!`;
  }

  if (pl.includes('fix') || pl.includes('bug') || pl.includes('erro')) {
    return `✅ Bug identificado e corrigido com sucesso.\n\n**O que foi feito:**\n• Analisei o stack trace e localizei a causa raiz\n• Corrigi a lógica no módulo afetado\n• Adicionei validação para prevenir regressão\n• Verificado que os testes existentes continuam a passar\n\n**Resumo da correção:**\nO erro era causado por um estado inválido na função de inicialização. A correção inclui uma guarda defensiva e tratamento adequado do caso limite.`;
  }

  if (pl.includes('test') || pl.includes('spec') || pl.includes('teste')) {
    return `✅ Suite de testes gerada com sucesso.\n\n**Ficheiros criados:**\n• \`src/__tests__/\` — pasta de testes\n• Cobertura: **94%** das funções críticas\n• **12 testes** escritos (8 unitários, 4 integração)\n\n**Casos cobertos:**\n• Happy path e casos de erro\n• Edge cases e inputs inválidos\n• Mocks configurados para dependências externas`;
  }

  if (pl.includes('refactor') || pl.includes('melhora') || pl.includes('optimiz')) {
    return `✅ Refatoração concluída.\n\n**Melhorias aplicadas:**\n• Complexidade ciclomática reduzida de 18 → 6\n• Funções longas divididas em unidades menores\n• Tipos/interfaces melhorados\n• Eliminado código duplicado (DRY)\n• Performance melhorada (~30% mais rápido)\n\nO código continua a funcionar de forma idêntica — sem quebras de API.`;
  }

  if (pl.includes('cria') || pl.includes('gera') || pl.includes('novo') || pl.includes('add') || pl.includes('faz')) {
    return `✅ Implementação concluída com sucesso.\n\n**Criado:**\n• Lógica principal implementada\n• Tipos e interfaces definidos\n• Tratamento de erros incluído\n• Exportações configuradas\n\n**Próximos passos sugeridos:**\n→ Adicionar testes com \`/test\`\n→ Integrar com o restante do sistema\n→ Rever e ajustar conforme necessário`;
  }

  // Generic success
  return `✅ Tarefa concluída com sucesso.\n\nAnalisei o pedido, apliquei as alterações necessárias e verifiquei a consistência com o projeto existente. Tudo está a funcionar como esperado.\n\n${c.dim}Se precisares de ajustes ou queres explorar outra direção, é só pedir.${c.reset}`;
}

// ─── Command handler ──────────────────────────────────────────────────────────
async function handleCommand(input) {
  const [cmd, ...args] = input.trim().split(/\s+/);
  const arg = args.join(' ');

  switch (cmd) {
    case '/help':
    case '/?':
      printHelp();
      return true;

    case '/models':
      printModels();
      return true;

    case '/model':
      if (!arg) {
        console.log(`\n  ${c.yellow}Uso: /model <id>${c.reset}\n  Usa ${c.cyan}/models${c.reset} para ver a lista.\n`);
        return true;
      }
      {
        const found = Object.values(MODELS).find(
          m => m.id === arg || m.id.includes(arg.toLowerCase()) || m.name.toLowerCase().includes(arg.toLowerCase())
        );
        if (found) {
          state.currentModel = found;
          saveConfig();
          console.log(`\n  ${c.green}✓${c.reset} Modelo trocado para ${found.badge} ${found.color}${found.name}${c.reset}\n`);
        } else {
          console.log(`\n  ${c.red}✗${c.reset} Modelo não encontrado: ${c.bold}${arg}${c.reset}\n  Usa ${c.cyan}/models${c.reset} para ver IDs disponíveis.\n`);
        }
      }
      return true;

    case '/plan':
      state.planMode = true;
      console.log(`\n  ${c.yellow}◈ Modo Plano ativado${c.reset}\n  ${c.dim}O DevMind vai planear mas não executar ações.${c.reset}\n  ${c.dim}Volta ao modo normal com ${c.reset}${c.cyan}/auto${c.reset}\n`);
      return true;

    case '/auto':
      state.planMode = false;
      console.log(`\n  ${c.green}◉ Modo Auto ativado${c.reset}\n  ${c.dim}O DevMind vai executar as tarefas automaticamente.${c.reset}\n`);
      return true;

    case '/mode':
      console.log(`\n  Modo atual: ${state.planMode ? c.yellow + '◈ Plano' : c.green + '◉ Auto'}${c.reset}\n`);
      return true;

    case '/status':
      printStatus();
      return true;

    case '/tokens':
      printTokenUsage();
      return true;

    case '/history':
      if (state.messages.length === 0) {
        console.log(`\n  ${c.dim}Sem histórico nesta sessão.${c.reset}\n`);
      } else {
        console.log();
        state.messages.slice(-10).forEach((msg, i) => {
          const prefix = msg.role === 'user' ? `${c.cyan}▶${c.reset}` : `${c.magenta}◀${c.reset}`;
          const label = msg.role === 'user' ? 'Tu' : 'DevMind';
          console.log(`  ${prefix} ${c.bold}${label}:${c.reset} ${c.dim}${msg.content.slice(0, 80)}${msg.content.length > 80 ? '...' : ''}${c.reset}`);
        });
        console.log();
      }
      return true;

    case '/clear':
      console.clear();
      printBanner();
      state.messages = [];
      return true;

    case '/reset':
      state.messages = [];
      state.totalTokens = 0;
      state.sessionStart = Date.now();
      state.planMode = false;
      console.clear();
      printBanner();
      console.log(`  ${c.green}✓${c.reset} Sessão reiniciada.\n`);
      return true;

    case '/exit':
    case '/quit':
    case '/q':
      await goodbye();
      process.exit(0);

    default:
      return false;
  }
}

// ─── Goodbye ──────────────────────────────────────────────────────────────────
async function goodbye() {
  const elapsed = Date.now() - state.sessionStart;
  console.log();
  console.log(`${c.dim}${horizontalLine('─', Math.min(terminalWidth(), 80))}${c.reset}`);
  console.log();
  console.log(`  ${c.bold}${c.brightCyan}Até já!${c.reset} ${c.dim}Sessão encerrada.${c.reset}`);
  console.log(`  ${c.dim}Duração: ${formatDuration(elapsed)} · Tokens usados: ${formatTokens(state.totalTokens)} · Mensagens: ${state.messages.length}${c.reset}`);
  console.log();
}

// ─── Prompt input ─────────────────────────────────────────────────────────────
function buildPrompt() {
  const m = state.currentModel;
  const modeIndicator = state.planMode ? `${c.yellow}◈plan${c.reset}` : `${c.green}◉auto${c.reset}`;
  const modelShort = m.icon + ' ' + m.id.replace('devmind-', '').replace('2.0', '');
  return `${c.dim}[${modelShort}]${c.reset} ${modeIndicator} ${c.bold}${c.brightCyan}›${c.reset} `;
}

// ─── Main loop ────────────────────────────────────────────────────────────────
async function main() {
  // Handle CLI flags
  const args = process.argv.slice(2);
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`devmind v${state.version}`);
    process.exit(0);
  }
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`DevMind CLI v${state.version}`);
    console.log('Uso: devmind [opções] [prompt]');
    console.log('');
    console.log('Opções:');
    console.log('  -v, --version     Versão');
    console.log('  -h, --help        Ajuda');
    console.log('  -m, --model <id>  Selecionar modelo');
    console.log('  -p, --plan        Iniciar em modo plano');
    process.exit(0);
  }

  const modelFlag = args.findIndex(a => a === '--model' || a === '-m');
  if (modelFlag !== -1 && args[modelFlag + 1]) {
    const m = Object.values(MODELS).find(m => m.id.includes(args[modelFlag + 1]));
    if (m) state.currentModel = m;
  }

  if (args.includes('--plan') || args.includes('-p')) {
    state.planMode = true;
  }

  loadConfig();

  console.clear();
  printBanner();

  // If a prompt was passed inline, run it and exit
  const inlinePrompt = args.filter(a => !a.startsWith('-')).join(' ').trim();
  if (inlinePrompt && !inlinePrompt.startsWith('/')) {
    await simulateResponse(inlinePrompt);
    process.exit(0);
  }

  // Interactive REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: buildPrompt(),
    historySize: 100,
    completer: (line) => {
      const completions = [
        '/help', '/clear', '/reset', '/exit', '/quit',
        '/models', '/model', '/plan', '/auto', '/mode',
        '/tokens', '/status', '/history',
      ];
      const hits = completions.filter(c => c.startsWith(line));
      return [hits.length ? hits : completions, line];
    },
  });

  // Ctrl+L to clear
  process.stdin.on('keypress', (str, key) => {
    if (key && key.ctrl && key.name === 'l') {
      console.clear();
      printBanner();
      rl.setPrompt(buildPrompt());
      rl.prompt();
    }
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.setPrompt(buildPrompt());
      rl.prompt();
      return;
    }

    // Commands
    if (input.startsWith('/')) {
      const handled = await handleCommand(input);
      if (!handled) {
        console.log(`\n  ${c.yellow}⚠${c.reset}  Comando desconhecido: ${c.bold}${input}${c.reset}. Usa ${c.cyan}/help${c.reset} para ver a lista.\n`);
      }
    } else {
      // Message to model
      state.messages.push({ role: 'user', content: input });
      await simulateResponse(input);
      state.messages.push({ role: 'assistant', content: '(resposta gerada)' });
    }

    rl.setPrompt(buildPrompt());
    rl.prompt();
  });

  rl.on('close', async () => {
    await goodbye();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log();
    await goodbye();
    process.exit(0);
  });
}

main().catch(err => {
  console.error(c.red + 'Erro fatal: ' + c.reset, err.message);
  process.exit(1);
});
