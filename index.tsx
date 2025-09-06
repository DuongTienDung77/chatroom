// @ts-nocheck
import { GoogleGenAI, Modality } from "@google/genai";

// --- MOCK DATA ---
const now = Date.now();
const MOCK_USERS = {
    '1': { name: 'Admin User', role: 'Admin', avatar: 'AU', color: 'bg-red-500', online: true, banned: { status: false, until: null }, gender: 'Nam', age: 30, country: 'Việt Nam', language: 'vi' },
    '2': { name: 'Nguyễn Đức', role: 'Member', avatar: 'NĐ', color: 'bg-green-500', online: true, banned: { status: false, until: null }, gender: 'Nam', age: 25, country: 'Việt Nam', language: 'vi' },
    '3': { name: 'Hoàng Anh', role: 'Mod', avatar: 'HA', color: 'bg-purple-500', online: true, banned: { status: false, until: null }, gender: 'Nữ', age: 28, country: 'Việt Nam', language: 'en' },
    '4': { name: 'Trần Bình', role: 'Member', avatar: 'TB', color: 'bg-yellow-500', online: false, banned: { status: false, until: null }, gender: 'Nam', age: 22, country: 'Việt Nam', language: 'vi' },
    'ai_assistant': { name: 'Trợ lý AI', role: 'Member', avatar: 'AI', color: 'bg-cyan-500', online: true, banned: { status: false, until: null }, gender: 'Khác', age: 1, country: 'Toàn cầu', language: 'vi' },
};

const MOCK_CHANNELS = {
    'general': { name: 'general', type: 'channel', private: false, members: [], creatorId: '1' }
};

const MOCK_MESSAGES = {
    'general': [
        { type: 'user', userId: '2', originalText: 'Chào mọi người, dự án mới thế nào rồi?', time: now - 20 * 60 * 1000, files: [], pinned: false },
        { type: 'user', userId: '3', originalText: 'Hi everyone, everything is on schedule.', time: now - 19 * 60 * 1000, files: [], pinned: false },
        { type: 'user', userId: '1', originalText: 'Tốt lắm, mọi người cứ tiếp tục phát huy nhé. Cần hỗ trợ gì cứ báo cho tôi.', time: now - 5 * 60 * 1000, files: [], pinned: true },
    ],
    'user_2': [
        { type: 'user', userId: '2', originalText: 'Chào bạn, cuối tuần này có rảnh không?', time: now - 60 * 60 * 1000, files: [], pinned: false },
    ],
    'user_3': [
        { type: 'user', userId: '3', originalText: 'Could you please review this file for me?', time: now - 2 * 60 * 60 * 1000, files: [], pinned: false },
    ],
    'user_ai_assistant': [
        { type: 'user', userId: 'ai_assistant', originalText: 'Xin chào! Tôi là Trợ lý AI. Tôi có thể giúp gì cho bạn? Hãy thử yêu cầu tôi "vẽ một chú chó đang lướt sóng", hoặc gửi cho tôi 2 bức ảnh và yêu cầu tôi kết hợp chúng!', time: now - 1000, files: [], pinned: false },
    ]
};

const EMOJI_LIST = [
    '😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗',
    '😙', '😚', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐',
    '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲',
    '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵',
    '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '😇', '🤠', '🥳',
    '🥴', '🥺', '🤡', '🤥', '🤫', '🤭', '🧐', '🤓', '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
    '👋', '🤚', '🖐', '✋', '🖖', '👏', '🙌', '🙏', '🤝', '❤️', '🧡', '💛', '💚', '💙', '💜', '💔'
];

const SUPPORTED_LANGUAGES = {
    'vi': 'Vietnamese',
    'en': 'English',
    'ko': 'Korean',
    'zh': 'Chinese',
};

// --- TYPES ---
type UserRole = 'Admin' | 'Mod' | 'Member';
interface User {
    name: string;
    role: UserRole;
    avatar: string;
    color: string;
    online: boolean;
    banned: { status: boolean, until: number | 'permanent' | null };
    gender?: 'Nam' | 'Nữ' | 'Khác';
    age?: number;
    country?: string;
    language: string;
}
type AppState = {
    currentUser: { id: string, data: User } | null;
    activeChat: { id: string, name: string, type: 'channel' | 'user' } | null;
};

// Fix: Moved `declare const lucide` to the top level to correctly type the global `lucide` object and resolve "Modifiers cannot appear here" error.
declare const lucide: any;

// --- GLOBAL STATE ---
const state: AppState = {
    currentUser: null,
    activeChat: null,
};
let recognition: any = null;
let isListening = false;
let initialText = '';
let unreadStatus: Record<string, number> = {
    'general': 2,
    'user_3': 1,
};
let searchQuery = '';
let typingTimer: number | null = null;
let pendingFiles: { file: File, dataUrl: string }[] = [];
let replyingToMessage: any | null = null;
let translationSettings: { [key: string]: { source: string, target: string } } = {};
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
let callState = {
    status: 'idle', // 'idle', 'calling', 'in-call'
    stream: null as MediaStream | null,
    startTime: null as number | null,
};
let callUpdateInterval: number | null = null;


// --- DOM ELEMENTS ---
const loginScreen = document.getElementById('login-screen')!;
const appScreen = document.getElementById('app')!;
const loginForm = document.getElementById('login-form')!;
const emailInput = document.getElementById('email') as HTMLInputElement;
const messageForm = document.getElementById('message-form')!;
const messageInput = document.getElementById('messageInput') as HTMLTextAreaElement;
const messagesArea = document.getElementById('messagesArea')!;
const channelsList = document.getElementById('channels-list')!;
const usersList = document.getElementById('users-list')!;
const chatHeader = document.getElementById('chat-header')!;
const currentUserAvatar = document.getElementById('current-user-avatar')!;
const logoutBtn = document.getElementById('logout-btn')!;
const sidebar = document.getElementById('sidebar')!;
const sidebarOverlay = document.getElementById('sidebar-overlay')!;
const menuToggleBtn = document.getElementById('menu-toggle-btn')!;
const sidebarCloseBtn = document.getElementById('sidebar-close-btn')!;
const micBtn = document.getElementById('mic-btn')!;
const voiceStatus = document.getElementById('voice-status')!;
const voiceStatusText = document.getElementById('voice-status-text')!;
const themeToggleBtn = document.getElementById('theme-toggle-btn')!;
const sunIcon = themeToggleBtn.querySelector('[data-lucide="sun"]');
const moonIcon = themeToggleBtn.querySelector('[data-lucide="moon"]');
const searchBtn = document.getElementById('search-btn')!;
const closeSearchBtn = document.getElementById('close-search-btn')!;
const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const searchInputContainer = document.getElementById('search-input-container')!;
const typingIndicatorContainer = document.getElementById('typing-indicator-container')!;
const emojiBtn = document.getElementById('emoji-btn')!;
const emojiPicker = document.getElementById('emoji-picker')!;
const bannedOverlay = document.getElementById('banned-overlay')!;
const bannedMessage = document.getElementById('banned-message')!;
const contextMenu = document.getElementById('context-menu')!;
const modalOverlay = document.getElementById('modal-overlay')!;
const modalContent = document.getElementById('modal-content')!;
const modalTitle = document.getElementById('modal-title')!;
const modalBody = document.getElementById('modal-body')!;
const modalCloseBtn = document.getElementById('modal-close-btn')!;
const attachBtn = document.getElementById('attach-btn')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const filePreviewContainer = document.getElementById('file-preview-container')!;
const replyPreviewContainer = document.getElementById('reply-preview-container')!;
const clearChatBtn = document.getElementById('clear-chat-btn')!;
const translationControls = document.getElementById('translation-controls')!;
const sourceLangSelect = document.getElementById('source-lang-select') as HTMLSelectElement;
const targetLangSelect = document.getElementById('target-lang-select') as HTMLSelectElement;
const tooltip = document.getElementById('tooltip')!;
const videoCallBtn = document.getElementById('video-call-btn')!;
const videoCallScreen = document.getElementById('video-call-screen')!;
const localVideo = document.getElementById('local-video') as HTMLVideoElement;
const remoteImage = document.getElementById('remote-image') as HTMLImageElement;
const remoteImageLoader = document.getElementById('remote-image-loader')!;
const callInfo = document.getElementById('call-info')!;
const endCallBtn = document.getElementById('end-call-btn')!;
const toggleMicBtn = document.getElementById('toggle-mic-btn')!;
const toggleCameraBtn = document.getElementById('toggle-camera-btn')!;
const createChannelBtn = document.getElementById('create-channel-btn')!;
const pinnedMessagesBtn = document.getElementById('pinned-messages-btn')!;
const pinnedMessagesSidebar = document.getElementById('pinned-messages-sidebar')!;
const pinnedMessagesList = document.getElementById('pinned-messages-list')!;
const closePinnedSidebarBtn = document.getElementById('close-pinned-sidebar-btn')!;

// --- RENDER FUNCTIONS ---
function renderRoleIcon(role: UserRole): string {
    if (role === 'Admin') {
        return '<i data-lucide="shield-check" class="w-4 h-4 text-red-500 ml-1.5 flex-shrink-0"></i>';
    }
    if (role === 'Mod') {
        return '<i data-lucide="shield" class="w-4 h-4 text-blue-500 ml-1.5 flex-shrink-0"></i>';
    }
    return '';
}

function renderTranslationControls() {
    if (!state.activeChat) return;

    translationControls.classList.remove('hidden');
    translationControls.classList.add('flex');

    const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
    const settings = translationSettings[chatId] || { source: 'en', target: 'vi' };
    
    sourceLangSelect.value = settings.source;
    targetLangSelect.value = settings.target;
}

function updatePinnedBtnVisibility() {
    if (!state.activeChat) return;
    const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
    const messages = MOCK_MESSAGES[chatId] || [];
    const hasPinnedMessages = messages.some(msg => msg.pinned);
    pinnedMessagesBtn.classList.toggle('hidden', !hasPinnedMessages);
}

function renderChatHeader() {
    if (!state.activeChat) return;
    
    videoCallBtn.classList.add('hidden'); // Hide by default

    let headerHTML = '';
    if (state.activeChat.type === 'channel') {
        headerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                    #
                </div>
                <div>
                    <h2 class="font-semibold text-gray-900 dark:text-white">${state.activeChat.name}</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">${Object.values(MOCK_USERS).filter(u => u.online).length} thành viên đang hoạt động</p>
                </div>
            </div>
        `;
    } else {
        const user = MOCK_USERS[state.activeChat.id];
        headerHTML = `
             <div class="flex items-center space-x-3">
                <div class="w-10 h-10 ${user.color} rounded-full flex items-center justify-center text-white font-semibold">
                    ${user.avatar}
                </div>
                <div>
                    <h2 class="font-semibold text-gray-900 dark:text-white flex items-center">${user.name} ${renderRoleIcon(user.role)}</h2>
                    <p class="text-sm ${user.online ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'} flex items-center">
                        <span class="w-2 h-2 ${user.online ? 'bg-green-500' : 'bg-gray-400'} rounded-full mr-1"></span>
                        ${user.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                    </p>
                </div>
            </div>
        `;
        // Show video call button only for human users
        if (state.activeChat.id !== 'ai_assistant') {
            videoCallBtn.classList.remove('hidden');
        }
    }
    chatHeader.innerHTML = headerHTML;
    renderTranslationControls();
    updatePinnedBtnVisibility();
}

function highlightSearchTerm(text: string, query: string): string {
    if (!text || !query.trim()) {
        return text;
    }
    const escapedQuery = query.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return text.replace(regex, `<mark class="bg-yellow-300 dark:bg-yellow-500 text-black rounded px-0.5">$1</mark>`);
}

function renderFilesInMessage(files, hasText) {
    if (!files || files.length === 0) return '';
    
    const containerMarginTop = hasText ? 'mt-2' : '';
    const fileGridClass = files.length > 1 ? 'grid grid-cols-2 gap-2' : '';

    const filesHTML = files.map(file => {
        const fileSize = file.size > 0 ? (file.size / 1024).toFixed(1) + ' KB' : '';

        if (file.type.startsWith('image/')) {
            return `
                <div class="relative group w-fit">
                    <a href="${file.dataUrl}" target="_blank" title="Xem ảnh">
                        <img src="${file.dataUrl}" alt="${file.name}" class="rounded-lg max-w-xs cursor-pointer">
                    </a>
                    <a href="${file.dataUrl}" download="${file.name}" class="absolute top-2 right-2 p-1.5 bg-gray-900/60 rounded-full text-white hover:bg-gray-900/80 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" title="Tải xuống">
                         <i data-lucide="download" class="w-4 h-4"></i>
                    </a>
                </div>
            `;
        } else {
            return `
                <div class="p-3 bg-gray-100 dark:bg-gray-600/50 rounded-lg flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-500 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="file-text" class="w-6 h-6 text-gray-600 dark:text-gray-300"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                         <p class="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">${file.name}</p>
                         <p class="text-xs text-gray-500 dark:text-gray-400">${fileSize}</p>
                    </div>
                    <a href="${file.dataUrl}" download="${file.name}" class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-500 dark:text-gray-400" title="Tải xuống">
                         <i data-lucide="download" class="w-5 h-5"></i>
                    </a>
                </div>
            `;
        }
    }).join('');

    return `<div class="${containerMarginTop} ${fileGridClass}">${filesHTML}</div>`;
}

function formatTimestampHeader(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const timeString = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    if (date.toDateString() === today.toDateString()) {
        return `Hôm nay, ${timeString}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return `Hôm qua, ${timeString}`;
    }
    return `${date.toLocaleDateString('vi-VN')}, ${timeString}`;
}

function renderMessages() {
    if (!state.activeChat) return;
    messagesArea.innerHTML = '';
    
    const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
    const messages = MOCK_MESSAGES[chatId] || [];

    const messagesToRender = searchQuery.trim() === ''
        ? messages
        : messages.filter(msg => {
            if (msg.type === 'system') return false;
            let textToSearch = msg.originalText;
            if (msg.translations && msg.translations[targetLangSelect.value]) {
                textToSearch += ' ' + msg.translations[targetLangSelect.value];
            }
            return textToSearch && textToSearch.toLowerCase().includes(searchQuery.trim().toLowerCase());
        });

    if (messagesToRender.length === 0) {
        if (searchQuery.trim() !== '') {
            messagesArea.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 mt-4">Không tìm thấy tin nhắn nào.</div>`;
        } else {
            messagesArea.innerHTML = `<div class="text-center text-gray-500 dark:text-gray-400 mt-4">Chưa có tin nhắn nào. Bắt đầu cuộc trò chuyện!</div>`;
        }
        return;
    }
    
    let lastDisplayedTimestamp = null;
    const TIMESTAMP_GROUPING_THRESHOLD_MINUTES = 15;

    messagesToRender.forEach(msg => {
        if (msg.type === 'system') {
            messagesArea.innerHTML += `
                <div class="text-center my-3">
                    <span class="text-xs text-gray-500 dark:text-gray-400 italic">${msg.originalText}</span>
                </div>`;
            return;
        }

        const currentTime = msg.time;
        const timeSinceLastHeader = lastDisplayedTimestamp ? (currentTime - lastDisplayedTimestamp) / (1000 * 60) : Infinity;

        if (timeSinceLastHeader > TIMESTAMP_GROUPING_THRESHOLD_MINUTES) {
            messagesArea.innerHTML += `
                <div class="text-center my-3">
                    <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 px-3 py-1 rounded-full">${formatTimestampHeader(currentTime)}</span>
                </div>
            `;
            lastDisplayedTimestamp = currentTime;
        }
        
        const author = MOCK_USERS[msg.userId];
        const highlightedOriginalText = highlightSearchTerm(msg.originalText, searchQuery);
        const originalTextContentHTML = msg.originalText ? `<p>${highlightedOriginalText}</p>` : '';
        const filesHTML = renderFilesInMessage(msg.files, !!msg.originalText);
        const fullTimestamp = new Date(msg.time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let replyContextHTML = '';
        if (msg.replyTo) {
            const originalMessage = messages.find(m => m.time === msg.replyTo);
            if (originalMessage) {
                const originalAuthor = MOCK_USERS[originalMessage.userId];
                const hasFiles = originalMessage.files && originalMessage.files.length > 0;
                let snippet = originalMessage.originalText
                    ? (originalMessage.originalText.length > 50 ? originalMessage.originalText.substring(0, 50) + '…' : originalMessage.originalText)
                    : (hasFiles ? `Tệp đính kèm (${originalMessage.files.length})` : '');


                replyContextHTML = `
                    <div class="mb-1.5 p-2 pr-1 border-l-2 border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-gray-600/30 rounded-md text-xs cursor-pointer jump-to-message" data-message-time="${originalMessage.time}">
                        <p class="font-semibold text-blue-600 dark:text-blue-400">${originalAuthor.name}</p>
                        <p class="text-gray-600 dark:text-gray-400 truncate">${snippet}</p>
                    </div>
                `;
            }
        }
        
        let textAndTranslationHTML = originalTextContentHTML;

        // --- NEW TRANSLATION LOGIC FOR INCOMING MESSAGES ---
        const authorLang = author.language || 'vi';
        const settings = translationSettings[chatId] || { source: 'en', target: 'vi' };
        
        const needsTranslation = msg.userId !== state.currentUser.id &&
                               authorLang === settings.source &&
                               settings.source !== settings.target &&
                               msg.originalText && msg.originalText.trim() !== '';

        if (needsTranslation) {
            if (!msg.translations) msg.translations = {};

            if (msg.translations[settings.target]) {
                const translatedText = highlightSearchTerm(msg.translations[settings.target], searchQuery);
                textAndTranslationHTML += `<p class="text-sm italic text-gray-500 dark:text-gray-400 mt-1.5 border-t border-gray-200 dark:border-gray-600 pt-1.5">${translatedText}</p>`;
            } else {
                const placeholderId = `trans-${msg.time}-${Math.random().toString(36).substr(2, 9)}`;
                textAndTranslationHTML += `<p class="text-sm italic text-gray-500 dark:text-gray-400 mt-1.5 border-t border-gray-200 dark:border-gray-600 pt-1.5" id="${placeholderId}">Đang dịch...</p>`;
                
                translateText(msg.originalText, settings.source, settings.target).then(translated => {
                    const el = document.getElementById(placeholderId);
                    const result = translated || "Bản dịch không thành công.";
                    if (el) {
                        el.textContent = result;
                    }
                    if (!msg.translations) msg.translations = {};
                    msg.translations[settings.target] = result;
                }).catch(() => {
                    const el = document.getElementById(placeholderId);
                    if (el) el.textContent = "Lỗi dịch.";
                });
            }
        }
        
        const pinIconHTML = msg.pinned ? `<div class="absolute top-1.5 right-2 text-yellow-500 dark:text-yellow-400"><i data-lucide="pin" class="w-3.5 h-3.5"></i></div>` : '';
        const replyBtnHTML = `<button class="reply-btn absolute top-1.5 left-2 p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" data-message-time="${msg.time}" title="Trả lời"><i data-lucide="reply" class="w-3.5 h-3.5"></i></button>`;


        if (msg.userId === state.currentUser?.id) {
            // My message
            messagesArea.innerHTML += `
                <div class="flex items-end justify-end space-x-2 message-bubble group" title="${fullTimestamp}" data-message-time="${msg.time}">
                    <div class="relative bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-lg shadow-sm">
                        ${replyContextHTML}
                        ${originalTextContentHTML}
                        ${filesHTML}
                        ${pinIconHTML}
                    </div>
                    <div class="w-8 h-8 ${state.currentUser?.data.color} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        ${state.currentUser?.data.avatar}
                    </div>
                </div>
            `;
        } else {
            // Other's message
            messagesArea.innerHTML += `
                <div class="flex items-end space-x-2 message-bubble group" title="${fullTimestamp}" data-message-time="${msg.time}">
                    <div class="w-8 h-8 ${author.color} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        ${author.avatar}
                    </div>
                    <div class="relative bg-white dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 max-w-lg shadow-sm">
                        <div class="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center">${author.name} ${renderRoleIcon(author.role)}</div>
                        <div class="text-gray-800 dark:text-gray-300 mt-1">
                           ${replyContextHTML}
                           ${textAndTranslationHTML}
                           ${filesHTML.replace('class="mt-2', 'class="mt-1.5"')}
                        </div>
                        ${pinIconHTML}
                        ${replyBtnHTML}
                    </div>
                </div>
            `;
        }
    });
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function renderSidebarLists() {
    channelsList.innerHTML = '';
    Object.keys(MOCK_CHANNELS).forEach(channelId => {
        const channel = MOCK_CHANNELS[channelId];
        const isMember = !channel.private || channel.members.includes(state.currentUser.id);

        if (!isMember) return; // Don't render if user is not a member of a private channel

        const isActive = state.activeChat?.id === channelId && state.activeChat.type === 'channel';
        const unreadCount = unreadStatus[channelId] || 0;
        const lockIcon = channel.private ? '<i data-lucide="lock" class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500"></i>' : '';

        channelsList.innerHTML += `
            <div data-id="${channelId}" data-type="channel" class="channel-item flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}">
                <span class="mr-2 font-bold text-gray-500 dark:text-gray-400">#</span>
                <span class="font-medium flex-1 truncate">${channel.name}</span>
                ${lockIcon}
                ${unreadCount > 0 ? '<span class="ml-auto w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
            </div>
        `;
    });

    usersList.innerHTML = '';
    Object.keys(MOCK_USERS).forEach(userId => {
        if (userId === state.currentUser?.id) return; // Don't list myself
        const user = MOCK_USERS[userId];
        const isActive = state.activeChat?.id === userId && state.activeChat.type === 'user';
        const chatId = `user_${userId}`;
        const unreadCount = unreadStatus[chatId] || 0;
        usersList.innerHTML += `
             <div data-id="${userId}" data-type="user" class="user-item flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}">
                <div class="relative mr-3">
                    <div class="w-10 h-10 ${user.color} rounded-full flex items-center justify-center text-white font-semibold">
                        ${user.avatar}
                    </div>
                    <div class="w-3 h-3 ${user.online ? 'bg-green-400' : 'bg-gray-400'} border-2 border-white dark:border-gray-800 rounded-full absolute bottom-0 right-0"></div>
                </div>
                <div class="flex-1 flex items-center">
                    <span class="font-medium">${user.name}</span>
                    ${renderRoleIcon(user.role)}
                </div>
                ${unreadCount > 0 ? '<span class="ml-auto w-2 h-2 bg-blue-500 rounded-full"></span>' : ''}
            </div>
        `;
    });
}

function renderCurrentUser() {
    if (!state.currentUser) return;
    const user = state.currentUser.data;
    const canCreateChannel = user.role === 'Admin';
    createChannelBtn.style.display = canCreateChannel ? 'block' : 'none';

    currentUserAvatar.innerHTML = `
        <div data-user-id="${state.currentUser.id}" class="flex items-center space-x-2 cursor-pointer flex-1">
             <div class="w-8 h-8 ${user.color} rounded-full flex items-center justify-center text-white font-semibold">
                ${user.avatar}
            </div>
            <span class="font-semibold text-gray-800 dark:text-gray-200">${user.name}</span>
             ${renderRoleIcon(user.role)}
        </div>
    `;
}

// --- TYPING INDICATOR ---

function showTypingIndicator() {
    // In a real app, you'd get the user who is typing from an event.
    // Here, we'll simulate the other user in the DM is typing.
    if (!state.activeChat || state.activeChat.type === 'channel') {
        hideTypingIndicator(); // Don't show for channels or if no chat is active
        return;
    }
    
    const otherUser = MOCK_USERS[state.activeChat.id];
    if (!otherUser) return;

    typingIndicatorContainer.innerHTML = `
        <div class="flex items-end space-x-2 message-bubble">
            <div class="w-8 h-8 ${otherUser.color} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                ${otherUser.avatar}
            </div>
            <div class="bg-white dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 max-w-lg shadow-sm">
                <div class="typing-indicator flex items-center space-x-1">
                    <span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                    <span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                    <span class="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></span>
                </div>
            </div>
        </div>
    `;
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function hideTypingIndicator() {
    typingIndicatorContainer.innerHTML = '';
}


// --- LOGIC ---

function openSidebar() {
    sidebar.classList.remove('-translate-x-full');
    sidebarOverlay.classList.remove('hidden');
    sidebarOverlay.classList.add('md:hidden'); // Make sure it's only for mobile
}

function closeSidebar() {
    sidebar.classList.add('-translate-x-full');
    if (!pinnedMessagesSidebar.classList.contains('translate-x-full')) {
        // Pinned messages sidebar is open, don't hide overlay yet
    } else {
        sidebarOverlay.classList.add('hidden');
    }
}

function togglePinnedSidebar(show) {
    if (show) {
        pinnedMessagesSidebar.classList.remove('translate-x-full');
        sidebarOverlay.classList.remove('hidden');
        renderPinnedMessagesList();
    } else {
        pinnedMessagesSidebar.classList.add('translate-x-full');
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebarOverlay.classList.add('hidden');
        }
    }
}

function switchChat(id: string, type: 'channel' | 'user') {
    if (!id || !type) return;

    // Reset search when switching chats
    searchQuery = '';
    searchInput.value = '';
    chatHeader.classList.remove('hidden');
    searchInputContainer.classList.add('hidden');
    searchBtn.classList.remove('hidden');
    closeSearchBtn.classList.add('hidden');
    togglePinnedSidebar(false);
    cancelReply();

    // Reset typing indicator when switching chats
    if (typingTimer) clearTimeout(typingTimer);
    hideTypingIndicator();

    const chatId = type === 'user' ? `user_${id}` : id;
    if (unreadStatus[chatId]) {
        delete unreadStatus[chatId];
    }
    
    const name = type === 'channel' ? MOCK_CHANNELS[id].name : MOCK_USERS[id].name;
    state.activeChat = { id, name, type };
    renderAll();
}

async function translateText(text, sourceLang, targetLang) {
    if (!text || sourceLang === targetLang) {
        return null;
    }
    try {
        const prompt = `Translate the following text from ${SUPPORTED_LANGUAGES[sourceLang]} to ${SUPPORTED_LANGUAGES[targetLang]}. Only return the translated text, without any additional explanation or quotation marks: "${text}"`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error('Translation error:', error);
        return null; // Return null on error so the original text can be displayed
    }
}

function addSystemMessage(text, channelId) {
    if (!channelId) return;
    if (!MOCK_MESSAGES[channelId]) {
        MOCK_MESSAGES[channelId] = [];
    }
    const newMessage = {
        type: 'system',
        originalText: text,
        time: Date.now(),
    };
    MOCK_MESSAGES[channelId].push(newMessage);
    renderMessages();
}

function cancelReply() {
    replyingToMessage = null;
    renderReplyPreview();
}

function renderReplyPreview() {
    if (!replyingToMessage) {
        replyPreviewContainer.classList.add('hidden');
        replyPreviewContainer.innerHTML = '';
        return;
    }

    const author = MOCK_USERS[replyingToMessage.userId];
    const hasFiles = replyingToMessage.files && replyingToMessage.files.length > 0;
    const snippet = replyingToMessage.originalText
        ? (replyingToMessage.originalText.length > 80 ? replyingToMessage.originalText.substring(0, 80) + '…' : replyingToMessage.originalText)
        : (hasFiles ? `Tệp đính kèm (${replyingToMessage.files.length})` : '');

    const previewHTML = `
        <div class="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg border-l-4 border-blue-500">
            <div class="flex-1 text-sm min-w-0">
                <p class="font-medium text-gray-800 dark:text-gray-200">Đang trả lời <span class="font-bold">${author.name}</span></p>
                <p class="text-gray-500 dark:text-gray-400 truncate mt-0.5">${snippet}</p>
            </div>
            <button id="cancel-reply-btn" type="button" class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                 <i data-lucide="x" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i>
            </button>
        </div>
    `;

    replyPreviewContainer.innerHTML = previewHTML;
    replyPreviewContainer.classList.remove('hidden');
    lucide.createIcons();

    document.getElementById('cancel-reply-btn')!.addEventListener('click', cancelReply);
}

async function simulateAIResponse(chatId: string, otherUserId: string) {
    const lastMessage = MOCK_MESSAGES[chatId]?.[MOCK_MESSAGES[chatId].length - 1];
    if (!lastMessage || lastMessage.userId !== state.currentUser.id) {
        return; 
    }

    const typingDelay = Math.random() * 1000 + 500;
    await new Promise(resolve => setTimeout(resolve, typingDelay));

    if (state.activeChat?.id !== otherUserId || state.activeChat?.type !== 'user') {
        return;
    }
    showTypingIndicator();

    try {
        const otherUser = MOCK_USERS[otherUserId];
        const currentUser = state.currentUser.data;
        const history = MOCK_MESSAGES[chatId].slice(-10);

        const conversationHistory = history.map(msg => {
            const author = MOCK_USERS[msg.userId];
            const hasFiles = msg.files && msg.files.length > 0;
            const content = msg.originalText ? msg.originalText : (hasFiles ? `(đã gửi ${msg.files.length} tệp)` : '(tin nhắn trống)');
            return `${author.name}: ${content}`;
        }).join('\n');
        
        let personaDescription = `You are acting as a person in a chat application. Your persona is:
- Name: ${otherUser.name}
- Role: ${otherUser.role}
- Age: ${otherUser.age}
- Gender: ${otherUser.gender}
- From: ${otherUser.country}
- Native Language: ${otherUser.language === 'vi' ? 'Vietnamese' : 'English'}`;

        // Add role-based personality traits
        switch (otherUser.role) {
            case 'Admin':
                personaDescription += '\n- Personality: You are professional, helpful, and a bit formal.';
                break;
            case 'Mod':
                personaDescription += '\n- Personality: You are fair, direct, and responsible.';
                break;
            case 'Member':
            default:
                personaDescription += '\n- Personality: You are casual, friendly, and relaxed.';
                break;
        }

        const prompt = `${personaDescription}

You are chatting with ${currentUser.name}.

This is the recent conversation history:
${conversationHistory}

Based on your persona and the conversation, write a short, natural, and believable reply to the last message from ${currentUser.name}.
- Keep your response concise and conversational, like a real text message.
- Respond in ${otherUser.language === 'vi' ? 'Vietnamese' : 'English'}.
- DO NOT add your name or any prefix like "${otherUser.name}:". Just provide the message content.
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const aiText = response.text.trim().replace(/^"|"$/g, '');

        if (state.activeChat?.id === otherUserId && state.activeChat?.type === 'user') {
            const aiMessage = {
                type: 'user' as const,
                userId: otherUserId,
                originalText: aiText,
                time: Date.now(),
                pinned: false,
                files: [],
                replyTo: null,
                translations: {},
            };
            MOCK_MESSAGES[chatId].push(aiMessage);
            hideTypingIndicator();
            renderMessages();
        } else {
            hideTypingIndicator();
        }

    } catch (error) {
        console.error("Error generating AI response:", error);
        if (state.activeChat?.id === otherUserId && state.activeChat?.type === 'user') {
            hideTypingIndicator();
        }
    }
}

async function getAIAssistantResponse(chatId: string, userMessage: any) {
    showTypingIndicator();

    try {
        let aiText = 'Xin lỗi, tôi không thể xử lý yêu cầu này.';
        let aiFiles = [];
        const userHasFiles = userMessage.files && userMessage.files.length > 0;
        const userText = userMessage.originalText || '';

        // Flow 1: Text-to-Image Generation (no input files, text contains keywords)
        const isImageCreationRequest = !userHasFiles && userText &&
            /\b(vẽ|tạo|generate|create|draw|imagine|picture of|photo of)\b/i.test(userText);

        if (isImageCreationRequest) {
            aiText = "Đang tạo ảnh cho bạn...";
            renderMessages(); // Show "generating" message immediately
            
            const imageGenPrompt = `Create a high-quality, photorealistic image based on the following description: ${userText.replace(/\b(vẽ|tạo|generate|create|draw|imagine|picture of|photo of)\b/i, '').trim()}`;

            const imageResponse = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: imageGenPrompt,
                config: { numberOfImages: 1, outputMimeType: 'image/png' },
            });
            
            const base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
            const newDataUrl = `data:image/png;base64,${base64ImageBytes}`;
            aiFiles.push({
                name: `generated-image-${Date.now()}.png`,
                size: 0,
                type: 'image/png',
                dataUrl: newDataUrl
            });
            aiText = "Đây là hình ảnh tôi đã tạo cho bạn!";
        
        } 
        // Flow 2: Image Editing / Multi-Image Interaction (has input files)
        else if (userHasFiles) {
            const parts = [];
            for (const file of userMessage.files) {
                if (file.type.startsWith('image/')) {
                    parts.push({ inlineData: { data: file.dataUrl.split(',')[1], mimeType: file.type } });
                }
            }
             const instruction = `You are an expert AI image editor. Your primary function is to generate a new image based on the user's request and the provided image(s).
- **You MUST generate a new, single image as the output that fulfills the user's request.** For example, if the user asks to combine two images, or edit one image, your main output must be the resulting edited/combined image.
- Accompany the generated image with a brief, helpful text description in Vietnamese.
- User's request: "${userText}"`;
            parts.push({ text: instruction });

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
            });

            let imageGenerated = false;
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    aiText = part.text;
                } else if (part.inlineData) {
                    const newMimeType = part.inlineData.mimeType || 'image/png';
                    const newDataUrl = `data:${newMimeType};base64,${part.inlineData.data}`;
                    aiFiles.push({
                        name: `generated-image-${Date.now()}.png`,
                        size: 0,
                        type: newMimeType,
                        dataUrl: newDataUrl
                    });
                    imageGenerated = true;
                }
            }
            // If the model failed to generate an image despite instructions, provide a clearer message.
            if (!imageGenerated) {
                aiText = "Xin lỗi, tôi không thể tạo ra hình ảnh từ yêu cầu của bạn. Có thể yêu cầu của bạn quá phức tạp hoặc vi phạm chính sách an toàn. Bạn có thể thử lại với một yêu cầu khác được không?";
            }
        
        } 
        // Flow 3: Text-only
        else {
            const history = MOCK_MESSAGES[chatId].slice(-10);
            const conversationHistory = history.map(msg => {
                const authorName = (msg.userId === 'ai_assistant') ? 'Trợ lý AI' : MOCK_USERS[msg.userId].name;
                const role = (msg.userId === 'ai_assistant') ? 'model' : 'user';
                 const content = msg.originalText || `(đã gửi ${msg.files.length} tệp)`;
                return { role, parts: [{ text: `${authorName}: ${content}` }] };
            }).map(item => item.parts[0].text).join('\n');

            const prompt = `Bạn là một trợ lý AI toàn năng và hữu ích có tên "Trợ lý Ai".
Đây là lịch sử cuộc trò chuyện gần đây:
${conversationHistory}

Hãy trả lời tin nhắn cuối cùng một cách toàn diện. Phản hồi bằng tiếng Việt.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            aiText = response.text.trim();
        }

        const aiMessage = {
            type: 'user' as const,
            userId: 'ai_assistant',
            originalText: aiText,
            time: Date.now(),
            pinned: false,
            files: aiFiles,
            replyTo: null,
            translations: {},
        };
        MOCK_MESSAGES[chatId].push(aiMessage);

    } catch (error) {
        console.error("Error generating AI Assistant response:", error);
        const errorMessage = {
            type: 'user' as const,
            userId: 'ai_assistant',
            originalText: `Đã xảy ra lỗi khi xử lý yêu cầu của bạn. Chi tiết: ${error.message || 'Không có thông tin chi tiết.'}. Vui lòng thử lại.`,
            time: Date.now(),
            pinned: false, files: [], replyTo: null, translations: {}
        };
        MOCK_MESSAGES[chatId].push(errorMessage);
    } finally {
        hideTypingIndicator();
        renderMessages();
    }
}


async function sendMessage() {
    if (typingTimer) clearTimeout(typingTimer);
    hideTypingIndicator();

    if (checkBanStatus()) return;

    const originalText = messageInput.value.trim();
    if ((originalText || pendingFiles.length > 0) && state.currentUser && state.activeChat) {
        const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
        
        if (!MOCK_MESSAGES[chatId]) {
            MOCK_MESSAGES[chatId] = [];
        }

        const newMessage = {
            type: 'user' as const,
            userId: state.currentUser.id,
            originalText: originalText,
            time: Date.now(),
            pinned: false,
            files: pendingFiles.map(pf => ({
                name: pf.file.name,
                size: pf.file.size,
                type: pf.file.type,
                dataUrl: pf.dataUrl
            })),
            replyTo: replyingToMessage ? replyingToMessage.time : null,
            translations: {},
        };

        MOCK_MESSAGES[chatId].push(newMessage);

        const shouldSimulateReply = state.activeChat.type === 'user' && state.activeChat.id !== 'ai_assistant';
        const isAIAssistantChat = state.activeChat.type === 'user' && state.activeChat.id === 'ai_assistant';
        const activeChatIdForSimulation = state.activeChat.id;

        messageInput.value = '';
        messageInput.style.height = 'auto';
        removeAllPendingFiles();
        cancelReply();
        renderMessages();

        if (shouldSimulateReply) {
            simulateAIResponse(chatId, activeChatIdForSimulation);
        } else if (isAIAssistantChat) {
            getAIAssistantResponse(chatId, newMessage);
        }
    }
}

function login(email: string) {
    let userId = '2'; // Default user
    if (email === 'Duongtiendung121277@gmail.com') {
        userId = '1'; // Admin user
    }
    
    state.currentUser = { id: userId, data: MOCK_USERS[userId] };
    
    loginScreen.classList.add('hidden');
    appScreen.classList.add('flex');
    appScreen.classList.remove('hidden');

    // Set default chat and render
    switchChat('general', 'channel');
    checkBanStatus();
}

function logout() {
    state.currentUser = null;
    state.activeChat = null;
    
    appScreen.classList.add('hidden');
    appScreen.classList.remove('flex');
    loginScreen.classList.remove('hidden');
    emailInput.value = '';
    (document.getElementById('password') as HTMLInputElement).value = '';
}

function renderAll() {
    if (!state.currentUser) return;
    renderCurrentUser();
    renderSidebarLists();
    renderChatHeader();
    renderMessages();
    checkBanStatus();
    updatePinnedBtnVisibility();
    lucide.createIcons();
}

// --- PINNED MESSAGES ---
function renderPinnedMessagesList() {
    if (!state.activeChat) return;
    const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
    const messages = MOCK_MESSAGES[chatId] || [];
    const pinned = messages.filter(msg => msg.pinned).sort((a, b) => a.time - b.time);

    if (pinned.length === 0) {
        pinnedMessagesList.innerHTML = `<div class="text-center p-4 text-sm text-gray-500 dark:text-gray-400">Chưa có tin nhắn nào được ghim.</div>`;
        return;
    }

    pinnedMessagesList.innerHTML = pinned.map(msg => {
        const author = MOCK_USERS[msg.userId];
        const hasFiles = msg.files && msg.files.length > 0;
        const snippet = msg.originalText 
            ? (msg.originalText.length > 80 ? msg.originalText.substring(0, 80) + '...' : msg.originalText) 
            : `Tệp đính kèm (${hasFiles ? msg.files.length : 0})`;
        return `
            <div class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 ${author.color} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        ${author.avatar}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <span class="font-semibold text-sm text-gray-800 dark:text-gray-200">${author.name}</span>
                            <button class="unpin-from-sidebar-btn p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400" data-message-time="${msg.time}" title="Bỏ ghim">
                                <i data-lucide="x" class="w-4 h-4"></i>
                            </button>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5 cursor-pointer jump-to-message" data-message-time="${msg.time}">
                            ${highlightSearchTerm(snippet, '')}
                        </p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

function togglePinMessage(messageTime) {
    if (!state.activeChat) return;
    const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
    const message = MOCK_MESSAGES[chatId]?.find(m => m.time == messageTime);

    if (message) {
        message.pinned = !message.pinned;
        const actionText = message.pinned ? "đã ghim một tin nhắn" : "đã bỏ ghim một tin nhắn";
        addSystemMessage(`${state.currentUser.data.name} ${actionText}.`, chatId);
        renderAll();
        if(!pinnedMessagesSidebar.classList.contains('translate-x-full')) {
            renderPinnedMessagesList();
        }
    }
}


// --- CHANNEL MANAGEMENT ---
function showCreateChannelModal() {
    if (state.currentUser?.data.role !== 'Admin') return;

    const usersOptions = Object.entries(MOCK_USERS)
        .filter(([id]) => id !== state.currentUser.id)
        .map(([id, user]) => `
            <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <input type="checkbox" name="members" value="${id}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                <div class="w-8 h-8 ${user.color} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">${user.avatar}</div>
                <span class="text-gray-800 dark:text-gray-200">${user.name}</span>
            </label>
        `).join('');

    const title = 'Tạo kênh mới';
    const body = `
        <form id="create-channel-form">
            <div class="space-y-4">
                <div>
                    <label for="channel-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên kênh</label>
                    <input type="text" id="channel-name" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                </div>
                <div class="flex items-center">
                    <input id="channel-private" name="private" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                    <label for="channel-private" class="ml-2 block text-sm text-gray-900 dark:text-gray-300">Kênh riêng tư</label>
                </div>
                <div id="members-list-container" class="hidden">
                     <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mời thành viên</label>
                     <div class="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
                        ${usersOptions}
                     </div>
                </div>
            </div>
            <button type="submit" class="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors font-medium">
                Tạo kênh
            </button>
        </form>
    `;
    openModal(title, body);

    document.getElementById('channel-private').addEventListener('change', (e) => {
        document.getElementById('members-list-container').classList.toggle('hidden', !e.target.checked);
    });
}

function createChannel(name, isPrivate, memberIds) {
    const newChannelId = `channel_${Date.now()}`;
    const allMembers = isPrivate ? [state.currentUser.id, ...memberIds] : [];
    
    MOCK_CHANNELS[newChannelId] = {
        name: name,
        type: 'channel',
        private: isPrivate,
        members: [...new Set(allMembers)], // Ensure unique members
        creatorId: state.currentUser.id
    };

    MOCK_MESSAGES[newChannelId] = [];
    const invitedUsers = memberIds.map(id => MOCK_USERS[id].name).join(', ');
    const systemMsg = isPrivate 
        ? `${state.currentUser.data.name} đã tạo kênh riêng tư và mời: ${invitedUsers}`
        : `${state.currentUser.data.name} đã tạo kênh #${name}`;
    addSystemMessage(systemMsg, newChannelId);

    closeModal();
    renderSidebarLists();
    switchChat(newChannelId, 'channel');
}

function showEditChannelModal(channelId) {
    const channel = MOCK_CHANNELS[channelId];
    const title = `Đổi tên kênh #${channel.name}`;
    const body = `
        <form id="edit-channel-form" data-channel-id="${channelId}">
            <input type="text" id="edit-channel-name" value="${channel.name}" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" required>
            <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 font-medium">Lưu thay đổi</button>
        </form>
    `;
    openModal(title, body);
}

function updateChannelName(channelId, newName) {
    const oldName = MOCK_CHANNELS[channelId].name;
    MOCK_CHANNELS[channelId].name = newName;
    
    addSystemMessage(`${state.currentUser.data.name} đã đổi tên kênh từ #${oldName} thành #${newName}`, channelId);
    
    if (state.activeChat?.id === channelId) {
        state.activeChat.name = newName;
    }
    
    closeModal();
    renderAll();
}

function showDeleteChannelConfirmation(channelId) {
    const channel = MOCK_CHANNELS[channelId];
    const title = `Xóa kênh #${channel.name}`;
    const body = `
        <p class="mb-6 text-gray-700 dark:text-gray-300">Bạn có chắc chắn muốn xóa kênh này không? Tất cả tin nhắn sẽ bị xóa vĩnh viễn.</p>
        <div class="flex justify-end space-x-2">
            <button id="cancel-delete-btn" class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-medium">Hủy</button>
            <button id="confirm-delete-channel-btn" data-channel-id="${channelId}" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-500 font-medium">Xóa</button>
        </div>
    `;
    openModal(title, body);
}

function deleteChannel(channelId) {
    if (channelId === 'general') return;

    if (state.activeChat?.id === channelId) {
        switchChat('general', 'channel');
    }
    
    delete MOCK_CHANNELS[channelId];
    delete MOCK_MESSAGES[channelId];

    closeModal();
    renderSidebarLists();
}

// --- CHAT ACTIONS ---

function showClearChatConfirmation() {
    if (!state.activeChat) return;

    const title = `Xóa cuộc trò chuyện`;
    const body = `
        <p class="mb-6 text-gray-700 dark:text-gray-300">Bạn có chắc chắn muốn xóa tất cả tin nhắn trong cuộc trò chuyện này không? Hành động này không thể hoàn tác.</p>
        <div class="flex justify-end space-x-2">
            <button id="cancel-clear-btn" class="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-medium">Hủy</button>
            <button id="confirm-clear-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-500 font-medium">Xóa</button>
        </div>
    `;
    openModal(title, body);
}

function clearCurrentChat() {
    if (!state.activeChat) return;

    const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
    if (MOCK_MESSAGES[chatId]) {
        MOCK_MESSAGES[chatId] = [];
    }
    
    closeModal();
    renderMessages();
}

// --- VIDEO CALL ---
async function startCall() {
    if (!state.activeChat || state.activeChat.type !== 'user') return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        callState.status = 'in-call';
        callState.stream = stream;
        
        videoCallScreen.classList.remove('hidden');
        lucide.createIcons();
        
        localVideo.srcObject = stream;

        // Wait for the video metadata to load to prevent capturing a 0x0 frame
        localVideo.onloadedmetadata = () => {
            // Ensure the call is still active and the loop hasn't started
            if (callState.status === 'in-call' && !callUpdateInterval) {
                callState.startTime = Date.now();
                const remoteUser = MOCK_USERS[state.activeChat.id];
                callInfo.textContent = `Cuộc gọi với ${remoteUser.name}`;
                addSystemMessage(`Bắt đầu cuộc gọi video...`, `user_${state.activeChat.id}`);
                
                // Start the AI interaction loop
                updateRemoteImage(); // Initial call
                callUpdateInterval = setInterval(updateRemoteImage, 5000);
            }
        };

    } catch (err) {
        console.error("Lỗi truy cập camera/mic:", err);
        alert("Không thể bắt đầu cuộc gọi. Vui lòng cấp quyền truy cập camera và microphone.");
    }
}

async function updateRemoteImage() {
    // A robust guard clause to prevent capturing an invalid frame.
    if (callState.status !== 'in-call' || !localVideo.srcObject || localVideo.videoWidth === 0 || localVideo.videoHeight === 0) {
        return;
    }

    remoteImageLoader.classList.remove('hidden');

    // 1. Capture frame from local video
    const canvas = document.createElement('canvas');
    canvas.width = localVideo.videoWidth;
    canvas.height = localVideo.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
    const base64ImageData = canvas.toDataURL('image/jpeg').split(',')[1];
    
    const remoteUser = MOCK_USERS[state.activeChat.id];

    // 2. Call Gemini API
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: 'image/jpeg',
                        },
                    },
                    {
                        text: `You are in a video call. Your persona is ${remoteUser.name}, a ${remoteUser.age}-year-old ${remoteUser.gender} from ${remoteUser.country}. This is an image of the person you're talking to. Generate a new image showing your facial reaction to them. For example, if they are smiling, you could be smiling back. Keep the background simple.`,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        // 3. Display the generated image
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                remoteImage.src = `data:image/jpeg;base64,${part.inlineData.data}`;
                break; // Use the first image found
            }
        }
    } catch (error) {
        console.error("Lỗi tạo ảnh AI:", error);
        // Optional: show an error image or message on the remote screen
    } finally {
        remoteImageLoader.classList.add('hidden');
    }
}

function endCall() {
    if (callUpdateInterval) {
        clearInterval(callUpdateInterval);
        callUpdateInterval = null;
    }
    if (callState.stream) {
        callState.stream.getTracks().forEach(track => track.stop());
    }

    if (callState.startTime) {
        const durationMs = Date.now() - callState.startTime;
        const durationMinutes = Math.floor(durationMs / 60000);
        const durationSeconds = Math.floor((durationMs % 60000) / 1000);
        addSystemMessage(`Cuộc gọi đã kết thúc. Thời lượng: ${durationMinutes}m ${durationSeconds}s`, `user_${state.activeChat.id}`);
    }

    callState = { status: 'idle', stream: null, startTime: null };

    videoCallScreen.classList.add('hidden');
    localVideo.srcObject = null;
    localVideo.onloadedmetadata = null; // Clean up the event handler
    remoteImage.src = '';
    
    // Reset button states
    toggleMicBtn.innerHTML = '<i data-lucide="mic" class="w-6 h-6"></i>';
    toggleCameraBtn.innerHTML = '<i data-lucide="video" class="w-6 h-6"></i>';
    lucide.createIcons();
}

function toggleMic() {
    if (!callState.stream) return;
    const audioTrack = callState.stream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        toggleMicBtn.innerHTML = audioTrack.enabled
            ? '<i data-lucide="mic" class="w-6 h-6"></i>'
            : '<i data-lucide="mic-off" class="w-6 h-6"></i>';
        lucide.createIcons();
    }
}

function toggleCamera() {
    if (!callState.stream) return;
    const videoTrack = callState.stream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        toggleCameraBtn.innerHTML = videoTrack.enabled
            ? '<i data-lucide="video" class="w-6 h-6"></i>'
            : '<i data-lucide="video-off" class="w-6 h-6"></i>';
        lucide.createIcons();
    }
}

// --- PERMISSIONS & ACTIONS ---

function promoteUser(userId) {
    MOCK_USERS[userId].role = 'Mod';
    closeContextMenu();
    renderAll();
}

function demoteUser(userId) {
    MOCK_USERS[userId].role = 'Member';
    closeContextMenu();
    renderAll();
}

function banUser(userId, minutes) {
    const user = MOCK_USERS[userId];
    user.banned.status = true;
    if (minutes === 'permanent' || minutes === null || minutes === undefined) {
        user.banned.until = 'permanent';
    } else {
        user.banned.until = Date.now() + minutes * 60 * 1000;
    }
    closeModal();
    renderAll();
}

function unbanUser(userId) {
    MOCK_USERS[userId].banned = { status: false, until: null };
    closeContextMenu();
    renderAll();
}

function updateProfile(userId, newName, newAvatar, newColor, newAge, newGender, newCountry) {
    const user = MOCK_USERS[userId];
    user.name = newName;
    user.avatar = newAvatar;
    user.color = newColor;
    user.age = newAge;
    user.gender = newGender;
    user.country = newCountry;
    if(state.currentUser.id === userId) {
        state.currentUser.data = user;
    }
    closeModal();
    renderAll();
}

function checkBanStatus() {
    const user = state.currentUser?.data;
    if (!user) return false;

    if (user.banned.status) {
        if (user.banned.until === 'permanent') {
            bannedMessage.textContent = 'Bạn đã bị cấm trò chuyện vĩnh viễn.';
            bannedOverlay.classList.remove('hidden');
            messageInput.disabled = true;
            return true;
        }
        if (user.banned.until > Date.now()) {
            const timeLeft = Math.ceil((user.banned.until - Date.now()) / 60000);
            bannedMessage.textContent = `Bạn đã bị cấm trò chuyện. Còn lại: ${timeLeft} phút.`;
            bannedOverlay.classList.remove('hidden');
            messageInput.disabled = true;
            return true;
        } else {
            // Ban expired
            user.banned = { status: false, until: null };
        }
    }
    
    bannedOverlay.classList.add('hidden');
    messageInput.disabled = false;
    return false;
}

// --- CONTEXT MENU ---
function openContextMenu(e, targetElement) {
    e.preventDefault();
    const currentUser = state.currentUser.data;
    
    let menuItems = '';
    
    const channelItem = targetElement.closest('.channel-item');
    const userItem = targetElement.closest('[data-user-id]');
    const messageBubble = targetElement.closest('.message-bubble');

    if (channelItem) {
        const channelId = channelItem.dataset.id;
        if (currentUser.role === 'Admin') {
            menuItems += `<li class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center" data-action="edit-channel" data-channel-id="${channelId}"><i data-lucide="edit-3" class="w-4 h-4 mr-2"></i>Đổi tên kênh</li>`;
            if (channelId !== 'general') {
                 menuItems += `<li class="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center" data-action="delete-channel" data-channel-id="${channelId}"><i data-lucide="trash-2" class="w-4 h-4 mr-2"></i>Xóa kênh</li>`;
            }
        }
    } else if (userItem) {
        const userId = userItem.dataset.userId;
        const targetUser = MOCK_USERS[userId];

        // Option for self
        if (userId === state.currentUser.id) {
            menuItems += `<li class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" data-action="edit-profile" data-user-id="${userId}">Chỉnh sửa hồ sơ</li>`;
        }

        // Admin powers
        if (currentUser.role === 'Admin' && userId !== 'ai_assistant') {
            if (targetUser.role === 'Member') {
                menuItems += `<li class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" data-action="promote" data-user-id="${userId}">Cấp Mod</li>`;
            }
            if (targetUser.role === 'Mod') {
                menuItems += `<li class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" data-action="demote" data-user-id="${userId}">Hủy Mod</li>`;
            }
        }
        
        // Admin and Mod powers
        if ((currentUser.role === 'Admin' || currentUser.role === 'Mod') && targetUser.role === 'Member' && currentUser.id !== userId && userId !== 'ai_assistant') {
             if (targetUser.banned.status) {
                menuItems += `<li class="px-4 py-2 text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" data-action="unban" data-user-id="${userId}">Bỏ cấm</li>`;
            } else {
                menuItems += `<li class="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer" data-action="ban" data-user-id="${userId}">Cấm thành viên</li>`;
            }
        }
    } else if (messageBubble) {
        const messageTime = messageBubble.dataset.messageTime;
        const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
        const message = MOCK_MESSAGES[chatId]?.find(m => m.time == messageTime);
        if (message) {
            const canPin = currentUser.role === 'Admin' || currentUser.role === 'Mod' || state.activeChat.type === 'user';
            if (canPin) {
                if (message.pinned) {
                    menuItems += `<li class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center" data-action="pin-message" data-message-time="${messageTime}"><i data-lucide="pin-off" class="w-4 h-4 mr-2"></i>Bỏ ghim tin nhắn</li>`;
                } else {
                    menuItems += `<li class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer flex items-center" data-action="pin-message" data-message-time="${messageTime}"><i data-lucide="pin" class="w-4 h-4 mr-2"></i>Ghim tin nhắn</li>`;
                }
            }
        }
    }

    if (!menuItems) return; // No actions available

    contextMenu.innerHTML = menuItems;
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.classList.remove('hidden');
    lucide.createIcons();
}

function closeContextMenu() {
    contextMenu.classList.add('hidden');
}

// --- MODAL ---
function openModal(title, body) {
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalOverlay.classList.remove('hidden');
    lucide.createIcons();
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    modalBody.innerHTML = '';
}

function showBanModal(userId) {
    const user = MOCK_USERS[userId];
    const title = `Cấm thành viên: ${user.name}`;
    const body = `
        <form id="ban-form" data-user-id="${userId}">
            <p class="mb-4 text-gray-700 dark:text-gray-300">Nhập thời gian cấm (phút). Để trống nếu muốn cấm vĩnh viễn.</p>
            <input type="number" id="ban-duration" min="1" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ví dụ: 60">
            <button type="submit" class="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 dark:hover:bg-red-500 transition-colors font-medium">
                Xác nhận cấm
            </button>
        </form>
    `;
    openModal(title, body);
}

function showProfileModal(userId) {
    const user = MOCK_USERS[userId];
    const title = 'Chỉnh sửa hồ sơ';
    const colors = ['bg-red-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-blue-500', 'bg-pink-500', 'bg-indigo-500', 'bg-gray-500'];
    const body = `
        <form id="profile-form" data-user-id="${userId}">
            <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên hiển thị (Nickname)</label>
                    <input type="text" id="profile-name" value="${user.name}" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Avatar (Ký tự)</label>
                    <input type="text" id="profile-avatar" value="${user.avatar}" maxlength="2" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tuổi</label>
                    <input type="number" id="profile-age" value="${user.age || ''}" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                 <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Giới tính</label>
                    <select id="profile-gender" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="Nam" ${user.gender === 'Nam' ? 'selected' : ''}>Nam</option>
                        <option value="Nữ" ${user.gender === 'Nữ' ? 'selected' : ''}>Nữ</option>
                        <option value="Khác" ${user.gender === 'Khác' ? 'selected' : ''}>Khác</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quốc gia</label>
                    <input type="text" id="profile-country" value="${user.country || ''}" class="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            </div>

            <div class="mt-4 mb-6">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Màu Avatar</label>
                <div id="avatar-colors" class="flex flex-wrap gap-2">
                    ${colors.map(c => `<div class="w-8 h-8 rounded-full cursor-pointer ${c} ${c === user.color ? 'ring-2 ring-offset-2 dark:ring-offset-gray-800 ring-blue-500' : ''}" data-color="${c}"></div>`).join('')}
                </div>
                <input type="hidden" id="profile-color" value="${user.color}">
            </div>
            <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors font-medium">
                Lưu thay đổi
            </button>
        </form>
    `;
    openModal(title, body);

    document.getElementById('avatar-colors').addEventListener('click', e => {
        if(e.target.dataset.color) {
            document.querySelectorAll('#avatar-colors > div').forEach(el => el.classList.remove('ring-2', 'ring-offset-2', 'dark:ring-offset-gray-800', 'ring-blue-500'));
            e.target.classList.add('ring-2', 'ring-offset-2', 'dark:ring-offset-gray-800', 'ring-blue-500');
            document.getElementById('profile-color').value = e.target.dataset.color;
        }
    });
}


// --- THEME ---

function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
        localStorage.setItem('theme', 'light');
    }
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (systemPrefersDark) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }
}

// --- VOICE INPUT ---

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error("Trình duyệt không hỗ trợ nhận dạng giọng nói.");
        micBtn.disabled = true;
        micBtn.title = "Trình duyệt không hỗ trợ";
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'vi-VN';

    recognition.onstart = () => {
        isListening = true;
        voiceStatus.classList.remove('hidden');
        voiceStatus.classList.add('flex');
        voiceStatusText.textContent = 'Đang nghe...';
        micBtn.classList.add('bg-blue-100', 'dark:bg-blue-900/50');
        micBtn.innerHTML = `<i data-lucide="mic-off" class="w-5 h-5 text-blue-600 dark:text-blue-300"></i>`;
        lucide.createIcons();
    };

    recognition.onend = () => {
        isListening = false;
        voiceStatus.classList.add('hidden');
        voiceStatus.classList.remove('flex');
        micBtn.classList.remove('bg-blue-100', 'dark:bg-blue-900/50');
        micBtn.innerHTML = `<i data-lucide="mic" class="w-5 h-5 text-gray-500 dark:text-gray-400"></i>`;
        lucide.createIcons();
    };

    recognition.onerror = (event) => {
        console.error('Lỗi nhận dạng giọng nói:', event.error);
        let errorMsg = 'Lỗi! Thử lại sau.';
        if (event.error === 'not-allowed') {
            errorMsg = 'Quyền truy cập micro đã bị từ chối.';
        } else if (event.error === 'no-speech') {
            errorMsg = 'Không phát hiện thấy giọng nói.';
        }
        voiceStatusText.textContent = errorMsg;
        setTimeout(() => {
            if (!isListening) {
                 voiceStatus.classList.add('hidden');
            }
        }, 2500);
    };

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        
        const separator = initialText.length > 0 && initialText.slice(-1) !== ' ' ? ' ' : '';
        messageInput.value = initialText + separator + transcript;
        messageInput.dispatchEvent(new Event('input', { bubbles: true }));
    };
}

function toggleListening() {
    if (!recognition) return;

    if (isListening) {
        recognition.stop();
    } else {
        initialText = messageInput.value;
        recognition.start();
    }
}

// --- EMOJI PICKER ---

function renderEmojiPicker() {
    emojiPicker.innerHTML = EMOJI_LIST.map(emoji => 
        `<button class="emoji-item p-1 text-2xl rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">${emoji}</button>`
    ).join('');
}

function insertTextAtCursor(textToInsert) {
    const input = messageInput;
    const startPos = input.selectionStart;
    const endPos = input.selectionEnd;
    
    input.value = input.value.substring(0, startPos) + textToInsert + input.value.substring(endPos, input.value.length);
    
    const newPos = startPos + textToInsert.length;
    input.selectionStart = newPos;
    input.selectionEnd = newPos;
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true })); // Trigger auto-resize and typing indicator
}

// --- FILE HANDLING ---

async function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const filePromises = Array.from(input.files).map(file => {
        return new Promise<{ file: File, dataUrl: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve({ file, dataUrl: event.target!.result as string });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    });

    try {
        const newFiles = await Promise.all(filePromises);
        pendingFiles.push(...newFiles); // Append new files
        renderFilePreview();
    } catch (error) {
        console.error("Error reading files:", error);
    }
    
    input.value = ''; // Reset input to allow selecting the same file again
}

function renderFilePreview() {
    if (pendingFiles.length === 0) {
        filePreviewContainer.classList.add('hidden');
        filePreviewContainer.innerHTML = '';
        return;
    }
    
    filePreviewContainer.innerHTML = pendingFiles.map((item, index) => {
        const { file, dataUrl } = item;
        let previewHTML = '';
        const fileSize = (file.size / 1024).toFixed(1) + ' KB';

        if (file.type.startsWith('image/')) {
            previewHTML = `
                <div class="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                    <img src="${dataUrl}" alt="Preview" class="w-12 h-12 rounded-lg object-cover">
                    <div class="flex-1 text-sm min-w-0">
                        <p class="font-medium text-gray-800 dark:text-gray-200 truncate">${file.name}</p>
                        <p class="text-gray-500 dark:text-gray-400">${fileSize}</p>
                    </div>
                    <button data-index="${index}" type="button" class="remove-file-btn p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                         <i data-lucide="x" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i>
                    </button>
                </div>
            `;
        } else {
            previewHTML = `
                 <div class="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700/50 p-2 rounded-lg">
                    <div class="w-12 h-12 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                        <i data-lucide="file-text" class="w-6 h-6 text-gray-500 dark:text-gray-400"></i>
                    </div>
                    <div class="flex-1 text-sm min-w-0">
                        <p class="font-medium text-gray-800 dark:text-gray-200 truncate">${file.name}</p>
                        <p class="text-gray-500 dark:text-gray-400">${fileSize}</p>
                    </div>
                    <button data-index="${index}" type="button" class="remove-file-btn p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                         <i data-lucide="x" class="w-4 h-4 text-gray-600 dark:text-gray-300"></i>
                    </button>
                </div>
            `;
        }
        return previewHTML;
    }).join('');

    filePreviewContainer.classList.remove('hidden');
    lucide.createIcons();

    document.querySelectorAll('.remove-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const indexToRemove = parseInt(e.currentTarget.dataset.index);
            removePendingFile(indexToRemove);
        });
    });
}

function removePendingFile(index: number) {
    if (index > -1 && index < pendingFiles.length) {
        pendingFiles.splice(index, 1);
    }
    renderFilePreview();
}

function removeAllPendingFiles() {
    pendingFiles = [];
    fileInput.value = '';
    renderFilePreview();
}

// --- EVENT LISTENERS ---

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    login(emailInput.value);
});

logoutBtn.addEventListener('click', logout);


messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';

    if (typingTimer) clearTimeout(typingTimer);
    
    if (this.value.trim() !== '' && !checkBanStatus()) {
        // Typing indicator is now handled by the live simulation, so we disable the user-triggered one.
        // showTypingIndicator();
        // typingTimer = setTimeout(() => {
        //     hideTypingIndicator();
        //     typingTimer = null;
        // }, 2500);
    } else {
        hideTypingIndicator();
    }
});

messagesArea.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const replyBtn = target.closest('.reply-btn');
    const jumpTarget = target.closest('.jump-to-message');

    if (replyBtn) {
        const messageTime = replyBtn.dataset.messageTime;
        const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
        const messageToReply = MOCK_MESSAGES[chatId]?.find(m => m.time == messageTime);
        if (messageToReply) {
            replyingToMessage = messageToReply;
            renderReplyPreview();
            messageInput.focus();
        }
        return; // prevent other handlers
    }

    if (jumpTarget) {
        const messageTime = jumpTarget.dataset.messageTime;
        const messageEl = messagesArea.querySelector(`[data-message-time="${messageTime}"]`);
        if (messageEl) {
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageEl.classList.add('message-highlight');
            setTimeout(() => {
                messageEl.classList.remove('message-highlight');
            }, 2000);
        }
    }
});

document.body.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const channelItem = target.closest('.channel-item');
    const userItem = target.closest('.user-item');
    const currentUserAvatarContainer = target.closest('#current-user-avatar [data-user-id]');

    closeContextMenu();

    // Handle profile modal opening by clicking own avatar in sidebar
    if (currentUserAvatarContainer && currentUserAvatarContainer.dataset.userId === state.currentUser.id) {
        showProfileModal(state.currentUser.id);
        return;
    }

    if (channelItem) {
        switchChat(channelItem.getAttribute('data-id')!, 'channel');
        if (window.innerWidth < 768) closeSidebar();
    } else if (userItem) {
        switchChat(userItem.getAttribute('data-id')!, 'user');
        if (window.innerWidth < 768) closeSidebar();
    }
    
    if (!emojiPicker.contains(target) && !emojiBtn.contains(target)) {
        emojiPicker.classList.add('hidden');
    }
});

document.body.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.channel-item, [data-user-id], .message-bubble');
    
    if (item) {
        openContextMenu(e, item);
    }
});

menuToggleBtn.addEventListener('click', openSidebar);
sidebarCloseBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', () => {
    closeSidebar();
    togglePinnedSidebar(false);
});
micBtn.addEventListener('click', toggleListening);
themeToggleBtn.addEventListener('click', toggleTheme);
attachBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
clearChatBtn.addEventListener('click', showClearChatConfirmation);
videoCallBtn.addEventListener('click', startCall);
endCallBtn.addEventListener('click', endCall);
toggleMicBtn.addEventListener('click', toggleMic);
toggleCameraBtn.addEventListener('click', toggleCamera);
createChannelBtn.addEventListener('click', showCreateChannelModal);
pinnedMessagesBtn.addEventListener('click', () => togglePinnedSidebar(true));
closePinnedSidebarBtn.addEventListener('click', () => togglePinnedSidebar(false));

pinnedMessagesList.addEventListener('click', (e) => {
    const jumpTarget = e.target.closest('.jump-to-message');
    const unpinTarget = e.target.closest('.unpin-from-sidebar-btn');

    if (jumpTarget) {
        const messageTime = jumpTarget.dataset.messageTime;
        const messageEl = messagesArea.querySelector(`[data-message-time="${messageTime}"]`);
        if (messageEl) {
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageEl.classList.add('message-highlight');
            setTimeout(() => {
                messageEl.classList.remove('message-highlight');
            }, 2000);
            togglePinnedSidebar(false);
        }
    }
    
    if (unpinTarget) {
        const messageTime = unpinTarget.dataset.messageTime;
        togglePinMessage(messageTime);
    }
});

emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.classList.toggle('hidden');
});

emojiPicker.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('emoji-item')) {
        insertTextAtCursor(target.textContent!);
    }
});

searchBtn.addEventListener('click', () => {
    chatHeader.classList.add('hidden');
    searchInputContainer.classList.remove('hidden');
    searchBtn.classList.add('hidden');
    closeSearchBtn.classList.remove('hidden');
    searchInput.focus();
});

closeSearchBtn.addEventListener('click', () => {
    chatHeader.classList.remove('hidden');
    searchInputContainer.classList.add('hidden');
    searchBtn.classList.remove('hidden');
    closeSearchBtn.classList.add('hidden');
    searchInput.value = '';
    searchQuery = '';
    renderMessages();
});

searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderMessages();
});

// Context menu actions
contextMenu.addEventListener('click', (e) => {
    const target = e.target.closest('li');
    if (!target) return;
    
    const action = target.dataset.action;
    const userId = target.dataset.userId;
    const channelId = target.dataset.channelId;
    const messageTime = target.dataset.messageTime;

    if (!action) return;

    switch(action) {
        case 'promote': promoteUser(userId); break;
        case 'demote': demoteUser(userId); break;
        case 'ban': showBanModal(userId); break;
        case 'unban': unbanUser(userId); break;
        case 'edit-profile': showProfileModal(userId); break;
        case 'edit-channel': showEditChannelModal(channelId); break;
        case 'delete-channel': showDeleteChannelConfirmation(channelId); break;
        case 'pin-message': togglePinMessage(messageTime); break;
    }
    closeContextMenu();
});

// Modal actions
modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

modalBody.addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    if (form.id === 'ban-form') {
        const userId = form.dataset.userId;
        const duration = (document.getElementById('ban-duration') as HTMLInputElement).value;
        banUser(userId, duration ? parseInt(duration) : 'permanent');
    }
    if (form.id === 'profile-form') {
        const userId = form.dataset.userId;
        const name = (document.getElementById('profile-name') as HTMLInputElement).value;
        const avatar = (document.getElementById('profile-avatar') as HTMLInputElement).value;
        const color = (document.getElementById('profile-color') as HTMLInputElement).value;
        const age = parseInt((document.getElementById('profile-age') as HTMLInputElement).value) || undefined;
        const gender = (document.getElementById('profile-gender') as HTMLSelectElement).value;
        const country = (document.getElementById('profile-country') as HTMLInputElement).value;
        updateProfile(userId, name, avatar, color, age, gender, country);
    }
    if (form.id === 'create-channel-form') {
        const name = (document.getElementById('channel-name') as HTMLInputElement).value.trim();
        const isPrivate = (document.getElementById('channel-private') as HTMLInputElement).checked;
        const memberInputs = document.querySelectorAll('input[name="members"]:checked');
        const memberIds = Array.from(memberInputs).map(input => input.value);
        if (name) {
            createChannel(name, isPrivate, memberIds);
        }
    }
     if (form.id === 'edit-channel-form') {
        const channelId = form.dataset.channelId;
        const newName = (document.getElementById('edit-channel-name') as HTMLInputElement).value.trim();
        if (newName) {
            updateChannelName(channelId, newName);
        }
    }
});

modalBody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.id === 'confirm-clear-btn') {
        clearCurrentChat();
    }
    if (target.id === 'cancel-clear-btn' || target.id === 'cancel-delete-btn') {
        closeModal();
    }
    if (target.id === 'confirm-delete-channel-btn') {
        const channelId = target.dataset.channelId;
        deleteChannel(channelId);
    }
});

function handleLanguageChange() {
    if (state.activeChat) {
        const chatId = state.activeChat.type === 'user' ? `user_${state.activeChat.id}` : state.activeChat.id;
        translationSettings[chatId] = {
            source: sourceLangSelect.value,
            target: targetLangSelect.value,
        };
        // Re-render messages to apply new translation settings
        renderMessages();
    }
}

sourceLangSelect.addEventListener('change', handleLanguageChange);
targetLangSelect.addEventListener('change', handleLanguageChange);

// --- INITIALIZE ---
function initializeApp() {
    loadTheme();
    setupSpeechRecognition();
    renderEmojiPicker();
    
    // Populate language dropdowns
    const langOptions = Object.entries(SUPPORTED_LANGUAGES)
      .map(([code, name]) => `<option value="${code}">${name}</option>`)
      .join('');
    sourceLangSelect.innerHTML = langOptions;
    targetLangSelect.innerHTML = langOptions;
    
    lucide.createIcons();
    setInterval(checkBanStatus, 60000); // Re-check bans every minute
}
initializeApp();