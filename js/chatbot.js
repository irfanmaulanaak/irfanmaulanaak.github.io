/**
 * Simple Chatbot Logic for AI Proxy
 */

(function () {
    const chatbotToggle = document.getElementById('chatbot-toggle');
    const chatbotWindow = document.getElementById('chatbot-window');
    const chatbotClose = document.getElementById('chatbot-close');
    const chatbotInput = document.getElementById('chatbot-input-field');
    const chatbotSend = document.getElementById('chatbot-send');
    const chatbotMessages = document.getElementById('chatbot-messages');

    if (!chatbotToggle || !chatbotWindow) return;

    // Toggle window visibility
    chatbotToggle.addEventListener('click', () => {
        chatbotWindow.classList.toggle('hidden');
        if (!chatbotWindow.classList.contains('hidden')) {
            chatbotInput.focus();
        }
    });

    chatbotClose.addEventListener('click', () => {
        chatbotWindow.classList.add('hidden');
    });

    // Send message on Enter or Click
    chatbotInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleUserMessage();
    });

    chatbotSend.addEventListener('click', handleUserMessage);

    function handleUserMessage() {
        const text = chatbotInput.value.trim();
        if (!text) return;

        // Display user message
        const userMsgDiv = document.createElement('div');
        userMsgDiv.className = 'message user-message';
        userMsgDiv.textContent = text;
        chatbotMessages.appendChild(userMsgDiv);

        chatbotInput.value = '';
        scrollToBottom();

        // Simulate AI thinking and responding
        setTimeout(() => {
            const aiMsgDiv = document.createElement('div');
            aiMsgDiv.className = 'message ai-message typing';
            aiMsgDiv.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
            chatbotMessages.appendChild(aiMsgDiv);
            scrollToBottom();

            setTimeout(() => {
                aiMsgDiv.classList.remove('typing');
                aiMsgDiv.textContent = getAIResponse(text);
                scrollToBottom();
            }, 1200 + Math.random() * 1000); // 1.2s - 2.2s delay for "thinking"
        }, 300);
    }

    function scrollToBottom() {
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }

    // A simple rule-based response generation mapped to Irfan's resume
    function getAIResponse(query) {
        const lowerQuery = query.toLowerCase();

        // Check for specific keywords
        if (lowerQuery.includes('solidity') || lowerQuery.includes('smart contract') || lowerQuery.includes('web3')) {
            return "Yes! Irfan has deep experience with Solidity. He built the COSMIZE Metaverse on Astar, developed NFT marketplaces (Sakeworld & Dragonflies) using ERC721A, and worked on the Bitzaro WaaS platform.";
        }
        if (lowerQuery.includes('n8n') || lowerQuery.includes('automation') || lowerQuery.includes('llm') || lowerQuery.includes('ai')) {
            return "Irfan is an expert in n8n automation and LLM integration. At ACRES, he built an internal AI infrastructure and robust workflows that integrate Large Language Models (LLMs) to automate development pipelines.";
        }
        if (lowerQuery.includes('backend') || lowerQuery.includes('language') || lowerQuery.includes('python') || lowerQuery.includes('javascript') || lowerQuery.includes('typescript')) {
            return "His primary backend languages are JavaScript, TypeScript, Python, and Solidity. He builds resilient backend systems, WebSocket integrations, and scalable APIs.";
        }
        if (lowerQuery.includes('hire') || lowerQuery.includes('freelance') || lowerQuery.includes('contact') || lowerQuery.includes('job') || lowerQuery.includes('email')) {
            return "Irfan is currently open to demanding roles in Web3 and AI infrastructure! You can email him at irfanmaulanaaaaa.im@gmail.com or connect on LinkedIn.";
        }
        if (lowerQuery.includes('trading') || lowerQuery.includes('bot') || lowerQuery.includes('perp')) {
            return "Currently at ACRES, Irfan builds automated perpetual trading bots for DEX platforms like Lighter, Apex, Extended, Nado, and Variational.";
        }
        if (lowerQuery.includes('education') || lowerQuery.includes('university') || lowerQuery.includes('study')) {
            return "He holds a Bachelor of Engineering majoring in Computer Science from Brawijaya University (2017-2021).";
        }
        if (lowerQuery.includes('hi') || lowerQuery.includes('hello')) {
            return "Hello there! How can I help you learn more about Irfan's skills and experience?";
        }
        if (lowerQuery.includes('who are you')) {
            return "I am an AI proxy built to answer questions about Irfan Maulana Akbar's professional experience as a Web3 and AI Engineer. What would you like to know?";
        }

        // Generic fallback
        return "That's a great question. While I'm a simple AI clone trained on his resume, I know Irfan excels in solving complex backend, Web3, and AI problems. Feel free to ask about his specific projects like COSMIZE or his n8n automation experience!";
    }
})();
