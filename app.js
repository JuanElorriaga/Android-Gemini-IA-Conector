// Godot Gemini AI Assistant - Core Client Logic

// Configuration & State
const STATE = {
  provider: localStorage.getItem('ai_provider') || 'gemini',
  apiKey: localStorage.getItem('gemini_api_key') || '',
  model: localStorage.getItem('gemini_model') || 'gemini-2.5-flash',
  deepseekApiKey: localStorage.getItem('deepseek_api_key') || '',
  deepseekModel: localStorage.getItem('deepseek_model') || 'deepseek-chat',
  backupEnabled: localStorage.getItem('gemini_backup_enabled') !== 'false',
  systemPrompt: localStorage.getItem('gemini_system_prompt') || `Você é um engenheiro sênior e arquiteto especialista em Godot Engine (Godot 4 e Godot 3) e GDScript.
Você tem acesso às ferramentas locais do projeto para listar arquivos, ler arquivos de código/cenas e criar ou modificar arquivos diretamente na pasta do projeto.
Diretrizes:
1. Sempre que o usuário pedir para criar ou alterar scripts, use a ferramenta 'write_project_file' para gravar os arquivos no projeto.
2. Antes de editar um arquivo existente, utilize 'read_project_file' para entender o código atual e manter a consistência.
3. Use práticas recomendadas de GDScript: tipagem estática (ex: var speed: float = 200.0), nós em PascalCase, variáveis em snake_case.
4. Ao criar ou modificar nós ou cenas (.tscn), forneça explicações claras.
5. Sempre explique sucintamente ao usuário as alterações feitas e como testar no Godot.`,
  directoryHandle: null,
  filesMap: new Map(), // path -> FileSystemFileHandle
  chatHistory: [], // Full conversation history for Gemini API
  deepseekHistory: [], // Full conversation history for DeepSeek API
  selectedImage: null, // { mimeType, data (base64), previewUrl }
  isGenerating: false
};

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('PWA ServiceWorker registrado com sucesso:', reg.scope))
      .catch(err => console.log('Falha ao registrar ServiceWorker:', err));
  });
}

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const welcomeCard = document.getElementById('welcomeCard');
const promptInput = document.getElementById('promptInput');
const sendPromptBtn = document.getElementById('sendPromptBtn');
const selectFolderBtn = document.getElementById('selectFolderBtn');
const selectFolderBtnText = document.getElementById('selectFolderBtnText');
const projectStatusDot = document.getElementById('projectStatusDot');
const projectPathLabel = document.getElementById('projectPathLabel');
const currentModelBadge = document.getElementById('currentModelBadge');

// Image upload elements
const attachImageBtn = document.getElementById('attachImageBtn');
const imageFileInput = document.getElementById('imageFileInput');
const imagePreviewBar = document.getElementById('imagePreviewBar');
const imagePreviewThumb = document.getElementById('imagePreviewThumb');
const removeImgBtn = document.getElementById('removeImgBtn');

// Drawer elements
const filesDrawer = document.getElementById('filesDrawer');
const drawerBackdrop = document.getElementById('drawerBackdrop');
const openDrawerBtn = document.getElementById('openDrawerBtn');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');
const fileTreeContainer = document.getElementById('fileTreeContainer');
const fileFilterInput = document.getElementById('fileFilterInput');

// Settings modal elements
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const providerSelect = document.getElementById('providerSelect');

// Gemini Settings elements
const geminiConfigGroup = document.getElementById('geminiConfigGroup');
const apiKeyInput = document.getElementById('apiKeyInput');
const modelSelect = document.getElementById('modelSelect');
const customModelGroup = document.getElementById('customModelGroup');
const customModelInput = document.getElementById('customModelInput');

// DeepSeek Settings elements
const deepseekConfigGroup = document.getElementById('deepseekConfigGroup');
const deepseekApiKeyInput = document.getElementById('deepseekApiKeyInput');
const deepseekModelSelect = document.getElementById('deepseekModelSelect');
const customDeepseekModelGroup = document.getElementById('customDeepseekModelGroup');
const customDeepseekModelInput = document.getElementById('customDeepseekModelInput');

const backupToggle = document.getElementById('backupToggle');
const systemPromptInput = document.getElementById('systemPromptInput');

// File viewer elements
const fileViewerModal = document.getElementById('fileViewerModal');
const viewerFileName = document.getElementById('viewerFileName');
const viewerFileContent = document.getElementById('viewerFileContent');
const closeViewerBtn = document.getElementById('closeViewerBtn');
const toastEl = document.getElementById('toast');

// Initialize UI
function init() {
  // Update model badge
  updateModelBadge();

  // Load Settings into form
  providerSelect.value = STATE.provider;
  toggleProviderUI(STATE.provider);

  apiKeyInput.value = STATE.apiKey;
  applyModelToForm(STATE.model);

  deepseekApiKeyInput.value = STATE.deepseekApiKey;
  applyDeepseekModelToForm(STATE.deepseekModel);

  backupToggle.checked = STATE.backupEnabled;
  systemPromptInput.value = STATE.systemPrompt;

  // Prompt for API key if missing
  const currentKey = STATE.provider === 'deepseek' ? STATE.deepseekApiKey : STATE.apiKey;
  if (!currentKey) {
    showToast(`Insira sua Chave de API do ${STATE.provider === 'deepseek' ? 'DeepSeek' : 'Gemini'} em Configurações (⚙️)`);
  }

  // Setup Event Listeners
  setupEventListeners();
}

function toggleProviderUI(provider) {
  if (provider === 'deepseek') {
    geminiConfigGroup.style.display = 'none';
    deepseekConfigGroup.style.display = 'block';
  } else {
    geminiConfigGroup.style.display = 'block';
    deepseekConfigGroup.style.display = 'none';
  }
}

function applyModelToForm(modelVal) {
  const options = Array.from(modelSelect.options).map(o => o.value);
  if (options.includes(modelVal) && modelVal !== 'custom') {
    modelSelect.value = modelVal;
    customModelGroup.style.display = 'none';
    customModelInput.value = '';
  } else {
    modelSelect.value = 'custom';
    customModelGroup.style.display = 'block';
    customModelInput.value = modelVal;
  }
}

function applyDeepseekModelToForm(modelVal) {
  const options = Array.from(deepseekModelSelect.options).map(o => o.value);
  if (options.includes(modelVal) && modelVal !== 'custom-deepseek') {
    deepseekModelSelect.value = modelVal;
    customDeepseekModelGroup.style.display = 'none';
    customDeepseekModelInput.value = '';
  } else {
    deepseekModelSelect.value = 'custom-deepseek';
    customDeepseekModelGroup.style.display = 'block';
    customDeepseekModelInput.value = modelVal;
  }
}

function updateModelBadge() {
  if (STATE.provider === 'deepseek') {
    if (STATE.deepseekModel === 'deepseek-reasoner') {
      currentModelBadge.textContent = 'DeepSeek R1';
    } else if (STATE.deepseekModel === 'deepseek-chat') {
      currentModelBadge.textContent = 'DeepSeek V3';
    } else {
      currentModelBadge.textContent = STATE.deepseekModel.replace('deepseek-', '');
    }
    return;
  }

  // Gemini Badges
  if (STATE.model.includes('argon')) {
    currentModelBadge.textContent = '4.0 Argon';
  } else if (STATE.model.startsWith('gemini-')) {
    const raw = STATE.model.replace('gemini-', '');
    currentModelBadge.textContent = raw.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } else {
    currentModelBadge.textContent = STATE.model;
  }
}

function showToast(msg, duration = 3000) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), duration);
}

// Event Listeners Setup
function setupEventListeners() {
  // Folder selector
  selectFolderBtn.addEventListener('click', handleSelectFolder);

  // Settings Modal
  openSettingsBtn.addEventListener('click', () => {
    providerSelect.value = STATE.provider;
    toggleProviderUI(STATE.provider);

    apiKeyInput.value = STATE.apiKey;
    applyModelToForm(STATE.model);

    deepseekApiKeyInput.value = STATE.deepseekApiKey;
    applyDeepseekModelToForm(STATE.deepseekModel);

    backupToggle.checked = STATE.backupEnabled;
    systemPromptInput.value = STATE.systemPrompt;
    settingsModal.style.display = 'flex';
  });

  providerSelect.addEventListener('change', () => {
    toggleProviderUI(providerSelect.value);
  });

  modelSelect.addEventListener('change', () => {
    if (modelSelect.value === 'custom') {
      customModelGroup.style.display = 'block';
      customModelInput.focus();
    } else {
      customModelGroup.style.display = 'none';
    }
  });

  deepseekModelSelect.addEventListener('change', () => {
    if (deepseekModelSelect.value === 'custom-deepseek') {
      customDeepseekModelGroup.style.display = 'block';
      customDeepseekModelInput.focus();
    } else {
      customDeepseekModelGroup.style.display = 'none';
    }
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  saveSettingsBtn.addEventListener('click', () => {
    STATE.provider = providerSelect.value;
    STATE.apiKey = apiKeyInput.value.trim();
    
    if (modelSelect.value === 'custom') {
      STATE.model = customModelInput.value.trim() || 'gemini-2.5-flash';
    } else {
      STATE.model = modelSelect.value;
    }

    STATE.deepseekApiKey = deepseekApiKeyInput.value.trim();
    if (deepseekModelSelect.value === 'custom-deepseek') {
      STATE.deepseekModel = customDeepseekModelInput.value.trim() || 'deepseek-chat';
    } else {
      STATE.deepseekModel = deepseekModelSelect.value;
    }

    STATE.backupEnabled = backupToggle.checked;
    STATE.systemPrompt = systemPromptInput.value.trim();

    localStorage.setItem('ai_provider', STATE.provider);
    localStorage.setItem('gemini_api_key', STATE.apiKey);
    localStorage.setItem('gemini_model', STATE.model);
    localStorage.setItem('deepseek_api_key', STATE.deepseekApiKey);
    localStorage.setItem('deepseek_model', STATE.deepseekModel);
    localStorage.setItem('gemini_backup_enabled', STATE.backupEnabled);
    localStorage.setItem('gemini_system_prompt', STATE.systemPrompt);

    updateModelBadge();
    settingsModal.style.display = 'none';
    const activeModelName = STATE.provider === 'deepseek' ? STATE.deepseekModel : STATE.model;
    showToast(`Configurações salvas! Provedor: ${STATE.provider.toUpperCase()} (${activeModelName})`);
  });

  // Drawer
  openDrawerBtn.addEventListener('click', openFilesDrawer);
  closeDrawerBtn.addEventListener('click', closeFilesDrawer);
  drawerBackdrop.addEventListener('click', closeFilesDrawer);
  refreshFilesBtn.addEventListener('click', () => {
    if (STATE.directoryHandle) {
      scanDirectory(STATE.directoryHandle);
      showToast('Lista de arquivos atualizada');
    }
  });

  fileFilterInput.addEventListener('input', (e) => {
    renderFileTree(e.target.value.toLowerCase());
  });

  // File Viewer
  closeViewerBtn.addEventListener('click', () => {
    fileViewerModal.style.display = 'none';
  });

  // Image Attachment
  attachImageBtn.addEventListener('click', () => imageFileInput.click());
  imageFileInput.addEventListener('change', handleImageSelect);
  removeImgBtn.addEventListener('click', clearSelectedImage);

  // Auto-resize textarea
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  });

  // Send prompt on Enter (if desktop) or click
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
      e.preventDefault();
      handleSendPrompt();
    }
  });

  sendPromptBtn.addEventListener('click', handleSendPrompt);

  // Quick prompts
  document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.getAttribute('data-prompt');
      promptInput.focus();
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
    });
  });
}

function openFilesDrawer() {
  filesDrawer.classList.add('open');
  drawerBackdrop.style.display = 'block';
  renderFileTree();
}

function closeFilesDrawer() {
  filesDrawer.classList.remove('open');
  drawerBackdrop.style.display = 'none';
}

// Folder Selection using File System Access API
async function handleSelectFolder() {
  if (!('showDirectoryPicker' in window)) {
    alert('Seu navegador não suporta a File System Access API direta. No Android, certifique-se de usar o Google Chrome (versão 132+) em HTTPS ou localhost.');
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    STATE.directoryHandle = handle;
    projectPathLabel.textContent = handle.name;
    projectStatusDot.classList.add('connected');
    selectFolderBtnText.textContent = 'Alterar Pasta';

    showToast(`Pasta '${handle.name}' conectada com sucesso!`);
    await scanDirectory(handle);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Erro ao selecionar pasta:', err);
      showToast('Falha ao abrir a pasta: ' + err.message);
    }
  }
}

// Recursively scan Godot project directory
async function scanDirectory(dirHandle) {
  STATE.filesMap.clear();

  async function traverse(currentDir, currentPath = '') {
    for await (const [name, handle] of currentDir.entries()) {
      // Ignore git, import, and backup folders
      if (name.startsWith('.') || name === '.import' || name === '.gemini_backups') {
        continue;
      }

      const relativePath = currentPath ? `${currentPath}/${name}` : name;

      if (handle.kind === 'file') {
        STATE.filesMap.set(relativePath, handle);
      } else if (handle.kind === 'directory') {
        await traverse(handle, relativePath);
      }
    }
  }

  await traverse(dirHandle);
  renderFileTree();
}

// Render File Tree list in drawer
function renderFileTree(filter = '') {
  fileTreeContainer.innerHTML = '';

  if (STATE.filesMap.size === 0) {
    fileTreeContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 30px 10px; font-size: 12px;">
        ${STATE.directoryHandle ? 'Nenhum arquivo encontrado na pasta' : 'Selecione uma pasta para ver os arquivos'}
      </div>`;
    return;
  }

  const sortedPaths = Array.from(STATE.filesMap.keys()).sort();
  let count = 0;

  for (const path of sortedPaths) {
    if (filter && !path.toLowerCase().includes(filter)) continue;
    count++;

    const ext = path.includes('.') ? path.split('.').pop() : '';
    const item = document.createElement('div');
    item.className = 'file-item';

    let icon = '📄';
    if (ext === 'gd') icon = '📜';
    else if (ext === 'tscn' || ext === 'scn') icon = '🎬';
    else if (ext === 'tres') icon = '💎';
    else if (ext === 'png' || ext === 'jpg' || ext === 'svg') icon = '🖼️';
    else if (path === 'project.godot') icon = '⚙️';

    item.innerHTML = `
      <span>${icon}</span>
      <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${path}</span>
      <span class="file-item-ext">${ext || 'file'}</span>
    `;

    item.addEventListener('click', () => viewFile(path));
    fileTreeContainer.appendChild(item);
  }

  if (count === 0 && filter) {
    fileTreeContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px; font-size: 12px;">Nenhum arquivo correspondente a "${filter}"</div>`;
  }
}

// View file in modal
async function viewFile(path) {
  try {
    const handle = STATE.filesMap.get(path);
    if (!handle) return;
    const file = await handle.getFile();
    const text = await file.text();

    viewerFileName.textContent = `res://${path}`;
    viewerFileContent.textContent = text;
    fileViewerModal.style.display = 'flex';
  } catch (err) {
    showToast('Erro ao ler arquivo: ' + err.message);
  }
}

// Handle Image Selection
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target.result;
    const base64Data = dataUrl.split(',')[1];

    STATE.selectedImage = {
      mimeType: file.type || 'image/jpeg',
      data: base64Data,
      previewUrl: dataUrl
    };

    imagePreviewThumb.src = dataUrl;
    imagePreviewBar.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function clearSelectedImage() {
  STATE.selectedImage = null;
  imagePreviewThumb.src = '';
  imagePreviewBar.style.display = 'none';
  imageFileInput.value = '';
}

// Append Chat Message
function appendChatMessage(role, content, options = {}) {
  if (welcomeCard && welcomeCard.parentNode) {
    welcomeCard.style.display = 'none';
  }

  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (options.image) {
    const img = document.createElement('img');
    img.src = options.image;
    img.className = 'message-image-preview';
    bubble.appendChild(img);
  }

  const textEl = document.createElement('div');
  textEl.innerHTML = formatMarkdown(content);
  bubble.appendChild(textEl);

  row.appendChild(bubble);
  chatContainer.appendChild(row);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return row;
}

// Append Tool Action Card in Chat
function appendToolCard(type, path, extra = '') {
  const card = document.createElement('div');
  card.className = `tool-action-card ${type}`;

  const isWrite = type === 'writing';
  const icon = isWrite ? '🔨' : '📖';
  const actionText = isWrite ? 'Modificando / Criando arquivo' : 'Lendo arquivo';

  card.innerHTML = `
    <div class="tool-header">
      <span>${icon} ${actionText}</span>
      <span style="font-size: 10px; color: var(--text-dim);">${new Date().toLocaleTimeString()}</span>
    </div>
    <div class="tool-path">res://${path}</div>
    ${extra ? `<div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${extra}</div>` : ''}
  `;

  chatContainer.appendChild(card);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return card;
}

// Basic Markdown Formatter with Code Copy
function formatMarkdown(text) {
  if (!text) return '';

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks: ```gdscript ... ```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = 'code-' + Math.random().toString(36).substr(2, 9);
    return `
      <div class="code-container">
        <div class="code-header">
          <span>${lang || 'gdscript'}</span>
          <button class="copy-btn" onclick="copyCode('${id}')">📋 Copiar</button>
        </div>
        <pre class="code-content" id="${id}">${code.trim()}</pre>
      </div>
    `;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(71, 140, 191, 0.15); padding: 2px 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 12px; color: #5ba3d9;">$1</code>');

  // Bold & Italics
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Newlines to line breaks (outside code blocks)
  html = html.replace(/\n/g, '<br>');

  return html;
}

window.copyCode = function(id) {
  const el = document.getElementById(id);
  if (el) {
    navigator.clipboard.writeText(el.textContent);
    showToast('Código copiado para a área de transferência!');
  }
};

// Local File Operations (Invoked by Gemini Function Calling)
async function toolListFiles() {
  if (!STATE.directoryHandle) {
    return { error: 'Nenhuma pasta de projeto Godot foi selecionada pelo usuário.' };
  }
  await scanDirectory(STATE.directoryHandle);
  return { files: Array.from(STATE.filesMap.keys()) };
}

async function toolReadFile(filePath) {
  const cleanPath = filePath.replace(/^res:\/\//, '').replace(/^\//, '');
  const handle = STATE.filesMap.get(cleanPath);

  if (!handle) {
    return { error: `Arquivo '${filePath}' não encontrado no projeto.` };
  }

  try {
    const file = await handle.getFile();
    const content = await file.text();
    return { path: filePath, content: content };
  } catch (err) {
    return { error: `Falha ao ler '${filePath}': ${err.message}` };
  }
}

async function toolWriteFile(filePath, content, reason = '') {
  if (!STATE.directoryHandle) {
    return { error: 'Nenhuma pasta de projeto Godot selecionada.' };
  }

  const cleanPath = filePath.replace(/^res:\/\//, '').replace(/^\//, '');
  const pathParts = cleanPath.split('/');
  const fileName = pathParts.pop();

  try {
    // Navigate / create subdirectories
    let currentDir = STATE.directoryHandle;
    for (const part of pathParts) {
      if (part) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      }
    }

    // Backup previous file if enabled
    if (STATE.backupEnabled && STATE.filesMap.has(cleanPath)) {
      try {
        const oldFile = await (STATE.filesMap.get(cleanPath)).getFile();
        const oldText = await oldFile.text();
        const backupDir = await STATE.directoryHandle.getDirectoryHandle('.gemini_backups', { create: true });
        const backupName = `${fileName}.${Date.now()}.bak`;
        const backupHandle = await backupDir.getFileHandle(backupName, { create: true });
        const backupWritable = await backupHandle.createWritable();
        await backupWritable.write(oldText);
        await backupWritable.close();
      } catch (backupErr) {
        console.warn('Não foi possível criar backup:', backupErr);
      }
    }

    // Write new content
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    // Update local state map
    STATE.filesMap.set(cleanPath, fileHandle);

    return { 
      success: true, 
      path: filePath, 
      message: `Arquivo '${filePath}' gravado com sucesso no projeto Godot.` 
    };
  } catch (err) {
    return { error: `Erro ao escrever arquivo '${filePath}': ${err.message}` };
  }
}

// Gemini Tool Definitions (Function Calling schema)
const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'list_project_files',
        description: 'Lista todos os arquivos existentes dentro do projeto Godot conectado (scripts, cenas .tscn, recursos, etc).',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'read_project_file',
        description: 'Lê o conteúdo em texto de um arquivo do projeto Godot (ex: scripts .gd, cenas .tscn, configurações project.godot).',
        parameters: {
          type: 'OBJECT',
          properties: {
            path: {
              type: 'STRING',
              description: 'O caminho relativo do arquivo no projeto, ex: "scripts/Player.gd" ou "res://Main.tscn"'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_project_file',
        description: 'Cria ou sobrescreve um arquivo diretamente na pasta do projeto Godot com o código ou conteúdo fornecido.',
        parameters: {
          type: 'OBJECT',
          properties: {
            path: {
              type: 'STRING',
              description: 'O caminho do arquivo a ser criado ou atualizado no projeto (ex: "Player.gd" ou "res://scripts/Enemy.gd")'
            },
            content: {
              type: 'STRING',
              description: 'O código GDScript ou texto completo a ser salvo no arquivo'
            },
            reason: {
              type: 'STRING',
              description: 'Explicação breve do que foi adicionado ou modificado'
            }
          },
          required: ['path', 'content']
        }
      }
    ]
  }
];

// DeepSeek Tool Definitions (OpenAI-compatible schema)
const OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_project_files',
      description: 'Lista todos os arquivos existentes dentro do projeto Godot conectado.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_project_file',
      description: 'Lê o conteúdo em texto de um arquivo do projeto Godot (ex: scripts .gd, cenas .tscn, project.godot).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'O caminho relativo do arquivo no projeto, ex: "Player.gd"' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_project_file',
      description: 'Cria ou sobrescreve um arquivo diretamente na pasta do projeto Godot com o código fornecido.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'O caminho do arquivo a ser criado ou atualizado no projeto' },
          content: { type: 'string', description: 'O código GDScript ou texto completo a ser salvo no arquivo' },
          reason: { type: 'string', description: 'Explicação breve do que foi adicionado ou modificado' }
        },
        required: ['path', 'content']
      }
    }
  }
];

// Execute Tool Call (Common for both Gemini & DeepSeek)
async function executeToolCall(call) {
  const name = call.name;
  const args = call.args || {};

  if (name === 'list_project_files') {
    appendToolCard('reading', 'Estrutura do projeto', 'Listando arquivos...');
    return await toolListFiles();
  } else if (name === 'read_project_file') {
    appendToolCard('reading', args.path, 'Inspecionando código...');
    return await toolReadFile(args.path);
  } else if (name === 'write_project_file') {
    appendToolCard('writing', args.path, args.reason || 'Gravando alterações...');
    const result = await toolWriteFile(args.path, args.content, args.reason);
    renderFileTree();
    return result;
  }

  return { error: `Ferramenta desconhecida: ${name}` };
}

// Handle User Sending Prompt
async function handleSendPrompt() {
  const promptText = promptInput.value.trim();
  const imageAttachment = STATE.selectedImage;

  if (!promptText && !imageAttachment) return;

  const isDeepSeek = STATE.provider === 'deepseek';
  const activeKey = isDeepSeek ? STATE.deepseekApiKey : STATE.apiKey;
  const providerTitle = isDeepSeek ? 'DeepSeek' : 'Gemini';

  if (!activeKey) {
    showToast(`Por favor, informe sua chave de API do ${providerTitle} nas Configurações (⚙️)`);
    openSettingsBtn.click();
    return;
  }

  if (isDeepSeek && imageAttachment) {
    showToast('Aviso: O DeepSeek suporta prompts de texto e código. A imagem será ignorada.');
  }

  if (STATE.isGenerating) return;

  // Build user message parts
  const userParts = [];
  if (imageAttachment && !isDeepSeek) {
    userParts.push({
      inlineData: {
        mimeType: imageAttachment.mimeType,
        data: imageAttachment.data
      }
    });
  }
  if (promptText) {
    userParts.push({ text: promptText });
  }

  // Display user message in UI
  appendChatMessage('user', promptText, { image: (imageAttachment && !isDeepSeek) ? imageAttachment.previewUrl : null });

  // Clear inputs
  promptInput.value = '';
  promptInput.style.height = 'auto';
  clearSelectedImage();

  // Add to conversation history
  if (isDeepSeek) {
    if (STATE.deepseekHistory.length === 0) {
      STATE.deepseekHistory.push({ role: 'system', content: STATE.systemPrompt });
    }
    STATE.deepseekHistory.push({ role: 'user', content: promptText });
  } else {
    STATE.chatHistory.push({
      role: 'user',
      parts: userParts
    });
  }

  // Call Agent Loop
  setLoadingState(true);

  try {
    if (isDeepSeek) {
      await runDeepSeekLoop();
    } else {
      await runGeminiLoop();
    }
  } catch (err) {
    console.error(`Erro na requisição ${providerTitle}:`, err);
    appendChatMessage('assistant', `⚠️ **Erro na comunicação com o ${providerTitle}:** ${err.message}`);
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(loading) {
  STATE.isGenerating = loading;
  sendPromptBtn.disabled = loading;
  sendPromptBtn.innerHTML = loading ? '<span style="display:inline-block; animation: spin 1s linear infinite;">⏳</span>' : '➤';
}

// Run Gemini Agent Loop
async function runGeminiLoop() {
  let continueTurn = true;
  let maxTurns = 5; // Prevent runaway loops

  while (continueTurn && maxTurns > 0) {
    maxTurns--;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${STATE.model}:generateContent?key=${STATE.apiKey}`;

    const requestBody = {
      contents: STATE.chatHistory,
      systemInstruction: {
        parts: [{ text: STATE.systemPrompt }]
      },
      tools: GEMINI_TOOLS
    };

    // Retry loop for temporary Google spikes / high demand (503 / 429)
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    let lastErrorMsg = '';

    while (attempts < maxAttempts) {
      attempts++;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          break;
        }

        const errJson = await response.json().catch(() => ({}));
        lastErrorMsg = errJson.error?.message || `Status HTTP ${response.status}`;

        const isOverloaded = response.status === 503 || 
                             response.status === 429 || 
                             lastErrorMsg.toLowerCase().includes('demand') ||
                             lastErrorMsg.toLowerCase().includes('quota');

        if (isOverloaded && attempts < maxAttempts) {
          showToast(`Servidor da Google em alta demanda. Tentando novamente (${attempts}/${maxAttempts})...`);
          await new Promise(r => setTimeout(r, 2000 * attempts));
          continue;
        } else {
          break;
        }
      } catch (networkErr) {
        lastErrorMsg = networkErr.message;
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        break;
      }
    }

    if (!response || !response.ok) {
      if (lastErrorMsg.toLowerCase().includes('demand') || (response && response.status === 503)) {
        throw new Error(`Os servidores do Google estão com pico de tráfego temporário no modelo **${STATE.model}**.\n\n💡 **Dica rápida:** Toque em ⚙️ (Configurações) no topo e selecione **Gemini 2.5 Flash** ou alterne para o **DeepSeek**, que possui alta estabilidade.`);
      }
      throw new Error(lastErrorMsg);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    if (!candidate || !candidate.content) {
      throw new Error('Resposta vazia recebida do modelo Gemini.');
    }

    const modelContent = candidate.content;
    STATE.chatHistory.push(modelContent);

    // Check if the model performed tool calls
    const functionCalls = modelContent.parts.filter(p => p.functionCall);
    const textParts = modelContent.parts.filter(p => p.text).map(p => p.text).join('\n');

    if (textParts) {
      appendChatMessage('assistant', textParts);
    }

    if (functionCalls.length > 0) {
      // Execute all tool calls
      const toolResponses = [];
      for (const part of functionCalls) {
        const result = await executeToolCall(part.functionCall);
        toolResponses.push({
          functionResponse: {
            name: part.functionCall.name,
            response: result
          }
        });
      }

      // Append tool responses to history for next model turn
      STATE.chatHistory.push({
        role: 'tool',
        parts: toolResponses
      });

      // Loop continues so Gemini sees the tool output and answers
      continueTurn = true;
    } else {
      // Finished final reply
      continueTurn = false;
    }
  }
}

// Run DeepSeek Agent Loop
async function runDeepSeekLoop() {
  let continueTurn = true;
  let maxTurns = 5;

  while (continueTurn && maxTurns > 0) {
    maxTurns--;

    const endpoint = 'https://api.deepseek.com/chat/completions';
    const supportsTools = STATE.deepseekModel !== 'deepseek-reasoner';

    const requestBody = {
      model: STATE.deepseekModel,
      messages: STATE.deepseekHistory
    };

    if (supportsTools) {
      requestBody.tools = OPENAI_TOOLS;
    }

    let response;
    let attempts = 0;
    const maxAttempts = 3;
    let lastErrorMsg = '';

    while (attempts < maxAttempts) {
      attempts++;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${STATE.deepseekApiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) break;

        const errJson = await response.json().catch(() => ({}));
        lastErrorMsg = errJson.error?.message || `Status HTTP ${response.status}`;

        if ((response.status === 429 || response.status === 503) && attempts < maxAttempts) {
          showToast(`DeepSeek com alta demanda. Tentando novamente (${attempts}/${maxAttempts})...`);
          await new Promise(r => setTimeout(r, 2000 * attempts));
          continue;
        }
        break;
      } catch (e) {
        lastErrorMsg = e.message;
        if (attempts < maxAttempts) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        break;
      }
    }

    if (!response || !response.ok) {
      throw new Error(`Erro na API do DeepSeek: ${lastErrorMsg}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (!message) {
      throw new Error('Resposta vazia recebida do DeepSeek.');
    }

    STATE.deepseekHistory.push(message);

    if (message.content) {
      appendChatMessage('assistant', message.content);
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          fnArgs = {};
        }

        const toolResult = await executeToolCall({ name: fnName, args: fnArgs });

        STATE.deepseekHistory.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      }
      continueTurn = true;
    } else {
      continueTurn = false;
    }
  }
}

// Start application
window.addEventListener('DOMContentLoaded', init);
