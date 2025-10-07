import React, { useState, useEffect, useRef } from 'react';

// --- Konstanta dan Konfigurasi ---
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';
const MODELS = {
    // Model untuk chat, termasuk kemampuan analisis gambar/PDF (multimodal)
    CHAT: 'gemini-2.5-flash-preview-05-20',
    // Model khusus untuk membuat gambar dari teks
    IMAGE: 'gemini-2.5-flash-image-preview'
};
const IMAGE_COMMAND = '/gambar '; // Perintah untuk generate gambar

// --- Fungsi Bantuan (Helpers) ---

/**
 * Memformat ukuran file dari bytes ke unit yang lebih mudah dibaca (KB, MB).
 * @param {number} bytes - Ukuran file dalam bytes.
 * @returns {string} Ukuran file yang telah diformat.
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- Komponen Ikon (SVG) ---

const CustomPdfIcon = () => (
    <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xmlSpace="preserve" fill="#000000">
        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"><path style={{fill: '#E2E5E7'}} d="M128,0c-17.6,0-32,14.4-32,32v448c0,17.6,14.4,32,32,32h320c17.6,0,32-14.4,32-32V128L352,0H128z"></path><path style={{fill: '#B0B7BD'}} d="M384,128h96L352,0v96C352,113.6,366.4,128,384,128z"></path><polygon style={{fill: '#CAD1D8'}} points="480,224 384,128 480,128 "></polygon><path style={{fill: '#F15642'}} d="M416,416c0,8.8-7.2,16-16,16H48c-8.8,0-16-7.2-16-16V256c0-8.8,7.2-16,16-16h352c8.8,0,16,7.2,16,16 V416z"></path><g><path style={{fill: '#FFFFFF'}} d="M101.744,303.152c0-4.224,3.328-8.832,8.688-8.832h29.552c16.64,0,31.616,11.136,31.616,32.48 c0,20.224-14.976,31.488-31.616,31.488h-21.36v16.896c0,5.632-3.584,8.816-8.192,8.816c-4.224,0-8.688-3.184-8.688-8.816V303.152z M118.624,310.432v31.872h21.36c8.576,0,15.36-7.568,15.36-15.504c0-8.944-6.784-16.368-15.36-16.368H118.624z"></path><path style={{fill: '#FFFFFF'}} d="M196.656,384c-4.224,0-8.832-2.304-8.832-7.92v-72.672c0-4.592,4.608-7.936,8.832-7.936h29.296 c58.464,0,57.184,88.528,1.152,88.528H196.656z M204.72,311.088V368.4h21.232c34.544,0,36.08-57.312,0-57.312H204.72z"></path><path style={{fill: '#FFFFFF'}} d="M303.872,312.112v20.336h32.624c4.608,0,9.216,4.608,9.216,9.072c0,4.224-4.608,7.68-9.216,7.68 h-32.624v26.864c0,4.48-3.184,7.92-7.664,7.92c-5.632,0-9.072-3.44-9.072-7.92v-72.672c0-4.592,3.456-7.936,9.072-7.936h44.912 c5.632,0,8.96,3.344,8.96,7.936c0,4.096-3.328,8.704-8.96,8.704h-37.248V312.112z"></path></g><path style={{fill: '#CAD1D8'}} d="M400,432H96v16h304c8.8,0,16-7.2,16-16v-16C416,424.8,408.8,432,400,432z"></path></g>
    </svg>
);

const XIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 group-hover:text-white transition-colors">
        <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

// --- Komponen Anak (Child Components) ---

/**
 * Merender konten pesan dari AI, menangani Markdown untuk teks dan menampilkan gambar.
 */
const AiMessageContent = React.memo(({ part, isMarkedLoaded }) => {
    if (part.type.startsWith('image/')) {
        return <img src={part.content} alt="Generated Content" className="mt-2 rounded-lg max-w-full h-auto" />;
    }
    
    if (part.type === 'text') {
        const htmlContent = isMarkedLoaded && window.marked ? window.marked.parse(part.content) : part.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return <div className="ai-chat-content text-sm sm:text-base break-words" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    }
    return null;
});

/**
 * Merender gelembung pesan, dibedakan antara pesan pengguna dan AI.
 */
const MessageBubble = React.memo(({ msg, isMarkedLoaded }) => {
    const isUser = msg.role === 'user';
    const bubbleClasses = isUser ? 'bg-blue-100 text-blue-900 rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none';
    const Avatar = ({ children }) => (<div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 bg-gray-300 text-gray-600">{children}</div>);
    const ModelAvatar = () => (<div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">AI</div>);
    
    const textPart = msg.parts.find(p => p.type === 'text');
    const fileParts = msg.parts.filter(p => p.type !== 'text');

    return (
        <div className={`flex items-start gap-2 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <ModelAvatar />}
            <div className={`max-w-[85%] sm:max-w-lg lg:max-w-2xl rounded-2xl p-3 sm:p-4 shadow-sm ${bubbleClasses}`}>
                {isUser ? (
                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                        {textPart && <p className="text-sm sm:text-base whitespace-pre-wrap break-words">{textPart.content}</p>}
                        {fileParts.length > 0 && (
                            <span className="text-sm sm:text-base font-semibold text-blue-900 whitespace-nowrap">
                                Lampiran: {fileParts.map(p => p.name).join(', ')}
                            </span>
                        )}
                    </div>
                ) : (
                    msg.parts.map((part, index) => <AiMessageContent key={index} part={part} isMarkedLoaded={isMarkedLoaded} />)
                )}
            </div>
            {isUser && <Avatar>Y</Avatar>}
        </div>
    );
});

/**
 * Merender area pratinjau untuk file yang akan diunggah.
 */
const FilePreview = React.memo(({ files, onRemoveFile }) => {
    if (files.length === 0) return null;

    return (
        <div className="max-w-3xl mx-auto mb-2 p-2 bg-gray-100 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {files.map(file => {
                    let previewIcon;
                    if (file.type.startsWith('image/')) {
                        previewIcon = <img src={file.base64Data} alt={file.name} className="w-8 h-8 rounded-md object-cover flex-shrink-0" />;
                    } else if (file.type === 'application/pdf') {
                        previewIcon = <div className="w-8 h-8 flex-shrink-0"><CustomPdfIcon /></div>;
                    }

                    return (
                        <div key={file.id} className="bg-white p-2 rounded-lg shadow-sm flex items-center gap-3 relative text-xs">
                            {previewIcon}
                            <div className="flex-grow overflow-hidden">
                                <p className="font-medium text-gray-800 truncate">{file.name}</p>
                                <p className="text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                            <button onClick={() => onRemoveFile(file.id)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-red-500 group transition-colors" aria-label="Hapus file">
                                <XIcon />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

/**
 * Merender form input untuk mengirim pesan dan file.
 */
const ChatInputForm = React.memo(({ value, onChange, onSubmit, isLoading, hasApiKey, onFileChange, hasFiles }) => {
    const fileInputRef = useRef(null);
    return (
        <form onSubmit={onSubmit} className="max-w-3xl mx-auto flex items-center gap-3">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 sm:w-12 sm:h-12 border border-gray-300 text-gray-500 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0" aria-label="Tambah file">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <input type="file" ref={fileInputRef} onChange={onFileChange} multiple accept="image/*,application/pdf" className="hidden" />
            <input type="text" value={value} onChange={onChange} placeholder={hasApiKey ? "Ketik pesan atau '/gambar'..." : "Masukkan API Key Anda..."} className="flex-1 px-4 py-3 sm:px-5 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition duration-200 text-sm sm:text-base" disabled={isLoading} />
            <button type="submit" disabled={isLoading || (!value && !hasFiles)} className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-500 text-white rounded-full flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex-shrink-0" aria-label="Kirim pesan">
                {isLoading ? (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" aria-label="Memuat"></div>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                )}
            </button>
        </form>
    );
});


// --- Logika API ---

/**
 * Mengirim request ke Gemini API dan memproses responsnya.
 * @param {string} prompt - Teks promp dari pengguna.
 * @param {Array} files - Daftar file yang diunggah.
 * @param {string} apiKey - Kunci API pengguna.
 * @returns {Promise<Array>} Daftar 'parts' dari respons model.
 */
async function fetchModelResponse(prompt, files, apiKey) {
    let model;
    const parts = [];
    let finalPrompt = prompt;

    // Tentukan model dan payload berdasarkan input (teks, file, atau perintah gambar)
    if (files.length > 0) {
        model = MODELS.CHAT; // Gunakan model multimodal jika ada file
        
        // PERBAIKAN: Buat promp yang lebih eksplisit jika ada file
        if (prompt) {
            // Jika pengguna memberikan teks, gabungkan dengan instruksi
            finalPrompt = `Berdasarkan file terlampir, ${prompt}`;
        } else {
            // Jika hanya file yang dikirim, minta AI untuk merangkumnya
            finalPrompt = "Tolong rangkum atau jelaskan isi dari file yang terlampir ini.";
        }
        parts.push({ text: finalPrompt });

        files.forEach(file => {
            parts.push({ inlineData: { mimeType: file.type, data: file.base64Data.split(',')[1] } });
        });

    } else {
        const isImagePrompt = prompt.toLowerCase().startsWith(IMAGE_COMMAND);
        model = isImagePrompt ? MODELS.IMAGE : MODELS.CHAT;
        finalPrompt = isImagePrompt ? prompt.substring(IMAGE_COMMAND.length) : prompt;
        parts.push({ text: finalPrompt });
    }
    
    const apiUrl = `${API_BASE_URL}${model}:generateContent?key=${apiKey}`;
    const payload = { contents: [{ parts }] };
    
    if (model === MODELS.IMAGE) {
        payload.generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
    } else if (model === MODELS.CHAT && files.length === 0) {
        payload.tools = [{ "google_search": {} }]; // Gunakan Google Search hanya untuk chat teks
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

    const responseParts = result.candidates[0].content?.parts;
    if (!responseParts) {
        throw new Error("Respons dari API tidak memiliki format konten yang valid.");
    }
    
    return responseParts.map(part => {
        if (part.text) return { type: 'text', content: part.text };
        if (part.inlineData) return { type: part.inlineData.mimeType, content: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` };
        return null;
    }).filter(Boolean);
}


// --- Komponen Utama Aplikasi ---
export default function App() {
    const [apiKey, setApiKey] = useState('');
    const [messages, setMessages] = useState([
        { role: 'model', parts: [{ type: 'text', content: 'Selamat datang di Asisten AI. Untuk memulai, silakan masukkan API Key dari Google AI Studio Anda.' }] }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isMarkedLoaded, setIsMarkedLoaded] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);

    const chatContainerRef = useRef(null);

    // --- Hooks ---
    useEffect(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages]);
    
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
        script.async = true;
        script.onload = () => setIsMarkedLoaded(true);
        document.body.appendChild(script);
        return () => { document.body.removeChild(script); };
    }, []);

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

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                setError(`File tidak didukung: ${file.name}`);
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedFiles(prev => [...prev, {
                    id: crypto.randomUUID(), name: file.name, size: file.size,
                    type: file.type, base64Data: reader.result
                }]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = null;
    };
    
    const handleRemoveFile = (fileId) => {
        setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    };
    
    const handleSendMessage = async (e) => {
        e.preventDefault();
        const trimmedInput = inputValue.trim();
        if (!trimmedInput && uploadedFiles.length === 0) return;

        if (!apiKey) {
            handleApiKeySubmit(trimmedInput);
            setInputValue('');
            return;
        }

        const userMessageParts = [];
        if (trimmedInput) {
            userMessageParts.push({type: 'text', content: trimmedInput});
        }
        uploadedFiles.forEach(file => {
            userMessageParts.push({ type: file.type, content: file.base64Data, name: file.name });
        });

        setError(null);
        setIsLoading(true);
        setMessages(prev => [...prev, { role: 'user', parts: userMessageParts }]);
        setInputValue('');
        
        try {
            const modelParts = await fetchModelResponse(trimmedInput, uploadedFiles, apiKey);
            setMessages(prev => [...prev, { role: 'model', parts: modelParts }]);
        } catch (err) {
            console.error('API call failed:', err);
            const errorMessage = `Maaf, terjadi kesalahan: ${err.message}`;
            setError(errorMessage);
            setMessages(prev => [...prev, { role: 'model', parts: [{ type: 'text', content: errorMessage }] }]);
        } finally {
            setIsLoading(false);
            setUploadedFiles([]);
        }
    };
    
    const markdownStyles = `
        /* Styles untuk merender konten Markdown dari AI dengan rapi */
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
        <div className="h-screen w-screen bg-gray-50 font-sans flex flex-col antrialsed" style={{ touchAction: 'manipulation' }}>
            <style>{markdownStyles}</style>
            <header className="bg-white/70 backdrop-blur-lg border-b border-gray-200 p-4 shadow-sm z-10 flex-shrink-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-800 text-center">AI Personal Assistant</h1>
            </header>
            
            <main ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {messages.map((msg, index) => <MessageBubble key={index} msg={msg} isMarkedLoaded={isMarkedLoaded} />)}
            </main>

            <footer className="bg-white/70 backdrop-blur-lg border-t border-gray-200 p-3 sm:p-4 flex-shrink-0">
                 {error && <p className="text-red-500 text-center text-sm mb-2 px-2">{error}</p>}
                 <FilePreview files={uploadedFiles} onRemoveFile={handleRemoveFile} />
                <ChatInputForm 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onSubmit={handleSendMessage}
                    isLoading={isLoading}
                    hasApiKey={!!apiKey}
                    onFileChange={handleFileChange}
                    hasFiles={uploadedFiles.length > 0}
                />
            </footer>
        </div>
    );
}

