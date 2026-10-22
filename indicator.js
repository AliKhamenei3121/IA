const AI_PROMPT = {
    system: `## REGLA NUMERO 1: SIEMPRE RESPONDE EN ESPAÑOL
Eres "AI Assistant", un asistente experto y con excelente memoria.

## MEMORIA Y CONTEXTO
- Recuerda TODO lo que el usuario ha dicho en la conversación
- Usa el contexto de mensajes anteriores para entender preguntas como "y eso?", "cuéntame más", "explícalo mejor"
- Si el usuario hace referencia a algo anterior, RESPONDE basándote en ese contexto
- NUNCA pierdas el hilo de la conversación
- Si el usuario pregunta sobre algo que dijiste antes, recuerda y expande

## PROHIBICIONES ABSOLUTAS
- NUNCA muestres "thinking", "analysis", "Here's", "Let me"
- NUNCA escribas en inglés
- NUNCA expliques cómo piensas
- RESPONDE DIRECTAMENTE sin procesamiento previo visible

## COMPORTAMIENTO
- Eres experto en tecnología y programación
- Recuerda preferencias del usuario dentro de la conversación
- Si el usuario dice "continúa", continúa donde quedaste
- Si dice "explícalo mejor", da más detalles sobre lo que ya hablaste
- Usa markdown: **negritas**, \`código\`, listas
- Sé amable pero conciso

## EJEMPLO
Usuario: "¿Qué es React?"
Asistente: "React es una librería de JavaScript para crear interfaces de usuario..."
Usuario: "¿Y eso?"
Asistente: "Como te mencioné antes, React es para UI. Te explico con más detalle..."`,

    examples: [],

    getPrompt(userMessage, chatHistory = []) {
        const messages = [
            { role: "system", content: this.system }
        ];

        // Smart history: send more recent messages, summarize older ones
        const maxMessages = 50;
        let historyToSend = [];
        
        if (chatHistory.length > maxMessages) {
            // Keep first 5 messages for initial context
            const firstMessages = chatHistory.slice(0, 5);
            // Keep last 45 messages for recent context
            const recentMessages = chatHistory.slice(-45);
            historyToSend = [...firstMessages, ...recentMessages];
        } else {
            historyToSend = chatHistory;
        }

        historyToSend.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });

        messages.push({
            role: 'user',
            content: userMessage
        });

        return messages;
    },

    formatForProvider(messages, provider) {
        switch(provider) {
            case 'gemini':
                return this.formatForGemini(messages);
            case 'anthropic':
                return this.formatForAnthropic(messages);
            default:
                return this.formatForOpenAI(messages);
        }
    },

    formatForOpenAI(messages) {
        return messages.filter(m => m.role !== 'system');
    },

    formatForGemini(messages) {
        const systemInstruction = messages.find(m => m.role === 'system');
        const conversation = messages.filter(m => m.role !== 'system');
        
        const contents = conversation.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        return {
            systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction.content }] } : undefined,
            contents: contents
        };
    },

    formatForAnthropic(messages) {
        const systemMessage = messages.find(m => m.role === 'system');
        const conversation = messages.filter(m => m.role !== 'system');
        
        return {
            system: systemMessage ? systemMessage.content : undefined,
            messages: conversation.map(m => ({
                role: m.role,
                content: m.content
            }))
        };
    },

    cleanResponse(text) {
        let cleaned = text;

        // Remove common thinking patterns in English
        const patterns = [
            /^(Here's|Let me|I need|The user|My analysis|Here is|Based on|Looking at|I can see|I think|I believe|The image|This image|The scene|Here is a|Let's|This is)[\s\S]*?(?=\n\n|\*\*|#|$)/gim,
            /Here's a thinking process[\s\S]*?(?=\n\n|$)/gi,
            /\*{2}Analysis[\s\S]*?(?=\n\n|$)/gi
        ];

        for (const pattern of patterns) {
            cleaned = cleaned.replace(pattern, '');
        }

        // If after cleaning, the response is too short, return original
        if (cleaned.trim().length < 20 && text.length > 50) {
            return text;
        }

        return cleaned.trim() || text;
    },

    renderMarkdown(text) {
        let html = this.cleanResponse(text);

        // Code blocks
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'plaintext';
            const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<div class="code-block"><div class="code-header"><span>${language}</span><button class="copy-code-btn" onclick="copyCode(this)"><i class="fa-regular fa-copy"></i> Copiar</button></div><pre><code class="language-${language}">${escapedCode}</code></pre></div>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

        // Lists
        html = html.replace(/^\- (.+)$/gm, '<li>$1</li>');
        html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color: #4a90d9;">$1</a>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }
};

function copyCode(btn) {
    const codeBlock = btn.closest('.code-block');
    const code = codeBlock.querySelector('code').textContent;
    navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado';
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar';
        }, 2000);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AI_PROMPT;
}
