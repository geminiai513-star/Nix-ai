import React, { useState, useEffect, useRef } from 'react';

// --- Konstanta dan Konfigurasi ---
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MODELS = {
    CHAT: 'gemini-2.5-flash-preview-05-20',
    IMAGE: 'gemini-2.5-flash-image-preview'
};
const IMAGE_COMMAND = '/gambar '; // Perintah untuk generate gambar

// --- Komponen Anak (Child Components) ---

/**
 * Komponen untuk menampilkan konten pesan (teks atau gambar)
 * dan menangani rendering Markdown.
 */
const MessageContent = React.memo(({ part, isMarkedLoaded }) => {
    if (part.type === 'image') {
        return <img src={part.content} alt="Generated content" className="mt-2 rounded-lg max-w-full h-auto" />;
    }

    if (part.type === 'text') {
        const htmlContent = isMarkedLoaded && window.marked 
            ? window.marked.parse(part.content) 
            : part.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        return <div className="ai-chat-content text-sm sm:text-base break-words" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }
    
    return null;
});

/**
 * Komponen untuk menampilkan satu gelembung pesan lengkap (avatar + konten).
 */
const MessageBubble = React.memo(({ msg, isMarkedLoaded }) => {
    const isUser = msg.role === 'user';
    
    const bubbleClasses = isUser 
        ? 'bg-indigo-500 text-white rounded-br-none' 
        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none';

    const Avatar = ({ children }) => (
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-gray-300 text-gray-600">
            {children}
        </div>
    );
    
    const ModelAvatar = () => (
         <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>
    );

    return (
        <div className={`flex items-start gap-2 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <ModelAvatar />}
            <div className={`max-w-[85%] sm:max-w-lg lg:max-w-2xl rounded-2xl p-3 sm:p-4 shadow-sm ${bubbleClasses}`}>
                {msg.parts.map((part, index) => (
                    <MessageContent key={index} part={part} isMarkedLoaded={isMarkedLoaded} />
                ))}
            </div>
            {isUser && <Avatar>Y</Avatar>}
        </div>
    );
});

/**
 * Komponen untuk form input chat di bagian footer.
 */
const ChatInputForm = React.memo(({ value, onChange, onSubmit, isLoading, hasApiKey }) => (
    <form onSubmit={onSubmit} className="max-w-3xl mx-auto flex items-center gap-3">
        <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={hasApiKey ? "Ketik pesan atau '/gambar'..." : "Masukkan API Key Anda..."}
            className="flex-1 px-4 py-3 sm:px-5 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition duration-200 text-sm sm:text-base"
            disabled={isLoading}
        />
        <button
            type="submit"
            disabled={isLoading || !value}
            className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-500 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex-shrink-0"
        >
            {isLoading ? (
                <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                </svg>
            )}
        </button>
    </form>
));


// --- Logika API (Dipisahkan dari Komponen) ---

/**
 * Fungsi untuk mengambil respons dari Gemini API.
 * @param {string} prompt - Teks prompt dari pengguna.
 * @param {string} apiKey - Kunci API pengguna.
 * @returns {Promise<Array>} - Sebuah promise yang resolve menjadi array of parts dari model.
 */
async function fetchModelResponse(prompt, apiKey) {
    const isImagePrompt = prompt.toLowerCase().startsWith(IMAGE_COMMAND);
    const model = isImagePrompt ? MODELS.IMAGE : MODELS.CHAT;
    const finalPrompt = isImagePrompt ? prompt.substring(IMAGE_COMMAND.length) : prompt;

    const apiUrl = `${API_BASE_URL}${model}:generateContent?key=${apiKey}`;
    
    const payload = { contents: [{ parts: [{ text: finalPrompt }] }] };
    if (isImagePrompt) {
        payload.generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
    } else {
        payload.tools = [{ "google_search": {} }];
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Request gagal dengan status ${response.status}`);
    }

    const result = await response.json();

    if (!result.candidates?.length) {
        const reason = result.promptFeedback?.blockReason || "Konten diblokir atau tidak ada respons valid";
        throw new Error(`Permintaan diblokir: ${reason}.`);
    }

    const parts = result.candidates[0].content?.parts;
    if (!parts) {
        throw new Error("Respons dari API tidak memiliki format konten yang valid.");
    }
    
    return parts.map(part => {
        if (part.text) return { type: 'text', content: part.text };
        if (part.inlineData) return { type: 'image', content: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` };
        return null;
    }).filter(Boolean);
}


// --- Komponen Utama Aplikasi ---

export default function App() {
    // State management
    const [apiKey, setApiKey] = useState('');
    const [messages, setMessages] = useState([
        { role: 'model', parts: [{ type: 'text', content: 'Selamat datang di Asisten AI. Untuk memulai, silakan masukkan API Key dari Google AI Studio Anda.' }] }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isMarkedLoaded, setIsMarkedLoaded] = useState(false);

    const chatContainerRef = useRef(null);

    // --- Hooks ---

    // Hook untuk auto-scroll ke pesan terbaru
    useEffect(() => {
        chatContainerRef.current?.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }, [messages]);
    
    // Hook untuk memuat script marked.js dari CDN
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
        script.async = true;
        script.onload = () => setIsMarkedLoaded(true);
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, []);

    // Hook untuk menonaktifkan scroll pada body (efek aplikasi native)
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        return () => {
            document.body.style.overflow = '';
            document.body.style.position = '';
        };
    }, []);

    // --- Handlers ---

    const handleApiKeySubmit = (key) => {
        if (key.startsWith('AIzaSy') && key.length > 35) {
            setApiKey(key);
            setMessages([{ role: 'model', parts: [{ type: 'text', content: 'Terima kasih! API Key disimpan. Anda siap memulai.' }] }]);
            setError(null);
        } else {
            setError('API Key tidak valid. Mohon periksa kembali.');
        }
    };
    
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const trimmedInput = inputValue.trim();
        if (!trimmedInput || isLoading) return;

        setInputValue('');

        if (!apiKey) {
            handleApiKeySubmit(trimmedInput);
            return;
        }

        setError(null);
        setIsLoading(true);
        setMessages(prev => [...prev, { role: 'user', parts: [{ type: 'text', content: trimmedInput }] }]);

        try {
            const modelParts = await fetchModelResponse(trimmedInput, apiKey);
            setMessages(prev => [...prev, { role: 'model', parts: modelParts }]);
        } catch (err) {
            console.error('API call failed:', err);
            const errorMessage = `Maaf, terjadi kesalahan: ${err.message}`;
            setError(errorMessage);
            setMessages(prev => [...prev, { role: 'model', parts: [{ type: 'text', content: errorMessage }] }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    // CSS Styles untuk Markdown
    const markdownStyles = `
        .ai-chat-content * { margin: 0 !important; padding: 0 !important; line-height: 1.5; }
        .ai-chat-content p, .ai-chat-content ul, .ai-chat-content ol, .ai-chat-content blockquote, .ai-chat-content pre, .ai-chat-content table { margin-bottom: 0.6em !important; }
        .ai-chat-content ul, .ai-chat-content ol { padding-left: 1.5rem !important; }
        .ai-chat-content ul { list-style: disc outside !important; }
        .ai-chat-content ol { list-style: decimal outside !important; }
        .ai-chat-content li { padding-left: 0.25rem !important; margin-bottom: 0.25em !important; }
        .ai-chat-content > :last-child, .ai-chat-content li:last-child { margin-bottom: 0 !important; }
        .ai-chat-content table { width: 100%; border-collapse: collapse; }
        .ai-chat-content th, .ai-chat-content td { border: 1px solid #e2e8f0; padding: 0.4rem 0.6rem !important; }
        .ai-chat-content th { background-color: #f7fafc; }
        .ai-chat-content code { background-color: #edf2f7; padding: 0.2em 0.4em !important; font-size: 85%; border-radius: 3px; }
        .ai-chat-content pre { background-color: #2d3748; color: #e2e8f0; padding: 0.75rem !important; border-radius: 0.5rem; overflow-x: auto; }
        .ai-chat-content pre code { background-color: transparent; color: inherit; }
        .ai-chat-content a { color: #4299e1; text-decoration: underline; }
        .ai-chat-content blockquote { border-left: 0.25em solid #e2e8f0; padding-left: 1em !important; color: #718096; }
    `;

    return (
        <div className="h-screen w-screen bg-gray-50 font-sans flex flex-col antialiased" style={{ touchAction: 'manipulation' }}>
            <style>{markdownStyles}</style>
            <header className="bg-white/70 backdrop-blur-lg border-b border-gray-200 p-4 shadow-sm z-10 flex-shrink-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-800 text-center">AI Personal Assistant</h1>
            </header>
            
            <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.map((msg, index) => (
                    <MessageBubble key={index} msg={msg} isMarkedLoaded={isMarkedLoaded} />
                ))}
            </main>

            <footer className="bg-white/70 backdrop-blur-lg border-t border-gray-200 p-3 sm:p-4 flex-shrink-0">
                 {error && <p className="text-red-500 text-center text-sm mb-2 px-2">{error}</p>}
                <ChatInputForm 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onSubmit={handleSendMessage}
                    isLoading={isLoading}
                    hasApiKey={!!apiKey}
                />
            </footer>
        </div>
    );
}

