// Elements
const homeView = document.getElementById('homeView');
const chatView = document.getElementById('chatView');
const chatMessages = document.getElementById('chatMessages');
const historyList = document.getElementById('historyList');
const newChatBtn = document.getElementById('newChatBtn');

// Mobile menu elements
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebar = document.querySelector('.sidebar');

// Toggle sidebar on mobile
function toggleSidebar() {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
    // Hide hamburger when sidebar is open
    hamburgerBtn.style.display = sidebar.classList.contains('active') ? 'none' : 'flex';
}

hamburgerBtn.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', toggleSidebar);

// Close sidebar when clicking nav items on mobile
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        // Don't close sidebar for Preferencias (first nav-item)
        if (window.innerWidth <= 768 && !item.querySelector('.fa-sliders')) {
            toggleSidebar();
        }
    });
});

// Preferences Modal
const preferencesModal = document.getElementById('preferencesModal');
const closePreferencesModal = document.getElementById('closePreferencesModal');
const animationToggle = document.getElementById('animationToggle');
const preferencesNav = document.querySelector('.nav-item');

// Load animation preference
const animationEnabled = localStorage.getItem('ai_chat_animation') !== 'false';
animationToggle.checked = animationEnabled;

// Open modal
preferencesNav.addEventListener('click', () => {
    preferencesModal.classList.add('active');
});

// Close modal
closePreferencesModal.addEventListener('click', () => {
    preferencesModal.classList.remove('active');
});

// Close on overlay click
preferencesModal.addEventListener('click', (e) => {
    if (e.target === preferencesModal) {
        preferencesModal.classList.remove('active');
    }
});

// Toggle animation
animationToggle.addEventListener('change', (e) => {
    localStorage.setItem('ai_chat_animation', e.target.checked);
});

// Home input elements
const homeChatInput = document.getElementById('homeChatInput');
const homeSendBtn = document.getElementById('homeSendBtn');
const fileInput = document.getElementById('fileInput');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const documentPreviewContainer = document.getElementById('documentPreviewContainer');
const documentName = document.getElementById('documentName');
const removeDocumentBtn = document.getElementById('removeDocument');
const modelSelector = document.getElementById('modelSelector');
const modelMenu = document.getElementById('modelMenu');
const selectedModel = document.getElementById('selectedModel');

// Chat input elements
const chatChatInput = document.getElementById('chatChatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatFileInput = document.getElementById('chatFileInput');
const chatImagePreviewContainer = document.getElementById('chatImagePreviewContainer');
const chatPreviewImg = document.getElementById('chatPreviewImg');
const chatRemoveImageBtn = document.getElementById('chatRemoveImage');
const chatDocumentPreviewContainer = document.getElementById('chatDocumentPreviewContainer');
const chatDocumentName = document.getElementById('chatDocumentName');
const chatRemoveDocumentBtn = document.getElementById('chatRemoveDocument');
const chatModelSelector = document.getElementById('chatModelSelector');
const chatModelMenu = document.getElementById('chatModelMenu');
const chatSelectedModel = document.getElementById('chatSelectedModel');

let currentFileBase64 = null;
let currentFileType = null;
let selectedModelData = null;
let chatHistory = [];
let providersData = {};
let currentSessionId = null;
let conversations = {};

// Memory Manager
const MemoryManager = {
    STORAGE_KEY: 'ai_chat_memory',

    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error cargando memoria:', e);
            return {};
        }
    },

    save(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Error guardando memoria:', e);
        }
    },

    createSession() {
        const sessionId = 'session_' + Date.now();
        conversations[sessionId] = {
            id: sessionId,
            title: 'Nueva conversación',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.save(conversations);
        return sessionId;
    },

    getSession(sessionId) {
        return conversations[sessionId] || null;
    },

    getAllSessions() {
        return Object.values(conversations).sort((a, b) =>
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );
    },

    addMessage(sessionId, role, content, imageData = null) {
        if (!conversations[sessionId]) return;

        const message = {
            role,
            content,
            timestamp: new Date().toISOString()
        };

        if (imageData) {
            message.image = imageData;
        }

        conversations[sessionId].messages.push(message);
        conversations[sessionId].updatedAt = new Date().toISOString();

        // Auto-generate title from first user message
        if (role === 'user' && conversations[sessionId].messages.filter(m => m.role === 'user').length === 1) {
            conversations[sessionId].title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        }

        this.save(conversations);
    },

    getMessages(sessionId) {
        return conversations[sessionId]?.messages || [];
    },

    deleteSession(sessionId) {
        delete conversations[sessionId];
        this.save(conversations);
    },

    init() {
        conversations = this.load();
    }
};

MemoryManager.init();

// Load models from env.json
async function loadModels() {
    try {
        const response = await fetch('env.json');
        const data = await response.json();
        providersData = data['APIS-AI'];

        let firstModel = null;

        [modelMenu, chatModelMenu].forEach(menu => {
            menu.innerHTML = '';
            let isFirst = true;
            for (const [key, model] of Object.entries(providersData)) {
                const item = document.createElement('div');
                item.className = 'model-menu-item';
                item.dataset.key = key;

                item.innerHTML = `
                            <i class="fa-solid fa-microchip"></i>
                            <span>${model.name}</span>
                        `;
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectModel(null, model, menu);
                });
                menu.appendChild(item);

                // Auto-select first model
                if (isFirst && !firstModel) {
                    firstModel = model;
                    isFirst = false;
                }
            }
        });

        // Set first model as selected
        if (firstModel) {
            selectedModelData = firstModel;
            document.getElementById('selectedModel').textContent = firstModel.name;
            document.getElementById('chatSelectedModel').textContent = firstModel.name;
        }
    } catch (error) {
        console.error('Error al cargar modelos:', error);
    }
}

function selectModel(item, model, menu) {
    // Update both selectors (home and chat view)
    document.getElementById('selectedModel').textContent = model.name;
    document.getElementById('chatSelectedModel').textContent = model.name;
    selectedModelData = model;
    menu.classList.remove('active');
}

// Model selector toggle
[modelSelector, chatModelSelector].forEach(selector => {
    selector.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = selector.nextElementSibling;
        menu.classList.toggle('active');
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.model-dropdown')) {
        modelMenu.classList.remove('active');
        chatModelMenu.classList.remove('active');
    }
});

loadModels();

// File input handling
function setupFileInput(input, imgContainer, img, docContainer, docName) {
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                currentFileBase64 = event.target.result;
                if (file.type.startsWith('image/')) {
                    currentFileType = 'image';
                    img.src = currentFileBase64;
                    imgContainer.classList.add('active');
                    docContainer.classList.remove('active');
                } else {
                    currentFileType = 'document';
                    docName.textContent = file.name;
                    docContainer.classList.add('active');
                    imgContainer.classList.remove('active');
                }
            };
            reader.readAsDataURL(file);
        }
        input.value = '';
    });
}

setupFileInput(fileInput, imagePreviewContainer, previewImg, documentPreviewContainer, documentName);
setupFileInput(chatFileInput, chatImagePreviewContainer, chatPreviewImg, chatDocumentPreviewContainer, chatDocumentName);

// Remove file handlers
function setupRemoveHandlers(removeImgBtn, imgContainer, removeDocBtn, docContainer, docNameSpan) {
    removeImgBtn.addEventListener('click', () => {
        currentFileBase64 = null;
        currentFileType = null;
        imgContainer.querySelector('img').src = '';
        imgContainer.classList.remove('active');
    });

    removeDocBtn.addEventListener('click', () => {
        currentFileBase64 = null;
        currentFileType = null;
        docNameSpan.textContent = '';
        docContainer.classList.remove('active');
    });
}

setupRemoveHandlers(removeImageBtn, imagePreviewContainer, removeDocumentBtn, documentPreviewContainer, documentName);
setupRemoveHandlers(chatRemoveImageBtn, chatImagePreviewContainer, chatRemoveDocumentBtn, chatDocumentPreviewContainer, chatDocumentName);

// Copy to clipboard function
function copyToClipboard(text, button) {
    // Strip markdown formatting
    const plainText = text
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`(.*?)`/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/^\s*[-*+]\s/gm, '')
        .replace(/^\s*\d+\.\s/gm, '')
        .trim();

    navigator.clipboard.writeText(plainText).then(() => {
        const icon = button.querySelector('i');
        icon.className = 'fa-solid fa-check';
        button.style.color = '#4ade80';
        setTimeout(() => {
            icon.className = 'fa-regular fa-copy';
            button.style.color = '';
        }, 2000);
    });
}

// Send message
async function sendMessage(input) {
    const text = input.value.trim();
    if (!text && !currentFileBase64) return;

    // Create new session if needed (first message of a new chat)
    if (!currentSessionId) {
        currentSessionId = MemoryManager.createSession();
        addToHistory(text || 'Archivo adjunto', currentSessionId);
    }

    const message = {
        text: text,
        image: currentFileType === 'image' ? currentFileBase64 : null,
        document: currentFileType === 'document' ? { name: documentName.textContent || chatDocumentName.textContent, base64: currentFileBase64 } : null
    };

    chatHistory.push(message);
    addMessageToChat(message);
    switchToChatView();

    // Save to memory
    MemoryManager.addMessage(currentSessionId, 'user', text, message.image);

    input.value = '';
    currentFileBase64 = null;
    currentFileType = null;
    imagePreviewContainer.classList.remove('active');
    documentPreviewContainer.classList.remove('active');
    chatImagePreviewContainer.classList.remove('active');
    chatDocumentPreviewContainer.classList.remove('active');

    await callGeminiAPI(text, message.image);
}

function addMessageToChat(message) {
    const div = document.createElement('div');
    div.className = 'message message-user';

    let content = '';
    if (message.image) {
        content += `<img src="${message.image}" style="max-width: 200px; border-radius: 8px; margin-bottom: 8px;">`;
    }
    if (message.document) {
        content += `
                    <div class="document-preview" style="margin-bottom: 8px;">
                        <div class="document-icon"><i class="fa-solid fa-file-lines"></i></div>
                        <div class="document-info">
                            <span class="document-name">${message.document.name}</span>
                            <span class="document-type">Documento</span>
                        </div>
                    </div>`;
    }
    if (message.text) {
        content += `<div class="message-bubble">${message.text}</div>`;
    }

    div.innerHTML = `
                ${content}
                <div class="message-actions">
                    <button class="message-action-btn edit-btn" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="message-action-btn copy-btn" title="Copiar"><i class="fa-regular fa-copy"></i></button>
                </div>`;

    // Add copy functionality
    const copyBtn = div.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => {
        copyToClipboard(message.text || '', copyBtn);
    });

    // Add edit functionality
    const editBtn = div.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => {
        // Fill the chat input with the message text
        chatChatInput.value = message.text || '';

        // Remove this user message and the AI response from DOM
        const userMsg = div;
        const aiMsg = userMsg.nextElementSibling;
        if (aiMsg && aiMsg.classList.contains('message-ai')) {
            aiMsg.remove();
        }
        userMsg.remove();

        // Remove from chatHistory (remove last user message and AI response)
        if (chatHistory.length > 0) {
            chatHistory.pop(); // Remove last user message
        }

        // Remove last AI response from memory
        if (currentSessionId && conversations[currentSessionId]) {
            const messages = conversations[currentSessionId].messages;
            // Remove last assistant message
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'assistant') {
                    messages.splice(i, 1);
                    break;
                }
            }
            // Remove last user message
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    messages.splice(i, 1);
                    break;
                }
            }
            MemoryManager.save(conversations);
        }

        // Focus on input
        chatChatInput.focus();
    });

    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Universal AI API Handler
const AIProviderDetector = {
    detect(host) {
        const url = host.toLowerCase();

        if (url.includes('generativelanguage.googleapis.com') || url.includes('gemini')) {
            return 'gemini';
        }
        if (url.includes('api.openai.com') || url.includes('openai')) {
            return 'openai';
        }
        if (url.includes('api.groq.com') || url.includes('groq')) {
            return 'groq';
        }
        if (url.includes('api.anthropic.com') || url.includes('anthropic')) {
            return 'anthropic';
        }
        if (url.includes('api.cohere.com') || url.includes('cohere')) {
            return 'cohere';
        }
        if (url.includes('api.mistral') || url.includes('mistral')) {
            return 'mistral';
        }
        if (url.includes('api.deepseek.com') || url.includes('deepseek')) {
            return 'deepseek';
        }
        if (url.includes('together.xyz') || url.includes('together')) {
            return 'together';
        }
        if (url.includes('openrouter.ai') || url.includes('openrouter')) {
            return 'openrouter';
        }
        if (url.includes('huggingface') || url.includes('hf')) {
            return 'huggingface';
        }
        if (url.includes('fireworks.ai') || url.includes('fireworks')) {
            return 'fireworks';
        }
        if (url.includes('perplexity') || url.includes('pplx')) {
            return 'perplexity';
        }
        if (url.includes('replicate.com') || url.includes('replicate')) {
            return 'replicate';
        }
        if (url.includes('cloud.google.com') || url.includes('vertex')) {
            return 'vertex';
        }
        if (url.includes('bedrock') || url.includes('aws')) {
            return 'bedrock';
        }

        return 'openai-compatible';
    },

    getAuthConfig(provider, host, key) {
        const configs = {
            gemini: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': key
                },
                authType: 'header'
            },
            openai: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            groq: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            anthropic: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01'
                },
                authType: 'header'
            },
            cohere: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            mistral: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            deepseek: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            together: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            openrouter: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                    'HTTP-Referer': window.location.href
                },
                authType: 'bearer'
            },
            huggingface: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            fireworks: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            perplexity: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            replicate: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            vertex: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'X-goog-api-key': key
                },
                authType: 'header'
            },
            bedrock: {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            },
            'openai-compatible': {
                url: host,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                authType: 'bearer'
            }
        };
        return configs[provider] || configs['openai-compatible'];
    },

    isNativeGemini(host) {
        return host.toLowerCase().includes('generativelanguage.googleapis.com');
    }
};

// Call AI API
async function callGeminiAPI(text, imageBase64) {
    if (!selectedModelData) {
        addAIMessage('Por favor, selecciona un modelo primero.');
        return;
    }

    showLoadingMessage();

    try {
        const provider = AIProviderDetector.detect(selectedModelData.host);
        const authConfig = AIProviderDetector.getAuthConfig(provider, selectedModelData.host, selectedModelData.key);
        const isGeminiNative = AIProviderDetector.isNativeGemini(selectedModelData.host);

        let url, headers, requestBody;

        if (isGeminiNative) {
            // Gemini native format
            url = authConfig.url;
            headers = authConfig.headers;

            // Get chat history from memory for context
            const memoryHistoryGemini = currentSessionId ?
                MemoryManager.getMessages(currentSessionId) : [];

            const contents = [];

            // Add history to contents
            memoryHistoryGemini.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    contents.push({
                        role: msg.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: msg.content }]
                    });
                }
            });

            // Add current message
            if (imageBase64) {
                const base64Data = imageBase64.split(',')[1];
                const mimeType = imageBase64.split(';')[0].split(':')[1];

                contents.push({
                    parts: [
                        { text: text || 'Describe esta imagen' },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64Data
                            }
                        }
                    ]
                });
            } else {
                contents.push({
                    parts: [{ text: text }]
                });
            }

            requestBody = {
                systemInstruction: { parts: [{ text: AI_PROMPT.system }] },
                contents: contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048
                }
            };
        } else {
            // OpenAI-compatible format (works for most providers)
            url = authConfig.url;
            headers = authConfig.headers;

            // Get chat history from memory for context
            const memoryHistory = currentSessionId ?
                MemoryManager.getMessages(currentSessionId).map(m => ({
                    role: m.role,
                    content: m.content
                })) : [];

            const messages = AI_PROMPT.getPrompt(text, memoryHistory);

            if (imageBase64) {
                const base64Data = imageBase64.split(',')[1];
                const mimeType = imageBase64.split(';')[0].split(':')[1];

                if (provider === 'anthropic') {
                    messages[messages.length - 1].content = [
                        { type: 'text', text: text || 'Describe esta imagen' },
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mimeType,
                                data: base64Data
                            }
                        }
                    ];
                } else {
                    messages[messages.length - 1].content = [
                        { type: 'text', text: text || 'Describe esta imagen' },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64Data}`
                            }
                        }
                    ];
                }
            }

            requestBody = {
                model: selectedModelData.model || 'default',
                messages: messages,
                temperature: 0.7,
                max_tokens: 2048
            };

            if (provider === 'anthropic') {
                requestBody.system = AI_PROMPT.system;
                requestBody.max_tokens = 2048;
            }
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        removeLoadingMessage();

        // Handle different response formats
        if (data.choices && data.choices[0] && data.choices[0].message) {
            addAIMessage(data.choices[0].message.content);
        }
        else if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            addAIMessage(data.candidates[0].content.parts[0].text);
        }
        else if (data.content && data.content[0] && data.content[0].text) {
            addAIMessage(data.content[0].text);
        }
        else if (data.generations && data.generations[0] && data.generations[0].text) {
            addAIMessage(data.generations[0].text);
        }
        else if (data.output && data.output.text) {
            addAIMessage(data.output.text);
        }
        else if (data.error) {
            addAIMessage(`Error: ${data.error.message || data.error.type || JSON.stringify(data.error)}`);
        }
        else {
            addAIMessage('No se pudo obtener una respuesta.');
        }
    } catch (error) {
        removeLoadingMessage();
        addAIMessage(`Error de conexión: ${error.message}`);
    }
}

function showLoadingMessage() {
    const div = document.createElement('div');
    div.className = 'message message-ai';
    div.id = 'loadingMessage';
    div.innerHTML = `
                <div class="message-bubble">
                    <div class="loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingMessage() {
    const loading = document.getElementById('loadingMessage');
    if (loading) loading.remove();
}

function addAIMessage(text, useAnimation = true) {
    // Save AI response to memory
    if (currentSessionId) {
        MemoryManager.addMessage(currentSessionId, 'assistant', text);
    }

    const div = document.createElement('div');
    div.className = 'message message-ai';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    const skipBtn = document.createElement('button');
    skipBtn.className = 'skip-btn';
    skipBtn.innerHTML = '<i class="fa-solid fa-forward"></i> Skip';
    skipBtn.style.display = 'none';

    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.innerHTML = `
                <button class="message-action-btn copy-btn" title="Copiar"><i class="fa-regular fa-copy"></i></button>
                <button class="message-action-btn regenerate-btn" title="Regenerar"><i class="fa-solid fa-rotate"></i></button>
                <div class="message-ai" style="display: flex; gap: 8px; margin-left: 8px;">
                    <button class="message-action-btn" title="Me gusta"><i class="fa-regular fa-thumbs-up"></i></button>
                    <button class="message-action-btn" title="No me gusta"><i class="fa-regular fa-thumbs-down"></i></button>
                </div>`;

    // Add copy functionality
    actions.querySelector('.copy-btn').addEventListener('click', () => {
        copyToClipboard(text, actions.querySelector('.copy-btn'));
    });

    // Add regenerate functionality
    actions.querySelector('.regenerate-btn').addEventListener('click', () => {
        regenerateMessage(div);
    });

    div.appendChild(bubble);
    div.appendChild(skipBtn);
    div.appendChild(actions);
    chatMessages.appendChild(div);

    // Check animation preference
    const animationEnabled = localStorage.getItem('ai_chat_animation') !== 'false';
    if (useAnimation && animationEnabled) {
        skipBtn.style.display = 'block';
        typewriterEffect(bubble, text, skipBtn);
    } else {
        bubble.innerHTML = AI_PROMPT.renderMarkdown(text);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function regenerateMessage(aiMessageDiv) {
    // Remove the last AI message from DOM
    aiMessageDiv.remove();

    // Remove the last AI message from memory
    if (currentSessionId && conversations[currentSessionId]) {
        const messages = conversations[currentSessionId].messages;
        // Find and remove the last assistant message
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                messages.splice(i, 1);
                break;
            }
        }
        // Save updated conversations
        MemoryManager.save(conversations);
    }

    // Get the last user message
    const lastUserMessage = chatHistory[chatHistory.length - 1];
    if (lastUserMessage) {
        // Call API again with the last user message
        callGeminiAPI(lastUserMessage.text, lastUserMessage.image);
    }
}

function typewriterEffect(element, text, skipBtn) {
    const rawText = text;
    let isAnimating = true;

    // Split text into chunks (words or small groups of characters)
    const words = rawText.split(/(\s+)/);
    const chunkSize = 2; // words per chunk
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(''));
    }

    element.innerHTML = '';

    // Create a wrapper for fade effect
    const wrapper = document.createElement('div');
    wrapper.style.opacity = '0';
    wrapper.style.transition = 'opacity 0.3s ease';
    wrapper.style.position = 'relative';
    element.appendChild(wrapper);

    let currentText = '';
    let chunkIndex = 0;

    function finishAnimation() {
        if (!isAnimating) return;
        isAnimating = false;
        skipBtn.style.display = 'none';
        wrapper.style.opacity = '1';
        wrapper.innerHTML = AI_PROMPT.renderMarkdown(rawText);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    skipBtn.addEventListener('click', finishAnimation);

    function addChunk() {
        if (!isAnimating || chunkIndex >= chunks.length) {
            finishAnimation();
            return;
        }

        currentText += chunks[chunkIndex];
        chunkIndex++;

        // Render markdown with current text
        wrapper.innerHTML = AI_PROMPT.renderMarkdown(currentText);

        // Add cursor at the end
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.innerHTML = '|';
        wrapper.appendChild(cursor);

        wrapper.style.opacity = '1';

        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Variable speed based on content
        const lastChar = currentText.slice(-1);
        let delay = 50;

        if (lastChar === '.' || lastChar === '!' || lastChar === '?') {
            delay = 300;
        } else if (lastChar === ',') {
            delay = 150;
        } else if (lastChar === '\n') {
            delay = 100;
        }

        setTimeout(addChunk, delay);
    }

    // Start animation
    setTimeout(addChunk, 100);
}

function addToHistory(text, sessionId) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.sessionId = sessionId;
    item.innerHTML = `
                <span class="history-item-text">${text}</span>
                <div class="history-item-actions">
                    <button class="history-delete-btn" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </div>`;
    item.querySelector('.history-item-text').addEventListener('click', () => {
        loadConversation(sessionId);
        if (window.innerWidth <= 768) toggleSidebar();
    });
    item.querySelector('.history-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('¿Eliminar esta conversación?')) {
            MemoryManager.deleteSession(sessionId);
            item.remove();
            if (currentSessionId === sessionId) {
                switchToHomeView();
            }
        }
    });
    historyList.prepend(item);
}

function loadHistoryFromStorage() {
    historyList.innerHTML = '';
    const sessions = MemoryManager.getAllSessions();
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.sessionId = session.id;
        item.innerHTML = `
                    <span class="history-item-text">${session.title}</span>
                    <div class="history-item-actions">
                        <button class="history-delete-btn" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>`;
        item.querySelector('.history-item-text').addEventListener('click', () => {
            loadConversation(session.id);
            if (window.innerWidth <= 768) toggleSidebar();
        });
        item.querySelector('.history-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('¿Eliminar esta conversación?')) {
                MemoryManager.deleteSession(session.id);
                item.remove();
                if (currentSessionId === session.id) {
                    switchToHomeView();
                }
            }
        });
        historyList.appendChild(item);
    });
}

function loadConversation(sessionId) {
    const session = MemoryManager.getSession(sessionId);
    if (!session) return;

    currentSessionId = sessionId;
    localStorage.setItem('ai_chat_current_session', sessionId);
    chatHistory = [];
    chatMessages.innerHTML = '';

    session.messages.forEach(msg => {
        if (msg.role === 'user') {
            const message = {
                text: msg.content,
                image: msg.image || null,
                document: null
            };
            chatHistory.push(message);
            addMessageToChat(message);
        } else if (msg.role === 'assistant') {
            const div = document.createElement('div');
            div.className = 'message message-ai';
            const renderedText = AI_PROMPT.renderMarkdown(msg.content);
            div.innerHTML = `
                        <div class="message-bubble">${renderedText}</div>
                        <div class="message-actions">
                            <button class="message-action-btn copy-btn" title="Copiar"><i class="fa-regular fa-copy"></i></button>
                            <button class="message-action-btn" title="Regenerar"><i class="fa-solid fa-rotate"></i></button>
                            <div class="message-ai" style="display: flex; gap: 8px; margin-left: 8px;">
                                <button class="message-action-btn" title="Me gusta"><i class="fa-regular fa-thumbs-up"></i></button>
                                <button class="message-action-btn" title="No me gusta"><i class="fa-regular fa-thumbs-down"></i></button>
                            </div>
                        </div>`;
            // Add copy functionality
            div.querySelector('.copy-btn').addEventListener('click', () => {
                copyToClipboard(msg.content, div.querySelector('.copy-btn'));
            });
            chatMessages.appendChild(div);
        }
    });

    switchToChatView();
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function switchToChatView() {
    homeView.classList.add('hidden');
    chatView.classList.add('active');
    localStorage.setItem('ai_chat_current_view', 'chat');
}

function switchToHomeView() {
    homeView.classList.remove('hidden');
    chatView.classList.remove('active');
    chatMessages.innerHTML = '';
    chatHistory = [];
    currentSessionId = null;
    localStorage.removeItem('ai_chat_current_view');
    localStorage.removeItem('ai_chat_current_session');
}

// Event listeners
homeSendBtn.addEventListener('click', () => sendMessage(homeChatInput));
chatSendBtn.addEventListener('click', () => sendMessage(chatChatInput));

homeChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(homeChatInput);
});

chatChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(chatChatInput);
});

newChatBtn.addEventListener('click', () => {
    switchToHomeView();
    if (window.innerWidth <= 768) {
        toggleSidebar();
    }
});

// Title Animation
const mainTitle = document.getElementById('mainTitle');
const titles = [
    '¿Qué quieres saber?',
    '¿Qué haremos hoy?',
    '¿Qué estás pensando?',
    '¿Por dónde empezamos?'
];
let titleIndex = 0;
let charIndex = 0;
let isDeleting = false;

function animateTitle() {
    const currentTitle = titles[titleIndex];

    if (isDeleting) {
        charIndex--;
    } else {
        charIndex++;
    }

    mainTitle.innerHTML = currentTitle.substring(0, charIndex) + '<span class="cursor"></span>';

    let speed = isDeleting ? 50 : 100;

    if (!isDeleting && charIndex === currentTitle.length) {
        speed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        titleIndex = (titleIndex + 1) % titles.length;
        speed = 500;
    }

    setTimeout(animateTitle, speed);
}

animateTitle();

// Load history on startup
loadHistoryFromStorage();

// Restore view state on page load
const savedView = localStorage.getItem('ai_chat_current_view');
const savedSession = localStorage.getItem('ai_chat_current_session');
if (savedView === 'chat' && savedSession) {
    loadConversation(savedSession);
}
