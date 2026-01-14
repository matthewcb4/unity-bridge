import React, { useState, useEffect, useRef } from 'react';
import {
    Heart, Flame, Sparkles, MessageCircle, Copy, Check, Share2,
    RefreshCcw, Settings, BookOpen, ChevronRight, User, Gamepad2, Trophy,
    Loader2, ShieldCheck as ShieldIcon, Users, AlertCircle, Hand,
    Bell, Zap, Lock, Globe, Save, Trash2, Edit3, Send,
    Clock, Calendar, ExternalLink, Moon, Coffee, Anchor,
    Wind, Thermometer, PenTool
} from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import {
    getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged
} from 'firebase/auth';
import {
    getFirestore, doc, setDoc, getDoc, collection, updateDoc,
    onSnapshot, addDoc, serverTimestamp, query, deleteDoc, orderBy, limit, where
} from 'firebase/firestore';
import { calculateMoveScore, getBonusType, LETTER_POINTS } from './letterLinkLogic';
import { SHIPS, GRID_SIZE, createEmptyGrid, isValidPlacement, placeShipOnGrid, processAttack, checkAllShipsSunk, countRemainingShips, getAttackDisplay, hasPlacedAllShips } from './battleshipLogic';

// --- CONFIGURATION ---
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyArFtQwJcTQnhYW15n8HMksjomCoeL9dpw",
    authDomain: "unity-bridge-45617.firebaseapp.com",
    projectId: "unity-bridge-45617",
    storageBucket: "unity-bridge-45617.firebasestorage.app",
    messagingSenderId: "865688064662",
    appId: "1:865688064662:web:18665109e9f2bbd9f7a8b7",
    measurementId: "G-GJCWR2TZFN"
};

// API key is now securely stored in Cloud Function - no longer exposed in frontend

// --- SINGLETON INITIALIZATION ---
let app, auth, db, analytics;

try {
    // Check if firebase app is already initialized to prevent duplicates
    if (!getApps().length) {
        app = initializeApp(FIREBASE_CONFIG);
    } else {
        app = getApp();
    }

    auth = getAuth(app);
    db = getFirestore(app);
    if (typeof window !== 'undefined') {
        analytics = getAnalytics(app);
    }
} catch (error) {
    console.error("Firebase Initialization Error:", error);
}

const APP_ID = 'unity-bridge-live';

// Journal type definitions with visual styling
const JOURNAL_TYPES = {
    feeling: { label: 'Feeling', color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200', icon: Heart },
    ai_log: { label: 'AI Log', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200', icon: Zap },
    win: { label: 'Win', color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200', icon: Sparkles },
    thought: { label: 'Thought', color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200', icon: PenTool }
};

// Nudge prompts with time-appropriate content
const NUDGE_DATA = {
    Morning: {
        time: '8:00 AM',
        prompt: 'Start the day with gratitude',
        suggestion: 'Share one thing you appreciate about your spouse',
        icon: Coffee
    },
    Lunch: {
        time: '12:00 PM',
        prompt: 'Midday connection',
        suggestion: 'Send a quick "thinking of you" message',
        icon: MessageCircle
    },
    Evening: {
        time: '7:00 PM',
        prompt: 'End-of-day reflection',
        suggestion: 'Share a highlight from your day together',
        icon: Moon
    }
};

// --- COMPONENT DEFINITIONS ---

// Custom Icon Component (Moved up to avoid hoisting issues)
const ShieldCheckComp = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
);

const App = () => {
    // State
    const [user, setUser] = useState(null);
    const [authError, setAuthError] = useState(null);
    // Auto-redirect to hub if user previously selected a role and has couple code
    const savedRole = localStorage.getItem('user_role');
    const savedCode = localStorage.getItem('couple_code');
    const [view, setView] = useState(savedRole && savedCode ? 'hub' : 'home');
    const [role, setRole] = useState(savedRole || null);
    const [activeTab, setActiveTab] = useState('affection');
    const [affectionType, setAffectionType] = useState('primary');

    const [wifeName, setWifeName] = useState(localStorage.getItem('wife_name') || '');
    const [husbandName, setHusbandName] = useState(localStorage.getItem('husband_name') || '');
    const [wifePetName, setWifePetName] = useState(localStorage.getItem('wife_pet_name') || '');
    const [husbandPetName, setHusbandPetName] = useState(localStorage.getItem('husband_pet_name') || '');
    const [coupleCode, setCoupleCode] = useState(localStorage.getItem('couple_code') || '');

    const [bridgeItems, setBridgeItems] = useState([]);
    const [journalItems, setJournalItems] = useState([]);
    const [vaultMessages, setVaultMessages] = useState({ gentle: [], flirty: [], appreciative: [] });
    const [touchIdeas, setTouchIdeas] = useState({ daily: [], sensual: [], initiation: [] });
    const [pulse, setPulse] = useState(null);

    const [vaultStyle, setVaultStyle] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [inputText, setInputText] = useState('');
    const [editableOutput, setEditableOutput] = useState('');
    const [copiedId, setCopiedId] = useState(null);
    const [journalPrompt, setJournalPrompt] = useState(null);

    // AI Enhancement States
    const [hisLoveLanguage, setHisLoveLanguage] = useState(localStorage.getItem('his_love_language') || 'Physical Touch');
    const [herLoveLanguage, setHerLoveLanguage] = useState(localStorage.getItem('her_love_language') || 'Words of Affirmation');
    const [dateIdeas, setDateIdeas] = useState([]);
    const [aiError, setAiError] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState('');

    // Bridge clear timestamp (per user)
    const [bridgeClearedAt, setBridgeClearedAt] = useState(() => {
        const stored = localStorage.getItem(`bridge_cleared_${role}`);
        return stored ? parseInt(stored) : 0;
    });

    // Game state
    const [activeGames, setActiveGames] = useState([]);
    const [currentGameId, setCurrentGameId] = useState(null); // ID of the specific game we are playing right now
    const [gameHistory, setGameHistory] = useState([]);
    const [gameAnswer, setGameAnswer] = useState('');

    // Letter Link Interaction State
    const [selectedTileIndex, setSelectedTileIndex] = useState(null); // Index in hand
    const [placedTiles, setPlacedTiles] = useState([]); // [{ char, row, col, fromHandIndex }]
    const [gameDebts, setGameDebts] = useState(() => JSON.parse(localStorage.getItem('game_debts') || '[]'));
    const prevGamesRef = useRef({});
    const [scoreboardFilter, setScoreboardFilter] = useState('all'); // all, 7days, 30days
    const [gameTurn, setGameTurn] = useState(null); // 'his' or 'hers' - whose turn to guess
    const [selectedGame, setSelectedGame] = useState(null); // null = show menu, 'word_scramble' = show game

    // Battleship Game State
    const [battleshipPhase, setBattleshipPhase] = useState('placing'); // 'placing' | 'battle' | 'ended'
    const [battleshipSelectedShip, setBattleshipSelectedShip] = useState(null); // Currently selected ship for placement
    const [battleshipOrientation, setBattleshipOrientation] = useState('horizontal'); // 'horizontal' | 'vertical'
    const [localShipPlacements, setLocalShipPlacements] = useState({}); // { shipType: { row, col, orientation } }
    const [localPlacementGrid, setLocalPlacementGrid] = useState(createEmptyGrid()); // Local grid during placement

    // NEW: Dark Mode
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark_mode') === 'true');

    // NEW: Notification Preferences
    const [notificationPermission, setNotificationPermission] = useState(() =>
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );
    const [notifyPrefs, setNotifyPrefs] = useState(() => JSON.parse(localStorage.getItem('notify_prefs') || JSON.stringify({
        games: true,
        bridge: true,
        dateReminders: false,
        messageReminders: false
    })));

    // NEW: Anniversary & Milestones
    const [anniversaryDate, setAnniversaryDate] = useState(localStorage.getItem('anniversary_date') || '');
    const [milestones, setMilestones] = useState([]);

    // NEW: Journal Edit & Search
    const [editingJournalId, setEditingJournalId] = useState(null);
    const [editingJournalContent, setEditingJournalContent] = useState('');
    const [journalSearchText, setJournalSearchText] = useState('');
    const [journalFilterType, setJournalFilterType] = useState('all');

    // NEW: Weekly Summary & Conflict Resolution with Questionnaire
    const [weeklySummary, setWeeklySummary] = useState(null);
    const [resolveStep, setResolveStep] = useState('feeling'); // 'feeling', 'need', 'topic', 'action', 'steps'
    const [resolveFeeling, setResolveFeeling] = useState(null);
    const [resolveNeed, setResolveNeed] = useState(null);
    const [resolveTopic, setResolveTopic] = useState('');
    const [conflictStep, setConflictStep] = useState(0);
    const [analysisTimeFilter, setAnalysisTimeFilter] = useState('7days'); // 7days, 14days, workweek, weekend, all

    // FAMILY BRIDGE: Portal Mode State
    const [portalMode, setPortalMode] = useState(() => localStorage.getItem('portal_mode') || 'couple'); // 'couple' | 'family' | 'kid'
    const [kidProfiles, setKidProfiles] = useState([]); // Array of kid profiles
    const [currentKid, setCurrentKid] = useState(null); // Currently logged in kid
    const [kidPinInput, setKidPinInput] = useState('');
    const [showKidManager, setShowKidManager] = useState(false);
    const [kidJournalItems, setKidJournalItems] = useState([]);
    const [kidBridgeItems, setKidBridgeItems] = useState([]);

    // Parent PIN Authentication
    const [parentPinInput, setParentPinInput] = useState('');
    const [showParentPinModal, setShowParentPinModal] = useState(false);
    const [pendingParentRole, setPendingParentRole] = useState(null); // 'his' or 'hers' - which parent is trying to log in

    // Initialize PWA and Viewport
    useEffect(() => {
        const setAppHeight = () => {
            document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
        };
        window.addEventListener('resize', setAppHeight);
        setAppHeight();
        return () => window.removeEventListener('resize', setAppHeight);
    }, []);

    // Auth Listener with Error Handling
    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
            if (!u) {
                try {
                    await signInAnonymously(auth);
                } catch (err) {
                    console.error("Auth Error details:", err);
                    setAuthError(err.message);
                }
            } else {
                setUser(u);
                setAuthError(null);
            }
        });
        return () => unsubscribe();
    }, []);

    // Data Listeners
    useEffect(() => {
        if (!user || !role || !db || !coupleCode) return;

        // Use coupleCode as the shared namespace for both partners
        const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;

        const bridgeRef = collection(db, sharedNamespace, 'bridge_items');
        const unsubBridge = onSnapshot(bridgeRef, (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setBridgeItems(items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
        }, (err) => console.error("Bridge Sync Error:", err));

        // Journal uses coupleCode + role so each partner has their own journal that syncs across devices
        const journalRef = collection(db, sharedNamespace, 'journals', role, 'entries');
        const unsubJournal = onSnapshot(journalRef, (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setJournalItems(items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
        }, (err) => console.error("Journal Sync Error:", err));

        // Listen for shared settings (love languages, names) - both partners can edit
        const settingsRef = doc(db, 'couples', coupleCode.toLowerCase(), 'config', 'settings');
        const unsubSettings = onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.hisLoveLanguage) setHisLoveLanguage(data.hisLoveLanguage);
                if (data.herLoveLanguage) setHerLoveLanguage(data.herLoveLanguage);
                if (data.husbandName) setHusbandName(data.husbandName);
                if (data.wifeName) setWifeName(data.wifeName);
            }
        }, (err) => console.error("Settings Sync Error:", err));

        // Listen for active games (Concept: Lobby)
        const activeGamesRef = collection(db, 'couples', coupleCode.toLowerCase(), 'active_games');
        const unsubGames = onSnapshot(activeGamesRef, (snap) => {
            const games = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Notification Logic: Check for turn changes
            games.forEach(g => {
                const prevTurn = prevGamesRef.current[g.id];
                const currentTurn = g.currentTurn || (g.createdBy === 'his' ? 'hers' : 'his');

                // If it wasn't my turn, and now it IS my turn, and I haven't been notified yet for this state
                if (prevTurn && prevTurn !== role && currentTurn === role) {
                    sendNotification(
                        "It's your turn!",
                        `Time to move in ${g.type === 'letter_link' ? 'Letter Link' : 'Word Scramble'}!`,
                        'games'
                    );
                }
                prevGamesRef.current[g.id] = currentTurn;
            });

            // Sort by creation date desc
            setActiveGames(games.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        }, (err) => console.error("Games Sync Error:", err));

        // Listen for game history
        const historyRef = collection(db, 'couples', coupleCode.toLowerCase(), 'games', 'history', 'items');
        const unsubHistory = onSnapshot(historyRef, (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setGameHistory(items.sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)));
        }, (err) => console.error("Game History Error:", err));

        // Listen for kid profiles (Family Bridge)
        const kidsRef = collection(db, 'families', coupleCode.toLowerCase(), 'kids');
        const unsubKids = onSnapshot(kidsRef, (snap) => {
            const kids = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setKidProfiles(kids.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        }, (err) => console.error("Kids Sync Error:", err));

        // Initial content load
        refreshVaults();

        return () => { unsubBridge(); unsubJournal(); unsubSettings(); unsubGames(); unsubHistory(); unsubKids(); };
    }, [user, role, coupleCode]);

    // --- ACTIONS ---

    const callGemini = async (prompt) => {
        try {
            // Call our secure Cloud Function instead of the direct API
            const response = await fetch('https://us-central1-unity-bridge-45617.cloudfunctions.net/callGemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error("AI Error:", response.status, errorData);
                return null;
            }
            const data = await response.json();
            return data.result;
        } catch (err) {
            console.error("AI Error", err);
            return null;
        }
    };

    const refreshVaults = async () => {
        if (isRefreshing || !role) return;
        setIsRefreshing(true);
        const sender = role === 'his' ? (husbandName || 'Husband') : (wifeName || 'Wife');
        const receiver = role === 'his' ? (wifeName || 'Wife') : (husbandName || 'Husband');
        const receiverPetName = role === 'his' ? (wifePetName || wifeName || 'babe') : (husbandPetName || husbandName || 'babe');
        const partnerLanguage = role === 'his' ? herLoveLanguage : hisLoveLanguage;

        // Define categories based on partner's love language
        const languageCategories = {
            'Physical Touch': { primary: ['gentle', 'sensual', 'playful'], secondary: ['morning', 'comfort', 'intimate'] },
            'Words of Affirmation': { primary: ['encouraging', 'appreciative', 'flirty'], secondary: ['compliments', 'gratitude', 'affirmation'] },
            'Quality Time': { primary: ['date ideas', 'activities', 'conversations'], secondary: ['quick moments', 'weekends', 'traditions'] },
            'Acts of Service': { primary: ['helpful', 'thoughtful', 'surprise'], secondary: ['daily tasks', 'special gestures', 'anticipate needs'] },
            'Receiving Gifts': { primary: ['thoughtful', 'meaningful', 'spontaneous'], secondary: ['experiences', 'sentimental', 'practical'] }
        };

        const cats = languageCategories[partnerLanguage] || languageCategories['Words of Affirmation'];

        // Parse pet names to ensure AI treats them as options
        const namesList = receiverPetName.split(',').map(n => n.trim()).filter(n => n.length > 0);
        const formattedNames = namesList.length > 1
            ? namesList.map(n => `"${n}"`).join(' OR ')
            : `"${receiverPetName}"`;

        // Add randomization seed for variety
        const varietySeed = Date.now() % 1000;
        const tones = ['playful', 'romantic', 'passionate', 'tender', 'flirtatious', 'heartfelt', 'sweet', 'devoted'];
        const randomTone = tones[Math.floor(Math.random() * tones.length)];

        const systemPrompt = `You are ${sender}'s inner voice, helping write authentic, heartfelt messages to ${receiver}.

🎲 UNIQUENESS SEED: ${varietySeed} - Generate COMPLETELY DIFFERENT messages than any previous request.

💕 Partner's love language: ${partnerLanguage}
💝 Pet name options: ${formattedNames} (Pick ONE per message, vary your choices)
🎭 Tone for this batch: ${randomTone} with natural variety

CRITICAL RULES FOR VARIETY:
- NEVER start messages the same way. Use different openings: questions, statements, memories, desires, observations
- Vary message lengths: some short (1 line), some medium (2-3 lines), some longer with emotion
- Include specific details: times of day, activities, physical descriptions, memories
- Mix: flirty, sincere, playful, deep emotional, funny, tender
- NO generic phrases like "I was just thinking..." or "You mean so much to me" 
- Each message should feel UNIQUE and personal

For each category, write 3 DISTINCTLY DIFFERENT messages:
- Category "${cats.primary[0]}": 3 varied messages
- Category "${cats.primary[1]}": 3 varied messages  
- Category "${cats.primary[2]}": 3 varied messages
- Category "${cats.secondary[0]}": 3 varied messages
- Category "${cats.secondary[1]}": 3 varied messages
- Category "${cats.secondary[2]}": 3 varied messages

Return ONLY JSON: { "primary": { "${cats.primary[0]}": ["msg1", "msg2", "msg3"], "${cats.primary[1]}": ["msg1", "msg2", "msg3"], "${cats.primary[2]}": ["msg1", "msg2", "msg3"] }, "secondary": { "${cats.secondary[0]}": ["msg1", "msg2", "msg3"], "${cats.secondary[1]}": ["msg1", "msg2", "msg3"], "${cats.secondary[2]}": ["msg1", "msg2", "msg3"] } }`;

        const result = await callGemini(systemPrompt);
        if (result) {
            setVaultMessages(result.primary || {});
            setTouchIdeas(result.secondary || {});
        }
        setIsRefreshing(false);
    };

    const translateMessage = async () => {
        if (!inputText) return;
        setIsGenerating(true);
        const systemPrompt = `Marriage counselor. Convert frustration: "${inputText}" into a soft I-Statement. JSON { "translation": "..." }`;
        const result = await callGemini(systemPrompt);
        if (result) setEditableOutput(result.translation);
        setIsGenerating(false);
    };

    const generatePulse = async () => {
        if (bridgeItems.length === 0) return;
        setIsGenerating(true);

        // Filter messages based on time period
        const now = new Date();
        const filterMessages = (items) => {
            if (analysisTimeFilter === 'all') return items;

            return items.filter(item => {
                const itemDate = item.timestamp?.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
                const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
                const dayOfWeek = itemDate.getDay(); // 0=Sunday, 6=Saturday

                switch (analysisTimeFilter) {
                    case '7days':
                        return daysDiff <= 7;
                    case '14days':
                        return daysDiff <= 14;
                    case 'workweek':
                        // Last Monday to Friday
                        const lastMonday = new Date(now);
                        lastMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
                        lastMonday.setHours(0, 0, 0, 0);
                        const lastFriday = new Date(lastMonday);
                        lastFriday.setDate(lastMonday.getDate() + 4);
                        lastFriday.setHours(23, 59, 59, 999);
                        return itemDate >= lastMonday && itemDate <= lastFriday;
                    case 'weekend':
                        // Last Saturday and Sunday
                        const lastSaturday = new Date(now);
                        lastSaturday.setDate(now.getDate() - ((now.getDay() + 1) % 7));
                        lastSaturday.setHours(0, 0, 0, 0);
                        const lastSunday = new Date(lastSaturday);
                        lastSunday.setDate(lastSaturday.getDate() + 1);
                        lastSunday.setHours(23, 59, 59, 999);
                        return (dayOfWeek === 0 || dayOfWeek === 6) && daysDiff <= 7;
                    default:
                        return true;
                }
            });
        };

        const timeFilterLabels = {
            '7days': 'Last 7 Days',
            '14days': 'Last 14 Days',
            'workweek': 'Last Work Week (Mon-Fri)',
            'weekend': 'Last Weekend',
            'all': 'All Time'
        };

        const filteredItems = filterMessages(bridgeItems);

        if (filteredItems.length === 0) {
            alert(`No messages found for "${timeFilterLabels[analysisTimeFilter]}". Try a different time period.`);
            setIsGenerating(false);
            return;
        }

        const recentMessages = filteredItems.slice(0, 30).map(i => {
            const author = i.author === 'his' ? (husbandName || 'Husband') : (wifeName || 'Wife');
            const date = i.timestamp?.toDate ? i.timestamp.toDate().toLocaleDateString() : '';
            return `[${date}] ${author}: "${i.content}"`;
        }).join('\n');

        const systemPrompt = `You are a licensed marriage counselor analyzing a couple's communication over the ${timeFilterLabels[analysisTimeFilter].toLowerCase()}. 
        
Couple: ${husbandName || 'Husband'} and ${wifeName || 'Wife'}
Time Period: ${timeFilterLabels[analysisTimeFilter]}
Messages Analyzed: ${filteredItems.length}

Their shared messages:
${recentMessages}

Provide a comprehensive relationship analysis in this exact JSON format:
{
    "overallTone": "One word describing the emotional climate (e.g., 'Supportive', 'Tense', 'Loving', 'Disconnected')",
    "communicationStyle": "Brief description of how they communicate with each other",
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "areasForGrowth": ["area 1", "area 2"],
    "patterns": "Describe any recurring themes or dynamics you notice",
    "recommendation": "One actionable suggestion for their counselor or for them to work on",
    "healthScore": "A number from 1-10 rating overall relationship health based on these messages"
}

Return ONLY valid JSON, no other text.`;

        const result = await callGemini(systemPrompt);
        if (result) setPulse(result);
        setIsGenerating(false);
    };

    const saveToBridge = async (customContent = null) => {
        if (!user || !coupleCode) {
            alert('Please set a couple code on the home screen first');
            return;
        }
        if (!role) {
            alert('Please select your hub (Husband or Wife) first');
            return;
        }
        const content = typeof (customContent || editableOutput) === 'string'
            ? (customContent || editableOutput)
            : String(customContent || editableOutput);
        if (!content) return;
        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            await addDoc(collection(db, sharedNamespace, 'bridge_items'), {
                content, author: role, timestamp: serverTimestamp(), type: customContent ? 'reset' : 'shared'
            });
            setEditableOutput(''); setInputText('');
            alert('Shared to bridge! ✓');
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save. Please try again.');
        }
    };

    // Save shared settings to Firestore (love languages and names)
    const saveSettings = async (updates) => {
        if (!coupleCode || !db) return;
        try {
            const settingsRef = doc(db, 'couples', coupleCode.toLowerCase(), 'config', 'settings');
            await setDoc(settingsRef, updates, { merge: true });
        } catch (err) {
            console.error('Settings save error:', err);
        }
    };

    // Kid Profile Management (Family Bridge)
    const addKidProfile = async (name, avatar, pin) => {
        if (!coupleCode || !db) return;
        try {
            const kidsRef = collection(db, 'families', coupleCode.toLowerCase(), 'kids');
            await addDoc(kidsRef, {
                name,
                avatar: avatar || '🧒',
                pin,
                createdAt: serverTimestamp()
            });
            alert(`${name} has been added!`);
        } catch (err) {
            console.error('Add kid error:', err);
            alert('Failed to add kid profile.');
        }
    };

    const updateKidProfile = async (kidId, updates) => {
        if (!coupleCode || !db || !kidId) return;
        try {
            const kidRef = doc(db, 'families', coupleCode.toLowerCase(), 'kids', kidId);
            await setDoc(kidRef, updates, { merge: true });
        } catch (err) {
            console.error('Update kid error:', err);
            alert('Failed to update kid profile.');
        }
    };

    const deleteKidProfile = async (kidId, kidName) => {
        if (!coupleCode || !db || !kidId) return;
        if (!window.confirm(`Remove ${kidName}'s profile? This will delete their journal and messages.`)) return;
        try {
            const kidRef = doc(db, 'families', coupleCode.toLowerCase(), 'kids', kidId);
            await deleteDoc(kidRef);
            alert(`${kidName}'s profile has been removed.`);
        } catch (err) {
            console.error('Delete kid error:', err);
            alert('Failed to delete kid profile.');
        }
    };

    const saveToJournal = async (manualText = null, meta = {}) => {
        if (!user || !coupleCode) {
            alert('Please set a couple code on the home screen first');
            return;
        }
        if (!role) {
            alert('Please select your hub (Husband or Wife) first');
            return;
        }
        const content = manualText || editableOutput || inputText;
        if (!content) {
            alert('Please enter some text first');
            return;
        }
        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            await addDoc(collection(db, sharedNamespace, 'journals', role, 'entries'), {
                content, timestamp: serverTimestamp(), ...meta
            });
            setEditableOutput(''); setInputText(''); setJournalPrompt(null);
            alert('Saved to journal! ✓');
        } catch (err) {
            console.error('Journal save error:', err);
            alert('Failed to save. Please try again.');
        }
    };

    const deleteFromJournal = async (itemId) => {
        if (!user || !coupleCode || !role) return;
        if (!window.confirm('Are you sure you want to delete this journal entry?')) return;
        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            await deleteDoc(doc(db, sharedNamespace, 'journals', role, 'entries', itemId));
        } catch (err) {
            console.error('Journal delete error:', err);
            alert('Failed to delete. Please try again.');
        }
    };

    const generateJournalInsights = async () => {
        if (journalItems.length === 0) {
            alert('Add some journal entries first to get insights');
            return;
        }
        setIsGenerating(true);
        const recentEntries = journalItems.slice(0, 5).map(j => `[${j.type || 'entry'}]: ${j.content}`).join('\n');
        const partnerName = role === 'his' ? (wifeName || 'your wife') : (husbandName || 'your husband');
        const systemPrompt = `You are a relationship counselor. Based on these recent journal entries:\n${recentEntries}\n\nProvide personalized communication suggestions for talking with ${partnerName}. Return JSON: { "insights": "brief analysis of patterns", "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"] }`;
        const result = await callGemini(systemPrompt);
        if (result) {
            alert(`💡 Insights: ${result.insights}\n\n✨ Suggestions:\n• ${result.suggestions.join('\n• ')}`);
        } else {
            alert('Could not generate insights. Please try again.');
        }
        setIsGenerating(false);
    };

    // NEW: Delete Bridge Items
    const deleteFromBridge = async (itemId) => {
        if (!user || !coupleCode) return;
        if (!window.confirm('Delete this message from the bridge?')) return;
        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            await deleteDoc(doc(db, sharedNamespace, 'bridge_items', itemId));
        } catch (err) {
            console.error('Bridge delete error:', err);
            alert('Failed to delete. Please try again.');
        }
    };

    // NEW: Update Journal Entry
    const updateJournalEntry = async (itemId, newContent) => {
        if (!user || !coupleCode || !role || !newContent.trim()) return;
        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            await setDoc(doc(db, sharedNamespace, 'journals', role, 'entries', itemId),
                { content: newContent.trim() }, { merge: true });
            setEditingJournalId(null);
            setEditingJournalContent('');
        } catch (err) {
            console.error('Journal update error:', err);
            alert('Failed to update. Please try again.');
        }
    };

    // NEW: Weekly Summary
    const generateWeeklySummary = async () => {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const weekEntries = journalItems.filter(j =>
            j.timestamp?.seconds && (j.timestamp.seconds * 1000) > oneWeekAgo
        );
        if (weekEntries.length === 0) {
            alert('No journal entries from this week to analyze');
            return;
        }
        setIsGenerating(true);
        const entries = weekEntries.map(j => `[${j.type || 'entry'}]: ${j.content}`).join('\n');
        const prompt = `Analyze this week's relationship journal entries:\n${entries}\n\nReturn JSON: { "mood": "one word overall mood", "highlights": ["highlight 1", "highlight 2"], "areas": ["area to focus on"], "encouragement": "one encouraging sentence" }`;
        const result = await callGemini(prompt);
        if (result) setWeeklySummary(result);
        setIsGenerating(false);
    };

    // NEW: Export Journal Data
    const exportJournalData = () => {
        if (journalItems.length === 0) {
            alert('No journal entries to export');
            return;
        }
        const data = journalItems.map(j => ({
            date: j.timestamp ? new Date(j.timestamp.seconds * 1000).toISOString() : 'Unknown',
            type: j.type || 'entry',
            content: j.content
        }));
        const text = data.map(d => `[${d.date}] (${d.type})\n${d.content}\n`).join('\n---\n\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unity-bridge-journal-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // NEW: Save Anniversary
    const saveAnniversary = async (date) => {
        setAnniversaryDate(date);
        localStorage.setItem('anniversary_date', date);
        if (coupleCode && db) {
            await setDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'config', 'settings'),
                { anniversaryDate: date }, { merge: true });
        }
    };

    // NEW: Calculate Days Together
    const getDaysTogether = () => {
        if (!anniversaryDate) return null;
        const start = new Date(anniversaryDate);
        const now = new Date();
        const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        return diff >= 0 ? diff : null;
    };

    // NEW: Check Milestones
    const checkMilestones = () => {
        const earned = [];
        const daysTogether = getDaysTogether();

        if (journalItems.length >= 1) earned.push({ id: 'first_entry', label: 'First Entry', emoji: '📝' });
        if (journalItems.length >= 10) earned.push({ id: 'ten_entries', label: '10 Entries', emoji: '📚' });
        if (journalItems.length >= 50) earned.push({ id: 'fifty_entries', label: '50 Entries', emoji: '🏆' });
        if (journalItems.length >= 100) earned.push({ id: 'century', label: '100 Entries', emoji: '💯' });
        if (bridgeItems.length >= 10) earned.push({ id: 'connected', label: 'Connected', emoji: '🌉' });
        if (daysTogether && daysTogether >= 30) earned.push({ id: 'month', label: '1 Month', emoji: '🌙' });
        if (daysTogether && daysTogether >= 365) earned.push({ id: 'year', label: '1 Year', emoji: '🎉' });
        if (daysTogether && daysTogether >= 1825) earned.push({ id: 'five_years', label: '5 Years', emoji: '💎' });
        if (gameHistory.length >= 5) earned.push({ id: 'gamer', label: 'Game Night', emoji: '🎮' });

        return earned;
    };

    // Conflict Resolution Steps
    const CONFLICT_STEPS = [
        { title: 'Pause & Breathe', prompt: 'Take 3 deep breaths together. When ready, continue.', action: 'I\'m ready to listen with an open heart.' },
        { title: 'Express Feelings', prompt: 'Using "I feel..." statements, share your emotions without blame.', action: 'I hear your feelings and they matter to me.' },
        { title: 'Seek Understanding', prompt: 'Ask: "Help me understand your perspective better."', action: 'I want to understand where you\'re coming from.' },
        { title: 'Find Common Ground', prompt: 'What do you both agree on? What\'s the shared goal?', action: 'We both want our relationship to thrive.' },
        { title: 'Commit to Action', prompt: 'Each share one thing you\'ll do differently.', action: 'I commit to working on this together.' }
    ];

    const generateDateNight = async (budget = 'moderate') => {
        setIsGenerating(true);
        const partnerName = role === 'his' ? (wifeName || 'Wife') : (husbandName || 'Husband');
        const partnerLanguage = role === 'his' ? herLoveLanguage : hisLoveLanguage;
        const budgetDesc = budget === 'free' ? 'completely free, no-cost' : budget === 'cheap' ? 'under $30' : budget === 'moderate' ? '$30-$75' : 'special occasion, $75+';

        const systemPrompt = `You are a romantic date planning expert. Generate 3 creative date night ideas for a couple.
        
Partner's love language: ${partnerLanguage}
Budget: ${budgetDesc}
Partner's name: ${partnerName}

Return JSON: { "dates": [{"title": "short title", "description": "2 sentences describing the date", "cost": "estimated cost", "tip": "one personalized tip based on love language"}] }`;

        const result = await callGemini(systemPrompt);
        if (result && result.dates) {
            setDateIdeas(result.dates);
        } else {
            alert('Could not generate date ideas. Please try again.');
        }
        setIsGenerating(false);
    };

    // --- GAME FUNCTIONS ---





    const scrambleWord = (word) => {
        if (word.length < 3) return word;
        const arr = word.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('') === word ? scrambleWord(word) : arr.join('');
    };

    const createWordPuzzle = async (wager = '') => {
        if (!coupleCode || !db || !role) return;

        // Personal words logic inlined to fix build issues
        const words = new Set(['LOVE', 'KISS', 'HUG', 'HOME', 'TRUST', 'FOREVER']);
        if (husbandName) words.add(husbandName.toUpperCase());
        if (wifeName) words.add(wifeName.toUpperCase());
        if (husbandPetName) husbandPetName.split(',').forEach(n => words.add(n.trim().toUpperCase()));
        if (wifePetName) wifePetName.split(',').forEach(n => words.add(n.trim().toUpperCase()));

        journalItems.forEach(item => {
            if (item.content) {
                const matches = item.content.match(/\b[A-Za-z]{4,8}\b/g);
                if (matches) {
                    const keywords = ['DATE', 'TRIP', 'WALK', 'MOVIE', 'DINNER', 'BEACH', 'DREAM', 'SMILE', 'LAUGH'];
                    keywords.forEach(k => { if (item.content.toUpperCase().includes(k)) words.add(k); });
                }
            }
        });
        const personalWords = Array.from(words).filter(w => w.length >= 3);

        const word = personalWords[Math.floor(Math.random() * personalWords.length)];
        const scrambled = scrambleWord(word);
        const creatorName = role === 'his' ? husbandName : wifeName;


        // Check if it's a personal word (name or from journal)
        const isPersonal = word === husbandName?.toUpperCase() || word === wifeName?.toUpperCase() ||
            journalItems.some(j => j.content?.toUpperCase().includes(word));

        try {
            const gamesRef = collection(db, 'couples', coupleCode.toLowerCase(), 'active_games');
            const docRef = await addDoc(gamesRef, {
                type: 'word_scramble',
                word: word,
                scrambled: scrambled,
                wager: wager,
                isPersonal: isPersonal,
                hint: isPersonal ? '💕 This word is special to us!' : '',
                createdBy: role,
                creatorName: creatorName,
                createdAt: serverTimestamp(),
                currentTurn: role === 'his' ? 'hers' : 'his', // Other player goes first
                hisScore: 0,
                hersScore: 0,
                targetScore: 10, // First to 10 wins!
                solved: false
            });
            setGameAnswer('');
            setCurrentGameId(docRef.id);
        } catch (err) {
            console.error('Create game error:', err);
            alert('Could not create game. Please try again.');
        }
    };

    // --- LETTER LINK HANDLERS ---
    const handleTileClick = (index, char) => {
        // If clicking a tile already placed on board (handled by board click usually, but if hand tile is clicked?)
        // In hand: toggle selection
        if (selectedTileIndex === index) {
            setSelectedTileIndex(null); // Deselect
        } else {
            setSelectedTileIndex(index);
        }
    };

    const handleBoardClick = (index) => {
        const activeGame = activeGames.find(g => g.id === currentGameId);
        if (!activeGame) return;

        const row = Math.floor(index / 11);
        const col = index % 11;

        // Check if existing permanent tile is there (from activeGame.board)
        let board = [];
        try { board = JSON.parse(activeGame.board || '[]'); } catch (e) { }
        if (board[index]) return; // Occupied by committed tile

        // Check if occupied by a temporary placed tile
        const tempTileIndex = placedTiles.findIndex(t => t.row === row && t.col === col);

        if (tempTileIndex !== -1) {
            // Clicked a temporary tile -> Return to hand
            const tileToReturn = placedTiles[tempTileIndex];
            setPlacedTiles(prev => prev.filter((_, i) => i !== tempTileIndex));
            setSelectedTileIndex(null);
            return;
        }

        // Placing a selection
        if (selectedTileIndex !== null) {
            // Check if this hand tile is already placed elsewhere?
            // "placedTiles" tracks "fromHandIndex". 
            // Actually, we should only show tiles in hand that are NOT in "placedTiles".
            // Logic: The "hand" UI should hide tiles that are in "placedTiles".

            const char = activeGame.players[role].hand[selectedTileIndex];
            setPlacedTiles(prev => [...prev, { char, row, col, fromHandIndex: selectedTileIndex }]);
            setSelectedTileIndex(null); // Clear selection after placing
        }
    };

    const recallAllTiles = () => {
        setPlacedTiles([]);
        setSelectedTileIndex(null);
    };

    const submitLetterLinkMove = async () => {
        if (placedTiles.length === 0) return;

        // 1. Get Game
        const activeGame = activeGames.find(g => g.id === currentGameId);
        if (!activeGame) return;

        let board = [];
        try { board = JSON.parse(activeGame.board || '[]'); } catch (e) { }
        if (board.length === 0) board = Array(121).fill(null);

        // 2. Validate Turn (already checked in UI, but good for safety)
        const currentTurn = activeGame.currentTurn || (activeGame.createdBy === 'his' ? 'hers' : 'his');
        if (currentTurn !== role) {
            alert("It's not your turn!");
            return;
        }

        // 3. Validate Placement (Simplified Connectivity)
        // Rule: If board is empty, must touch center (60).
        // Rule: If board has tiles, at least one placed tile must be adjacent to an existing tile.
        // Rule: All placed tiles must be in a single row or column.

        // A. Alignment Check
        const rows = new Set(placedTiles.map(t => t.row));
        const cols = new Set(placedTiles.map(t => t.col));
        if (rows.size > 1 && cols.size > 1) {
            alert("Tiles must be placed in a straight line!");
            return;
        }

        // B. Connectivity Check
        const boardHasTiles = board.some(cell => cell !== null);
        let isConnected = false;

        if (!boardHasTiles) {
            // First move: must touch center (index 60)
            isConnected = placedTiles.some(t => (t.row * 11 + t.col) === 60);
            if (!isConnected) {
                alert("First move must assume the center star (★)!");
                return;
            }
        } else {
            // Subsequent moves: must touch existing tile
            // Check neighbors of all placed tiles
            const neighbors = [
                { r: -1, c: 0 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: 0, c: 1 }
            ];

            isConnected = placedTiles.some(t => {
                return neighbors.some(n => {
                    const nr = t.row + n.r;
                    const nc = t.col + n.c;
                    if (nr < 0 || nr > 10 || nc < 0 || nc > 10) return false;
                    const idx = nr * 11 + nc;
                    return board[idx] !== null; // Touching an occupied cell
                });
            });

            if (!isConnected) {
                // Or, if not directly touching, is it filling a gap between two existing tiles?
                // That case is implicitly handled if the *word* is connected, but technically 
                // you could place a tile in a gap. 
                // For V1, strict adjacency is safer.
                alert("Tiles must connect to existing words!");
                return;
            }
        }

        // 4. Calculate Score
        const moveScore = calculateMoveScore(placedTiles, board);

        // 5. Update Board & Hand
        const newBoard = [...board];
        placedTiles.forEach(t => {
            newBoard[t.row * 11 + t.col] = { char: t.char, owner: role };
        });

        const myHand = [...activeGame.players[role].hand];
        // Remove used tiles (matched by index to avoid duplicates)
        // placedTiles has 'fromHandIndex'. Sort desc to splice correctly
        placedTiles.sort((a, b) => b.fromHandIndex - a.fromHandIndex).forEach(t => {
            myHand.splice(t.fromHandIndex, 1);
        });

        // Refill Hand from Bag
        let bag = [...activeGame.bag];
        while (myHand.length < 7 && bag.length > 0) {
            myHand.push(bag.pop());
        }

        // 6. Push Update
        try {
            const nextTurn = role === 'his' ? 'hers' : 'his';
            await updateDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', currentGameId), {
                board: JSON.stringify(newBoard),
                bag: bag,
                [`players.${role}.hand`]: myHand,
                [`players.${role}.score`]: (activeGame.players[role].score || 0) + moveScore,
                currentTurn: nextTurn,
                // Add to history log
                history: [...(activeGame.history || []), {
                    word: "MOVE", // TODO: Detect actual word string
                    points: moveScore,
                    player: role,
                    timestamp: new Date().toISOString()
                }]
            });

            setPlacedTiles([]);
            setSelectedTileIndex(null);

            // Queue Notification
            try {
                // Determine partner's user ID if possible, or just send generic. 
                // Since sendNotification uses 'notifyPrefs', we just need to ensure the partner is subscribed.
                // We'll rely on the simple 'game_move' type we added earlier (or 'games').
                // Actually, let's just use the existing sendNotification. 
                // Wait, sendNotification sends to THIS device? No, it's local.
                // We need a Cloud Function for remote push. 
                // For V1 (local PWA with shared login? No, likely separate devices).
                // Existing solution uses `notifyPrefs` local check. 
                // Real push requires FCM token exchange. 
                // Assuming "cue the notification" means using the Service Worker we just built?
                // The prompt says "que the notification". 
                // If the user means local notification on the *other* device, that requires Firestore listener -> Service Worker trigger.
                // My Sw implementation responds to "push" events.
                // Firestore listeners in `App.js` can trigger `sendNotification` locally when data changes!
                // So if I update `currentTurn`, the OTHER client's onSnapshot will fire.
                // I need to make sure the OnSnapshot handler in App.js triggers a notification when turn changes to ME.
            } catch (ignored) { }

        } catch (err) {
            console.error("Move Error:", err);
            alert("Failed to submit move. Try again.");
        }
    };

    // Shuffle hand tiles (local reorder in Firestore)
    const shuffleHand = async (gameId) => {
        const game = activeGames.find(g => g.id === gameId);
        if (!game || !coupleCode || !db) return;

        const myHand = [...(game.players?.[role]?.hand || [])];
        // Fisher-Yates shuffle
        for (let i = myHand.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [myHand[i], myHand[j]] = [myHand[j], myHand[i]];
        }

        try {
            await updateDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId), {
                [`players.${role}.hand`]: myHand
            });
        } catch (err) {
            console.error('Shuffle error:', err);
        }
    };

    // Pass turn without placing tiles
    const passLetterLinkTurn = async (gameId) => {
        const game = activeGames.find(g => g.id === gameId);
        if (!game || !coupleCode || !db) return;

        if (!window.confirm('Pass your turn without playing? (The other player will go next)')) return;

        try {
            const nextTurn = role === 'his' ? 'hers' : 'his';
            await updateDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId), {
                currentTurn: nextTurn,
                history: [...(game.history || []), {
                    word: 'PASS',
                    points: 0,
                    player: role,
                    timestamp: new Date().toISOString()
                }]
            });
            setPlacedTiles([]);
            setSelectedTileIndex(null);
        } catch (err) {
            console.error('Pass turn error:', err);
            alert('Failed to pass turn.');
        }
    };

    // End Letter Link game
    const endLetterLinkGame = async (gameId) => {
        const game = activeGames.find(g => g.id === gameId);
        if (!game || !coupleCode || !db) return;

        if (!window.confirm('End the game now? Final scores will be tallied.')) return;

        try {
            // Calculate final scores (subtract remaining tile points)
            const hisHandPoints = (game.players?.his?.hand || []).reduce((sum, char) => sum + (LETTER_POINTS[char] || 0), 0);
            const hersHandPoints = (game.players?.hers?.hand || []).reduce((sum, char) => sum + (LETTER_POINTS[char] || 0), 0);
            const hisFinal = (game.players?.his?.score || 0) - hisHandPoints;
            const hersFinal = (game.players?.hers?.score || 0) - hersHandPoints;
            const winner = hisFinal > hersFinal ? 'his' : (hersFinal > hisFinal ? 'hers' : 'tie');

            // Save to history
            await addDoc(collection(db, 'couples', coupleCode.toLowerCase(), 'games', 'history', 'items'), {
                type: 'letter_link',
                winner: winner,
                wager: game.wager || '',
                hisScore: hisFinal,
                hersScore: hersFinal,
                completedAt: serverTimestamp()
            });

            // Delete active game
            await deleteDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId));

            setCurrentGameId(null);
            setPlacedTiles([]);
            setSelectedTileIndex(null);

            const winnerName = winner === 'tie' ? 'It\'s a tie!' :
                (winner === 'his' ? `${husbandName || 'Husband'} wins!` : `${wifeName || 'Wife'} wins!`);
            alert(`Game Over! ${winnerName}\n\nFinal Scores:\n${husbandName || 'Him'}: ${hisFinal}\n${wifeName || 'Her'}: ${hersFinal}`);
        } catch (err) {
            console.error('End game error:', err);
            alert('Failed to end game.');
        }
    };

    const submitGameAnswer = async (gameId, answer) => {
        const game = activeGames.find(g => g.id === gameId);
        if (!game || !answer || !coupleCode || !db) return;

        const isCorrect = answer.toUpperCase().trim() === game.word;
        const playerName = role === 'his' ? husbandName : wifeName;
        const scoreKey = role === 'his' ? 'hisScore' : 'hersScore';

        if (isCorrect) {
            try {
                // Calculate new score (defaults to 0 for old games without scores)
                const currentScore = (game[scoreKey] || 0) + 1;
                const targetScore = game.targetScore || 10;

                // Check if this player wins
                if (currentScore >= targetScore) {
                    // WINNER! Save to history and delete game
                    const historyRef = collection(db, 'couples', coupleCode.toLowerCase(), 'games', 'history', 'items');
                    await addDoc(historyRef, {
                        type: game.type,
                        wager: game.wager,
                        createdBy: game.createdBy,
                        creatorName: game.creatorName,
                        solvedBy: role,
                        solverName: playerName,
                        finalScoreHis: role === 'his' ? currentScore : (game.hisScore || 0),
                        finalScoreHers: role === 'hers' ? currentScore : (game.hersScore || 0),
                        points: currentScore,
                        completedAt: serverTimestamp()
                    });

                    await deleteDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId));
                    setCurrentGameId(null);

                    alert(`🏆 ${playerName} WINS! Final score: ${currentScore} - ${role === 'his' ? (game.hersScore || 0) : (game.hisScore || 0)}${game.wager ? `\n\n💝 Winner's reward: ${game.wager}` : ''}`);
                } else {
                    // Correct but game continues - generate new word
                    const words = new Set(['LOVE', 'KISS', 'HUG', 'HOME', 'TRUST', 'FOREVER', 'HEART', 'SMILE', 'DREAM', 'HAPPY']);
                    if (husbandName) words.add(husbandName.toUpperCase());
                    if (wifeName) words.add(wifeName.toUpperCase());
                    const personalWords = Array.from(words).filter(w => w.length >= 3 && w !== game.word);
                    const newWord = personalWords[Math.floor(Math.random() * personalWords.length)];
                    const newScrambled = scrambleWord(newWord);

                    await updateDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId), {
                        word: newWord,
                        scrambled: newScrambled,
                        [scoreKey]: currentScore,
                        currentTurn: role // Correct guesser goes again
                    });

                    setGameAnswer('');
                    alert(`✅ Correct! +1 point\n\n📊 Score: ${role === 'his' ? currentScore : (game.hisScore || 0)} - ${role === 'hers' ? currentScore : (game.hersScore || 0)}\n\n🎯 First to ${targetScore} wins!`);
                }
            } catch (err) {
                console.error('Submit answer error:', err);
            }
        } else {
            // Wrong answer - switch turns!
            const nextTurn = role === 'his' ? 'hers' : 'his';
            const nextPlayerName = role === 'his' ? (wifeName || 'Partner') : (husbandName || 'Partner');

            try {
                await updateDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId), {
                    currentTurn: nextTurn
                });
            } catch (err) {
                console.error('Update turn error:', err);
            }

            setGameAnswer('');
            alert(`❌ Wrong guess! It's now ${nextPlayerName}'s turn.`);
        }
    };

    const deleteActiveGame = async (gameId) => {
        if (!coupleCode || !db) return;
        if (!window.confirm('Delete this game? It will be removed for both players.')) return;
        try {
            await deleteDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId));
            if (currentGameId === gameId) setCurrentGameId(null);
        } catch (err) {
            console.error('Delete game error:', err);
        }
    };

    // LETTER LINK (Scrabble-like) LOGIC
    const createLetterLinkGame = async (wager = '') => {
        if (!coupleCode || !db || !role) return;

        // 11x11 Board (121 cells). null = empty. { char: 'A', owner: 'his' } = tile.
        const board = Array(121).fill(null);
        // Place center star
        // board[60] -> center (row 5, col 5 for 0-indexed)

        // Initial Bag
        // Distribution (simplified): E-12, A-9, I-9, O-8, N-6, R-6, T-6, L-4, S-4, U-4, D-4, G-3, B-2, C-2, M-2, P-2, F-2, H-2, V-2, W-2, Y-2, K-1, J-1, X-1, Q-1, Z-1, Blank-2
        const bagDist = { E: 12, A: 9, I: 9, O: 8, N: 6, R: 6, T: 6, L: 4, S: 4, U: 4, D: 4, G: 3, B: 2, C: 2, M: 2, P: 2, F: 2, H: 2, V: 2, W: 2, Y: 2, K: 1, J: 1, X: 1, Q: 1, Z: 1, '_': 2 };
        let bag = [];
        Object.entries(bagDist).forEach(([char, count]) => {
            for (let i = 0; i < count; i++) bag.push(char);
        });
        // Shuffle bag
        bag = bag.sort(() => Math.random() - 0.5);

        // Deal 7 tiles to creator
        const creatorHand = bag.splice(0, 7);
        const partnerHand = bag.splice(0, 7);

        try {
            const gamesRef = collection(db, 'couples', coupleCode.toLowerCase(), 'active_games');
            const docRef = await addDoc(gamesRef, {
                type: 'letter_link',
                wager: wager,
                createdBy: role,
                creatorName: role === 'his' ? husbandName : wifeName,
                createdAt: serverTimestamp(),
                currentTurn: role, // Creator starts? Or randomize? Let's say creator starts to place first word.
                board: JSON.stringify(board), // Store as string for simpler Firestore handling
                bag: bag,
                players: {
                    his: { hand: role === 'his' ? creatorHand : partnerHand, score: 0 },
                    hers: { hand: role === 'hers' ? creatorHand : partnerHand, score: 0 }
                },
                history: [] // Log of moves: { word: "HELLO", points: 14, player: 'his' }
            });
            alert('New game started! Good luck.');
            // Auto-open
            setCurrentGameId(docRef.id);
        } catch (err) {
            console.error('Create Letter Link error:', err);
            alert('Failed to start game.');
        }
    };

    // BATTLESHIP GAME LOGIC
    const createBattleshipGame = async (wager = '') => {
        if (!coupleCode || !db || !role) return;

        try {
            const gamesRef = collection(db, 'couples', coupleCode.toLowerCase(), 'active_games');
            const docRef = await addDoc(gamesRef, {
                type: 'battleship',
                wager: wager,
                createdBy: role,
                creatorName: role === 'his' ? husbandName : wifeName,
                createdAt: serverTimestamp(),
                phase: 'placing', // 'placing' | 'battle' | 'ended'
                currentTurn: role, // Who attacks next (during battle phase)
                players: {
                    his: { grid: JSON.stringify(createEmptyGrid()), attackGrid: JSON.stringify(createEmptyGrid()), ready: false, shipsRemaining: 5 },
                    hers: { grid: JSON.stringify(createEmptyGrid()), attackGrid: JSON.stringify(createEmptyGrid()), ready: false, shipsRemaining: 5 }
                },
                winner: null
            });
            alert('Battleship game created! Place your ships.');
            setCurrentGameId(docRef.id);
            // Reset local placement state
            setLocalShipPlacements({});
            setLocalPlacementGrid(createEmptyGrid());
            setBattleshipSelectedShip(null);
            setBattleshipPhase('placing');
        } catch (err) {
            console.error('Create Battleship error:', err);
            alert('Failed to start Battleship game.');
        }
    };

    const placeBattleshipShip = (row, col) => {
        if (!battleshipSelectedShip) {
            alert('Select a ship first!');
            return;
        }

        if (localShipPlacements[battleshipSelectedShip]) {
            alert(`${SHIPS[battleshipSelectedShip].name} already placed! Select another ship or tap "Ready".`);
            return;
        }

        if (!isValidPlacement(localPlacementGrid, battleshipSelectedShip, row, col, battleshipOrientation)) {
            alert('Invalid placement! Ships cannot overlap or go out of bounds.');
            return;
        }

        const newGrid = placeShipOnGrid(localPlacementGrid, battleshipSelectedShip, row, col, battleshipOrientation);
        setLocalPlacementGrid(newGrid);
        setLocalShipPlacements(prev => ({
            ...prev,
            [battleshipSelectedShip]: { row, col, orientation: battleshipOrientation }
        }));
        setBattleshipSelectedShip(null); // Deselect after placing
    };

    const confirmBattleshipPlacement = async (gameId) => {
        if (!hasPlacedAllShips(localPlacementGrid)) {
            alert('Place all 5 ships before confirming!');
            return;
        }

        try {
            const gameRef = doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId);
            const gameSnap = await getDoc(gameRef);
            if (!gameSnap.exists()) return;

            const gameData = gameSnap.data();
            const playerKey = role;

            // Update player's grid and mark as ready
            const updatedPlayers = { ...gameData.players };
            updatedPlayers[playerKey] = {
                ...updatedPlayers[playerKey],
                grid: JSON.stringify(localPlacementGrid),
                ready: true
            };

            // Check if both players are ready
            const otherPlayer = playerKey === 'his' ? 'hers' : 'his';
            const bothReady = updatedPlayers[otherPlayer].ready && updatedPlayers[playerKey].ready;

            await updateDoc(gameRef, {
                players: updatedPlayers,
                phase: bothReady ? 'battle' : 'placing',
                currentTurn: bothReady ? gameData.createdBy : gameData.currentTurn // Creator goes first in battle
            });

            if (bothReady) {
                alert('Both players ready! Battle begins!');
            } else {
                alert('Ships placed! Waiting for opponent...');
            }
        } catch (err) {
            console.error('Confirm placement error:', err);
            alert('Failed to confirm placement.');
        }
    };

    const attackBattleshipCell = async (gameId, row, col) => {
        try {
            const gameRef = doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId);
            const gameSnap = await getDoc(gameRef);
            if (!gameSnap.exists()) return;

            const gameData = gameSnap.data();

            if (gameData.currentTurn !== role) {
                alert("Not your turn!");
                return;
            }

            const opponentKey = role === 'his' ? 'hers' : 'his';
            const opponentGrid = JSON.parse(gameData.players[opponentKey].grid);
            const myAttackGrid = JSON.parse(gameData.players[role].attackGrid);

            // Check if already attacked
            if (myAttackGrid[row][col] !== null) {
                alert('Already attacked this cell!');
                return;
            }

            // Process attack on opponent's grid
            const { result, shipType, newGrid } = processAttack(opponentGrid, row, col);

            // Update my attack grid to show hit/miss
            myAttackGrid[row][col] = result === 'hit' || result === 'sunk' ? { hit: true } : 'miss';

            const updatedPlayers = { ...gameData.players };
            updatedPlayers[opponentKey].grid = JSON.stringify(newGrid);
            updatedPlayers[role].attackGrid = JSON.stringify(myAttackGrid);

            // Check for win
            const opponentAllSunk = checkAllShipsSunk(newGrid);
            const remainingShips = countRemainingShips(newGrid);
            updatedPlayers[opponentKey].shipsRemaining = remainingShips;

            let alertMsg = result === 'miss' ? '💨 Miss!' : result === 'sunk' ? `💥 You sunk their ${SHIPS[shipType].name}!` : '💥 Hit!';

            if (opponentAllSunk) {
                // Game over - current player wins
                await updateDoc(gameRef, {
                    players: updatedPlayers,
                    phase: 'ended',
                    winner: role,
                    currentTurn: null
                });

                // Add to game history
                const historyRef = collection(db, 'couples', coupleCode.toLowerCase(), 'games', 'history', 'items');
                await addDoc(historyRef, {
                    type: 'battleship',
                    word: 'Battleship Victory',
                    solvedBy: role,
                    solverName: role === 'his' ? husbandName : wifeName,
                    points: 50, // Battleship wins worth 50 points
                    completedAt: serverTimestamp(),
                    wager: gameData.wager || ''
                });

                alert('🎉 You won! All enemy ships destroyed!');
            } else {
                // Switch turns
                await updateDoc(gameRef, {
                    players: updatedPlayers,
                    currentTurn: opponentKey
                });
                alert(alertMsg);
            }

            // Send notification to opponent
            sendNotification(
                opponentAllSunk ? 'Game Over!' : "Your turn!",
                opponentAllSunk ? 'You lost the Battleship game!' : `Your opponent ${result === 'sunk' ? 'sunk your ship!' : result === 'hit' ? 'hit your ship!' : 'missed!'}`,
                'games'
            );

        } catch (err) {
            console.error('Attack error:', err);
            alert('Failed to attack.');
        }
    };

    const clearBridgeView = () => {
        if (window.confirm('Clear your bridge history? (This only clears your view, not your partner\'s)')) {
            const now = Date.now();
            setBridgeClearedAt(now);
            localStorage.setItem(`bridge_cleared_${role}`, now.toString());
        }
    };

    // Notification helpers
    const requestNotificationPermission = async () => {
        if (typeof Notification === 'undefined') {
            alert('Notifications are not supported on this browser.');
            return;
        }
        try {
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === 'granted') {
                try {
                    new Notification('Unity Bridge 💕', {
                        body: 'Notifications enabled! You\'ll be notified about games and messages.',
                        icon: '/favicon.ico'
                    });
                } catch (e) {
                    // Ignore initial test error if it happens, permission is what matters
                }
            } else {
                alert('Notifications were denied. Please enable them in your browser settings.');
            }
        } catch (err) {
            console.error('Notification permission error:', err);
            alert('Error requesting permission: ' + err.message);
        }
    };

    const sendNotification = async (title, body, type = 'general') => {
        if (typeof Notification === 'undefined') {
            if (type === 'general') alert('Notifications not supported: ' + title + '\n' + body);
            return;
        }

        if (notificationPermission !== 'granted') {
            if (type === 'general') alert('Please enable notifications first to see this test!');
            return;
        }

        if (type === 'games' && !notifyPrefs.games) return;
        if (type === 'bridge' && !notifyPrefs.bridge) return;
        if (type === 'dateReminder' && !notifyPrefs.dateReminders) return;
        if (type === 'messageReminder' && !notifyPrefs.messageReminders) return;

        try {
            // Use ServiceWorker for better mobile support if available
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                registration.showNotification(title, {
                    body: body,
                    icon: '/favicon.ico',
                    vibrate: [200, 100, 200]
                });
            } else {
                // Fallback for desktop/dev
                new Notification(title, { body, icon: '/favicon.ico' });
            }
        } catch (err) {
            console.error('Notification error:', err);
            if (type === 'general') {
                alert('Notification failed (browser restriction?):\n' + title + '\n' + body + '\n\nTry adding to Home Screen if on mobile.');
            }
        }
    };

    const updateNotifyPref = (key, value) => {
        const updated = { ...notifyPrefs, [key]: value };
        setNotifyPrefs(updated);
        localStorage.setItem('notify_prefs', JSON.stringify(updated));
    };

    // Filter bridge items based on user's clear timestamp
    const visibleBridgeItems = bridgeItems.filter(item => {
        if (!bridgeClearedAt) return true;
        const itemTimestamp = item.timestamp?.seconds ? item.timestamp.seconds * 1000 : 0;
        return itemTimestamp > bridgeClearedAt;
    });

    const copyToClipboard = (text, id) => {
        const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    };

    // --- RENDERS ---

    if (!app) return <div className="p-10 text-center font-sans">Connecting to your database...</div>;

    if (authError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-red-50 font-sans text-slate-800">
                <h1 className="text-xl font-black mb-4 text-red-600">Authentication Error</h1>
                <p className="text-sm mb-4">We couldn't sign you in automatically.</p>
                <div className="bg-white p-6 rounded-2xl shadow-sm text-left w-full max-w-md border border-red-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Likely Cause:</p>
                    <p className="text-sm text-slate-700 mb-4">
                        You need to enable <strong>Anonymous Authentication</strong> in your Firebase Console.
                    </p>
                    <ol className="list-decimal pl-4 space-y-2 text-sm text-slate-700">
                        <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">console.firebase.google.com</a></li>
                        <li>Click your project</li>
                        <li>Go to <strong>Authentication</strong> &gt; <strong>Sign-in method</strong></li>
                        <li>Enable <strong>Anonymous</strong></li>
                    </ol>
                </div>
                <button onClick={() => window.location.reload()} className="mt-6 bg-red-600 text-white py-3 px-6 rounded-xl font-bold">Try Again</button>
            </div>
        );
    }

    const renderHome = () => (
        <div className="flex flex-col items-center px-4 space-y-4 py-4">
            {/* Compact Header */}
            <div className="text-center space-y-1">
                <div className="bg-rose-100 p-4 rounded-full inline-block border-2 border-white shadow-lg">
                    <Heart className="w-8 h-8 text-rose-600 fill-rose-600" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tighter italic">
                    {portalMode === 'family' ? 'Family Bridge' : 'Unity Bridge'}
                </h1>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    {portalMode === 'family' ? 'Family Connection' : 'Relationship OS'}
                </p>
            </div>

            {/* Portal Selector */}
            <div className={`w-full flex p-1 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <button
                    onClick={() => { setPortalMode('couple'); localStorage.setItem('portal_mode', 'couple'); }}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1
                        ${portalMode === 'couple' ? 'bg-rose-600 text-white shadow-md' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                >
                    💑 Couple
                </button>
                <button
                    onClick={() => { setPortalMode('family'); localStorage.setItem('portal_mode', 'family'); }}
                    className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1
                        ${portalMode === 'family' ? 'bg-purple-600 text-white shadow-md' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                >
                    👨‍👩‍👧‍👦 Family
                </button>
            </div>

            {/* COUPLE PORTAL MODE */}
            {portalMode === 'couple' && (
                <>
                    {/* Settings Card - Compact */}
                    <div className={`w-full p-4 rounded-2xl shadow-lg border space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        {/* Names Row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-blue-500 uppercase ml-1">👤 Husband</label>
                                <input
                                    value={husbandName}
                                    onChange={(e) => { setHusbandName(e.target.value); localStorage.setItem('husband_name', e.target.value); saveSettings({ husbandName: e.target.value }); }}
                                    placeholder="Name"
                                    className={`w-full p-3 rounded-xl text-sm border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 focus:border-blue-300'}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-rose-500 uppercase ml-1">👤 Wife</label>
                                <input
                                    value={wifeName}
                                    onChange={(e) => { setWifeName(e.target.value); localStorage.setItem('wife_name', e.target.value); saveSettings({ wifeName: e.target.value }); }}
                                    placeholder="Name"
                                    className={`w-full p-3 rounded-xl text-sm border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 focus:border-rose-300'}`}
                                />
                            </div>
                        </div>

                        {/* Couple Code */}
                        <div className="space-y-1.5">
                            <label className={`text-[9px] font-black uppercase ml-1 flex items-center gap-1 ${darkMode ? 'text-purple-400' : 'text-purple-500'}`}>
                                <Lock className="w-3 h-3" /> Couple Code
                            </label>
                            <input
                                value={coupleCode}
                                onChange={(e) => { setCoupleCode(e.target.value); localStorage.setItem('couple_code', e.target.value); }}
                                placeholder="e.g. smith2024"
                                className={`w-full p-3 rounded-xl text-sm border outline-none text-center font-mono tracking-wider ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-purple-50 border-purple-100 focus:border-purple-300'}`}
                            />
                            <p className={`text-[8px] text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Same code on all devices to sync</p>
                        </div>
                    </div>

                    {/* Hub Buttons - Compact */}
                    <div className="grid grid-cols-2 w-full gap-3">
                        <button
                            onClick={() => { if (coupleCode) { setPendingParentRole('his'); setParentPinInput(''); setShowParentPinModal(true); } }}
                            className={`p-4 border rounded-2xl shadow-lg flex flex-col items-center gap-2 transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50'} ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                <User className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <h3 className={`text-sm font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Husband</h3>
                                <p className="text-[8px] text-blue-500 font-bold uppercase">Enter Hub</p>
                            </div>
                        </button>
                        <button
                            onClick={() => { if (coupleCode) { setPendingParentRole('hers'); setParentPinInput(''); setShowParentPinModal(true); } }}
                            className={`p-4 border rounded-2xl shadow-lg flex flex-col items-center gap-2 transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50'} ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                                <User className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <h3 className={`text-sm font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Wife</h3>
                                <p className="text-[8px] text-rose-500 font-bold uppercase">Enter Hub</p>
                            </div>
                        </button>
                    </div>
                    {!coupleCode && <p className="text-[9px] text-purple-500 font-bold">↑ Enter couple code to unlock</p>}
                </>
            )}

            {/* Parent PIN Modal - Global (works for both couple and family modes) */}
            {showParentPinModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-xs p-6 rounded-3xl shadow-2xl space-y-4 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                        <div className="text-center">
                            <span className="text-5xl">{pendingParentRole === 'his' ? '👨' : '👩'}</span>
                            <h3 className={`text-lg font-black mt-2 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {pendingParentRole === 'his' ? (husbandName || 'Husband') : (wifeName || 'Wife')}
                            </h3>
                            <p className="text-xs text-slate-400">Enter your 4-digit PIN</p>
                            <p className="text-[10px] text-slate-400 mt-1">(First time? Use 0000 to set up)</p>
                        </div>

                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={parentPinInput}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setParentPinInput(val);
                                if (val.length === 4) {
                                    const storedPin = localStorage.getItem(`${pendingParentRole}_pin`) || '0000';
                                    if (val === storedPin) {
                                        setRole(pendingParentRole);
                                        localStorage.setItem('user_role', pendingParentRole);
                                        setShowParentPinModal(false);
                                        setParentPinInput('');
                                        setPendingParentRole(null);
                                        if (portalMode === 'family') {
                                            setView('parent_hub');
                                        } else {
                                            setView('hub');
                                            setAffectionType('primary');
                                        }
                                    } else {
                                        alert('Wrong PIN! Try again.');
                                        setParentPinInput('');
                                    }
                                }
                            }}
                            className={`w-full p-4 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                            placeholder="••••"
                            autoFocus
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowParentPinModal(false); setParentPinInput(''); setPendingParentRole(null); }}
                                className="flex-1 py-3 bg-slate-200 text-slate-600 font-bold text-sm rounded-xl"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAMILY PORTAL MODE */}
            {portalMode === 'family' && (
                <>
                    {/* Family Code */}
                    <div className={`w-full p-4 rounded-2xl shadow-lg border space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <div className="space-y-1.5">
                            <label className={`text-[9px] font-black uppercase ml-1 flex items-center gap-1 ${darkMode ? 'text-purple-400' : 'text-purple-500'}`}>
                                <Lock className="w-3 h-3" /> Family Code
                            </label>
                            <input
                                value={coupleCode}
                                onChange={(e) => { setCoupleCode(e.target.value); localStorage.setItem('couple_code', e.target.value); }}
                                placeholder="e.g. smith"
                                className={`w-full p-3 rounded-xl text-sm border outline-none text-center font-mono tracking-wider ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-purple-50 border-purple-100 focus:border-purple-300'}`}
                            />
                            <p className={`text-[8px] text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Your family's shared code</p>
                        </div>
                    </div>

                    {/* Who's Using the App? */}
                    <div className={`w-full p-4 rounded-2xl shadow-lg border space-y-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <p className={`text-xs font-black text-center ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Who's using the app?</p>

                        {/* Parent Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => { if (coupleCode) { setPendingParentRole('his'); setParentPinInput(''); setShowParentPinModal(true); } }}
                                disabled={!coupleCode}
                                className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50'} ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-blue-50 border-blue-100'}`}
                            >
                                <span className="text-2xl">👨</span>
                                <span className="text-[10px] font-bold text-blue-600">{husbandName || 'Dad'}</span>
                            </button>
                            <button
                                onClick={() => { if (coupleCode) { setPendingParentRole('hers'); setParentPinInput(''); setShowParentPinModal(true); } }}
                                disabled={!coupleCode}
                                className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50'} ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-rose-50 border-rose-100'}`}
                            >
                                <span className="text-2xl">👩</span>
                                <span className="text-[10px] font-bold text-rose-600">{wifeName || 'Mom'}</span>
                            </button>
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-2">
                            <div className={`flex-1 h-px ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
                            <span className="text-[9px] text-slate-400 font-bold">KIDS</span>
                            <div className={`flex-1 h-px ${darkMode ? 'bg-slate-600' : 'bg-slate-200'}`}></div>
                        </div>

                        {/* Kid Profiles */}
                        {kidProfiles.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                                {kidProfiles.map((kid, i) => (
                                    <button
                                        key={kid.id || i}
                                        onClick={() => { setCurrentKid(kid); setKidPinInput(''); }}
                                        disabled={!coupleCode}
                                        className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50'} ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-purple-50 border-purple-100'}`}
                                    >
                                        <span className="text-2xl">{kid.avatar || '🧒'}</span>
                                        <span className="text-[10px] font-bold text-purple-600">{kid.name}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-[10px] text-slate-400 mb-2">No kid profiles yet</p>
                                <p className="text-[9px] text-slate-400">Parents: Enter as Mom or Dad to add kids</p>
                            </div>
                        )}
                    </div>

                    {/* Kid PIN Modal */}
                    {currentKid && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className={`w-full max-w-xs p-6 rounded-3xl shadow-2xl space-y-4 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                                <div className="text-center">
                                    <span className="text-5xl">{currentKid.avatar || '🧒'}</span>
                                    <h3 className={`text-lg font-black mt-2 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Hi, {currentKid.name}!</h3>
                                    <p className="text-xs text-slate-400">Enter your 4-digit PIN</p>
                                </div>

                                <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={kidPinInput}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                        setKidPinInput(val);
                                        // Auto-submit on 4 digits
                                        if (val.length === 4) {
                                            if (val === currentKid.pin) {
                                                setPortalMode('kid');
                                                localStorage.setItem('portal_mode', 'kid');
                                                localStorage.setItem('current_kid_id', currentKid.id);
                                                setView('kid_hub');
                                            } else {
                                                alert('Wrong PIN! Try again.');
                                                setKidPinInput('');
                                            }
                                        }
                                    }}
                                    className={`w-full p-4 text-center text-2xl font-mono tracking-[0.5em] rounded-xl border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                                    placeholder="••••"
                                    autoFocus
                                />

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setCurrentKid(null); setKidPinInput(''); }}
                                        className="flex-1 py-3 bg-slate-200 text-slate-600 font-bold text-sm rounded-xl"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!coupleCode && <p className="text-[9px] text-purple-500 font-bold">↑ Enter family code to unlock</p>}
                </>
            )}
        </div>
    );

    return (
        <div className={`fixed inset-0 w-full flex flex-col font-sans overflow-hidden select-none ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-[#FDF8F8] text-slate-900'}`} style={{ height: 'var(--app-height, 100vh)' }}>
            <header className={`shrink-0 h-16 w-full flex items-center justify-between px-6 z-50 shadow-sm ${darkMode ? 'bg-slate-800 border-b border-slate-700' : 'bg-white border-b border-rose-50'}`}>
                {view !== 'home' ? (
                    <button onClick={() => setView('home')} className={`p-2 rounded-xl transition-all ${darkMode ? 'active:bg-slate-700' : 'active:bg-slate-50'}`}><ChevronRight className={`w-6 h-6 rotate-180 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`} /></button>
                ) : <div className="w-10" />}
                <h1 className="text-xl font-black text-rose-600 flex items-center gap-2 tracking-tighter italic select-none"><Heart className="fill-rose-600 w-5 h-5" /> UNITY</h1>
                <div className="w-10" />
            </header>

            <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth touch-pan-y relative px-4">
                <div className="max-w-md mx-auto w-full h-full pb-24 pt-4">
                    {view === 'home' && renderHome()}

                    {view === 'hub' && (
                        <div className="space-y-6">
                            <div className={`flex gap-1 p-1.5 rounded-2xl border shadow-sm sticky top-0 z-10 ${darkMode ? 'bg-slate-800/90 border-slate-700 backdrop-blur-md' : 'bg-white/80 border-slate-100 backdrop-blur-md'}`}>
                                {[
                                    { id: 'affection', label: '💕 Love', short: '💕' },
                                    { id: 'communicate', label: '💬 Talk', short: '💬' },
                                    { id: 'journal', label: '📔 Journal', short: '📔' },
                                    { id: 'settings', label: '⚙️', short: '⚙️' }
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-2.5 px-1 text-[9px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === tab.id ? 'bg-rose-600 text-white shadow-lg' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {tab.id === 'settings' ? tab.label : tab.label}
                                    </button>
                                ))}
                            </div>

                            {activeTab === 'affection' && (() => {
                                const partnerLanguage = role === 'his' ? herLoveLanguage : hisLoveLanguage;
                                const partnerName = role === 'his' ? (wifeName || 'Her') : (husbandName || 'Him');
                                const primaryKeys = Object.keys(vaultMessages);
                                const secondaryKeys = Object.keys(touchIdeas);
                                const allPrimaryItems = primaryKeys.flatMap(k => (vaultMessages[k] || []).map(msg => ({ msg, cat: k })));
                                const allSecondaryItems = secondaryKeys.flatMap(k => (touchIdeas[k] || []).map(msg => ({ msg, cat: k })));
                                const currentItems = affectionType === 'primary' ? (vaultMessages[vaultStyle] || []) : (touchIdeas[vaultStyle] || []);
                                const currentKeys = affectionType === 'primary' ? primaryKeys : secondaryKeys;

                                return (
                                    <div className={`rounded-[2.5rem] shadow-xl border p-6 space-y-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-rose-50'}`}>
                                        <div className={`text-center pb-2 border-b ${darkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                            <p className={`text-[10px] font-bold uppercase ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>For {partnerName}'s Love Language:</p>
                                            <p className="text-lg font-black text-rose-600">{partnerLanguage}</p>
                                        </div>
                                        <div className={`flex p-1.5 rounded-2xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                                            <button onClick={() => { setAffectionType('primary'); setVaultStyle(primaryKeys[0] || ''); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${affectionType === 'primary' ? (darkMode ? 'bg-slate-600 text-rose-400 shadow-sm' : 'bg-white text-rose-600 shadow-sm') : (darkMode ? 'text-slate-400' : 'text-slate-400')}`}>Primary</button>
                                            <button onClick={() => { setAffectionType('secondary'); setVaultStyle(secondaryKeys[0] || ''); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${affectionType === 'secondary' ? (darkMode ? 'bg-slate-600 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm') : (darkMode ? 'text-slate-400' : 'text-slate-400')}`}>Secondary</button>
                                        </div>
                                        {currentKeys.length > 0 && (
                                            <div className={`flex gap-1.5 p-1 rounded-xl overflow-x-auto no-scrollbar ${darkMode ? 'bg-slate-700/50' : 'bg-slate-100/50'}`}>
                                                {currentKeys.map(s => (
                                                    <button key={s} onClick={() => setVaultStyle(s)} className={`flex-1 py-2 px-3 text-[8px] font-black uppercase whitespace-nowrap rounded-lg transition-all ${vaultStyle === s ? (darkMode ? 'bg-slate-600 shadow-sm text-rose-400' : 'bg-white shadow-sm text-rose-600') : (darkMode ? 'text-slate-400' : 'text-slate-400')}`}>{s}</button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            {currentItems.length > 0 ? currentItems.map((msg, i) => (
                                                <div key={i} className={`w-full p-6 rounded-[2rem] border relative transition-all ${darkMode ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 hover:border-rose-700' : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-rose-200'}`}>
                                                    <p className={`text-sm italic font-medium pr-12 leading-relaxed ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>"{msg}"</p>
                                                    <button
                                                        onClick={() => copyToClipboard(msg, `v-${i}`)}
                                                        className={`absolute top-4 right-4 p-2 rounded-xl border transition-all ${darkMode ? 'bg-slate-600 border-slate-500 hover:border-rose-500 hover:bg-rose-900/30' : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50'}`}
                                                    >
                                                        {copiedId === `v-${i}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`} />}
                                                    </button>
                                                </div>
                                            )) : (
                                                <div className={`text-center py-8 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                                                    <p className="text-sm">Tap "Get New Ideas" to load messages</p>
                                                    <p className="text-xs mt-1">tailored to {partnerName}'s love language</p>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={refreshVaults} disabled={isRefreshing} className={`w-full py-4 text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                                            <RefreshCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                                            {isRefreshing ? 'Generating...' : 'Get New Ideas'}
                                        </button>
                                    </div>
                                );
                            })()}

                            {activeTab === 'communicate' && (
                                <div className={`rounded-[2.5rem] shadow-xl border p-6 space-y-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-rose-50'}`}>
                                    <div className="flex items-center gap-3"><MessageCircle className="w-5 h-5 text-blue-500" /><h2 className={`font-black text-sm uppercase ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Communicate Better</h2></div>
                                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Draft your thought..." className={`w-full p-5 border rounded-3xl text-sm min-h-[140px] outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-orange-500/30' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-orange-50'}`} />
                                    <button onClick={translateMessage} disabled={isGenerating || !inputText} className="w-full bg-slate-900 text-white font-black py-4 rounded-3xl shadow-xl flex items-center justify-center gap-2">
                                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "TRANSLATE"}
                                    </button>
                                    {editableOutput && (
                                        <div className="space-y-4 pt-4 animate-in fade-in">
                                            <div className={`p-1 border-2 rounded-[2rem] overflow-hidden ${darkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-100'}`}>
                                                <textarea value={editableOutput} onChange={(e) => setEditableOutput(e.target.value)} className={`w-full p-6 bg-transparent text-sm italic font-medium outline-none min-h-[120px] ${darkMode ? 'text-slate-200' : 'text-slate-700'}`} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={() => saveToJournal()} className={`font-bold py-4 rounded-2xl text-[10px] flex items-center justify-center gap-2 border ${darkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>PRIVATE</button>
                                                <button onClick={saveToBridge} className="bg-green-600 text-white font-bold py-4 rounded-2xl text-[10px] flex items-center justify-center gap-2">SHARE</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'journal' && (
                                <div className={`rounded-[2.5rem] shadow-xl border p-6 space-y-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['feeling', 'ai_log', 'win', 'thought'].map(id => {
                                            const typeInfo = JOURNAL_TYPES[id];
                                            const TypeIcon = typeInfo.icon;
                                            const isActive = journalPrompt === id;
                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => setJournalPrompt(id)}
                                                    className={`p-4 border rounded-2xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all ${isActive ? `${typeInfo.bg} ${typeInfo.border} ${typeInfo.color}` : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'}`}
                                                >
                                                    <TypeIcon className="w-4 h-4" />
                                                    {typeInfo.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {journalPrompt && (
                                        <div className={`p-6 ${JOURNAL_TYPES[journalPrompt].bg} border ${JOURNAL_TYPES[journalPrompt].border} rounded-3xl space-y-3`}>
                                            <div className={`flex items-center gap-2 ${JOURNAL_TYPES[journalPrompt].color} mb-2`}>
                                                {(() => { const Icon = JOURNAL_TYPES[journalPrompt].icon; return <Icon className="w-5 h-5" />; })()}
                                                <span className="text-sm font-black uppercase tracking-wider">Recording {JOURNAL_TYPES[journalPrompt].label}</span>
                                            </div>
                                            <textarea id="studio-input" placeholder={`What ${JOURNAL_TYPES[journalPrompt].label.toLowerCase()} would you like to capture?`} className={`w-full p-5 bg-white border ${JOURNAL_TYPES[journalPrompt].border} rounded-2xl text-xs min-h-[120px] outline-none focus:ring-2 focus:ring-opacity-50`} />
                                            <button onClick={() => { const val = document.getElementById('studio-input').value; saveToJournal(val, { type: journalPrompt }); }} className={`w-full ${JOURNAL_TYPES[journalPrompt].color.replace('text-', 'bg-').replace('-600', '-600')} text-white py-3 rounded-xl text-[10px] font-black shadow-lg`} style={{ backgroundColor: journalPrompt === 'feeling' ? '#9333ea' : journalPrompt === 'ai_log' ? '#2563eb' : journalPrompt === 'win' ? '#16a34a' : '#d97706' }}>SAVE {JOURNAL_TYPES[journalPrompt].label.toUpperCase()}</button>
                                        </div>
                                    )}
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex justify-between items-center flex-wrap gap-2">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Entries</h3>
                                            <div className="flex gap-2 flex-wrap">
                                                <button
                                                    onClick={generateWeeklySummary}
                                                    disabled={isGenerating}
                                                    className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full uppercase flex items-center gap-1 hover:bg-blue-100 transition-all disabled:opacity-50"
                                                >
                                                    <Calendar className="w-3 h-3" />
                                                    Weekly
                                                </button>
                                                <button
                                                    onClick={generateJournalInsights}
                                                    disabled={isGenerating || journalItems.length === 0}
                                                    className="text-[9px] font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full uppercase flex items-center gap-1 hover:bg-purple-100 transition-all disabled:opacity-50"
                                                >
                                                    <Sparkles className="w-3 h-3" />
                                                    Insights
                                                </button>
                                                <button
                                                    onClick={exportJournalData}
                                                    disabled={journalItems.length === 0}
                                                    className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full uppercase flex items-center gap-1 hover:bg-green-100 transition-all disabled:opacity-50"
                                                >
                                                    <Save className="w-3 h-3" />
                                                    Export
                                                </button>
                                            </div>
                                        </div>
                                        {/* Weekly Summary Display */}
                                        {weeklySummary && (
                                            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-blue-600 uppercase">Weekly Summary</span>
                                                    <span className="text-xl">{weeklySummary.mood === 'positive' || weeklySummary.mood === 'happy' ? '😊' : weeklySummary.mood === 'stressed' ? '😰' : '💭'}</span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-700">Mood: {weeklySummary.mood}</p>
                                                {weeklySummary.highlights && (
                                                    <div>
                                                        <p className="text-[9px] font-bold text-green-600 uppercase">Highlights:</p>
                                                        <ul className="text-xs text-slate-600 list-disc pl-4">{weeklySummary.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
                                                    </div>
                                                )}
                                                {weeklySummary.encouragement && (
                                                    <p className="text-xs italic text-purple-600">{weeklySummary.encouragement}</p>
                                                )}
                                            </div>
                                        )}
                                        {/* Search and Filter */}
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                value={journalSearchText}
                                                onChange={(e) => setJournalSearchText(e.target.value)}
                                                placeholder="Search..."
                                                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-purple-300"
                                            />
                                            <select
                                                value={journalFilterType}
                                                onChange={(e) => setJournalFilterType(e.target.value)}
                                                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none min-w-[80px]"
                                            >
                                                <option value="all">All</option>
                                                <option value="feeling">Feeling</option>
                                                <option value="ai_log">AI Log</option>
                                                <option value="win">Win</option>
                                                <option value="thought">Thought</option>
                                            </select>
                                        </div>
                                        {journalItems
                                            .filter(item => {
                                                const matchesSearch = !journalSearchText || item.content?.toLowerCase().includes(journalSearchText.toLowerCase());
                                                const matchesType = journalFilterType === 'all' || item.type === journalFilterType;
                                                return matchesSearch && matchesType;
                                            })
                                            .map(item => {
                                                const typeInfo = item.type ? JOURNAL_TYPES[item.type] : null;
                                                const TypeIcon = typeInfo?.icon;
                                                return (
                                                    <div key={item.id} className={`p-5 bg-white border rounded-3xl shadow-sm ${typeInfo ? typeInfo.border : 'border-slate-100'}`}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'Now'}</span>
                                                            {typeInfo && (
                                                                <span className={`flex items-center gap-1 text-[8px] font-black uppercase px-2 py-1 rounded-full ${typeInfo.bg} ${typeInfo.color}`}>
                                                                    <TypeIcon className="w-3 h-3" />
                                                                    {typeInfo.label}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {/* Edit Mode */}
                                                        {editingJournalId === item.id ? (
                                                            <div className="space-y-2">
                                                                <textarea
                                                                    value={editingJournalContent}
                                                                    onChange={(e) => setEditingJournalContent(e.target.value)}
                                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs min-h-[80px] outline-none focus:border-purple-300"
                                                                />
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => updateJournalEntry(item.id, editingJournalContent)}
                                                                        className="flex-1 py-2 text-[9px] font-bold text-white bg-green-600 rounded-xl"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setEditingJournalId(null); setEditingJournalContent(''); }}
                                                                        className="flex-1 py-2 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-xl"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="text-xs text-slate-600 italic leading-relaxed mb-3">"{item.content}"</p>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => { setEditingJournalId(item.id); setEditingJournalContent(item.content); }}
                                                                        className="py-2 px-3 text-[9px] font-bold text-blue-500 bg-blue-50 rounded-xl flex items-center justify-center gap-1 hover:bg-blue-100 transition-all"
                                                                    >
                                                                        <Edit3 className="w-3 h-3" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => copyToClipboard(item.content, `j-${item.id}`)}
                                                                        className="flex-1 py-2 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center justify-center gap-1 hover:bg-slate-200 transition-all"
                                                                    >
                                                                        {copiedId === `j-${item.id}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                                        {copiedId === `j-${item.id}` ? 'Copied!' : 'Copy'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => saveToBridge(item.content)}
                                                                        className="flex-1 py-2 text-[9px] font-bold text-white bg-green-600 rounded-xl flex items-center justify-center gap-1 hover:bg-green-700 transition-all"
                                                                    >
                                                                        <Share2 className="w-3 h-3" />
                                                                        Share
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteFromJournal(item.id)}
                                                                        className="py-2 px-3 text-[9px] font-bold text-red-500 bg-red-50 rounded-xl flex items-center justify-center gap-1 hover:bg-red-100 transition-all"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* NEW: Settings Tab */}
                            {activeTab === 'settings' && (
                                <div className={`rounded-[2.5rem] shadow-xl border p-6 space-y-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <Settings className="w-5 h-5 text-slate-500" />
                                        <h2 className={`font-black text-sm uppercase ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Settings & Stats</h2>
                                    </div>

                                    {/* Anniversary Date */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-pink-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                                            <Heart className="w-3 h-3" /> Anniversary Date
                                        </label>
                                        <input
                                            type="date"
                                            value={anniversaryDate}
                                            onChange={(e) => saveAnniversary(e.target.value)}
                                            className={`w-full p-4 rounded-2xl text-sm border outline-none text-center ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-pink-50 border-pink-100 focus:border-pink-300'}`}
                                        />
                                        {getDaysTogether() !== null && (
                                            <div className="text-center py-4 bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl">
                                                <p className="text-4xl font-black text-white">{getDaysTogether().toLocaleString()}</p>
                                                <p className="text-[10px] font-bold text-pink-100 uppercase">Days Together 💕</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Dark Mode Toggle */}
                                    <div className={`flex items-center justify-between p-4 rounded-2xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                                        <div className="flex items-center gap-3">
                                            <Moon className={`w-5 h-5 ${darkMode ? 'text-yellow-400' : 'text-slate-500'}`} />
                                            <span className={`text-sm font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Dark Mode</span>
                                        </div>
                                        <button
                                            onClick={() => { const newVal = !darkMode; setDarkMode(newVal); localStorage.setItem('dark_mode', newVal.toString()); }}
                                            className={`w-14 h-7 rounded-full transition-all ${darkMode ? 'bg-yellow-500' : 'bg-slate-300'} relative`}
                                        >
                                            <div className={`w-6 h-6 rounded-full bg-white shadow absolute top-0.5 transition-all ${darkMode ? 'left-7' : 'left-0.5'}`} />
                                        </button>
                                    </div>

                                    {/* Pet Names */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className={`text-[9px] font-black uppercase ml-1 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>💕 His Pet Name</label>
                                            <input
                                                value={husbandPetName}
                                                onChange={(e) => { setHusbandPetName(e.target.value); localStorage.setItem('husband_pet_name', e.target.value); saveSettings({ husbandPetName: e.target.value }); }}
                                                placeholder="e.g. honey, babe"
                                                className={`w-full p-2.5 rounded-xl text-xs border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-blue-50 border-blue-100 focus:border-blue-300'}`}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className={`text-[9px] font-black uppercase ml-1 ${darkMode ? 'text-rose-400' : 'text-rose-500'}`}>💕 Her Pet Name</label>
                                            <input
                                                value={wifePetName}
                                                onChange={(e) => { setWifePetName(e.target.value); localStorage.setItem('wife_pet_name', e.target.value); saveSettings({ wifePetName: e.target.value }); }}
                                                placeholder="e.g. sweetie, love"
                                                className={`w-full p-2.5 rounded-xl text-xs border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-rose-50 border-rose-100 focus:border-rose-300'}`}
                                            />
                                        </div>
                                    </div>

                                    {/* Love Languages */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-blue-400 uppercase ml-1">💙 His Language</label>
                                            <select
                                                value={hisLoveLanguage}
                                                onChange={(e) => { setHisLoveLanguage(e.target.value); localStorage.setItem('his_love_language', e.target.value); saveSettings({ hisLoveLanguage: e.target.value }); }}
                                                className={`w-full p-2.5 rounded-xl text-xs border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-blue-50 border-blue-100'}`}
                                            >
                                                <option>Physical Touch</option>
                                                <option>Words of Affirmation</option>
                                                <option>Quality Time</option>
                                                <option>Acts of Service</option>
                                                <option>Receiving Gifts</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-rose-400 uppercase ml-1">💗 Her Language</label>
                                            <select
                                                value={herLoveLanguage}
                                                onChange={(e) => { setHerLoveLanguage(e.target.value); localStorage.setItem('her_love_language', e.target.value); saveSettings({ herLoveLanguage: e.target.value }); }}
                                                className={`w-full p-2.5 rounded-xl text-xs border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-rose-50 border-rose-100'}`}
                                            >
                                                <option>Words of Affirmation</option>
                                                <option>Physical Touch</option>
                                                <option>Quality Time</option>
                                                <option>Acts of Service</option>
                                                <option>Receiving Gifts</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Family Management */}
                                    <button
                                        onClick={() => setShowKidManager(true)}
                                        className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${darkMode ? 'bg-purple-900/50 text-purple-400 border border-purple-700' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}
                                    >
                                        <Users className="w-4 h-4" />
                                        👨‍👩‍👧‍👦 Manage Kids
                                    </button>

                                    {/* Change PIN */}
                                    <button
                                        onClick={() => {
                                            const newPin = prompt('Enter new 4-digit PIN:');
                                            if (newPin && /^\d{4}$/.test(newPin)) {
                                                localStorage.setItem(`${role}_pin`, newPin);
                                                alert('PIN updated successfully!');
                                            } else if (newPin !== null) {
                                                alert('Please enter exactly 4 digits.');
                                            }
                                        }}
                                        className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-700 text-slate-300 border border-slate-600' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
                                    >
                                        <Lock className="w-4 h-4" />
                                        🔐 Change My PIN
                                    </button>

                                    {/* Milestones */}
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-amber-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                                            <Trophy className="w-3 h-3" /> Milestones Earned
                                        </p>
                                        {checkMilestones().length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {checkMilestones().map(m => (
                                                    <span key={m.id} className={`px-4 py-2 border rounded-2xl text-xs font-bold ${darkMode ? 'bg-amber-900/30 border-amber-700 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                                        {m.emoji} {m.label}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className={`text-sm italic ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Keep journaling and sharing to earn badges!</p>
                                        )}
                                    </div>

                                    {/* Export Button */}
                                    <button
                                        onClick={exportJournalData}
                                        disabled={journalItems.length === 0}
                                        className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${darkMode ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-green-50 text-green-600 border border-green-200'} disabled:opacity-50`}
                                    >
                                        <Save className="w-4 h-4" />
                                        Export Journal Data
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'bridge' && (
                        <div className="p-3 space-y-3 animate-in slide-in-from-bottom-4 duration-300">
                            {/* Quick Actions Row */}
                            <div className="flex gap-2">
                                <button onClick={() => saveToBridge("I'm feeling flooded and need a 20-minute timeout. I love you.")} className="flex-1 bg-slate-900 text-white font-bold py-3 px-4 rounded-2xl shadow-lg active:scale-95 text-xs flex items-center justify-center gap-2 border border-white/10">
                                    <Wind className="w-4 h-4 text-blue-400" /> Signal Timeout
                                </button>
                                <button onClick={() => setView('resolve')} className="bg-orange-500 text-white font-bold py-3 px-4 rounded-2xl shadow-lg active:scale-95 text-xs flex items-center justify-center gap-2">
                                    <Anchor className="w-4 h-4" /> Resolve
                                </button>
                            </div>

                            {/* Relationship Analysis for Counselor */}
                            <div className={`rounded-2xl shadow-lg border p-4 space-y-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-rose-100'}`}>
                                <div className="flex justify-between items-center">
                                    <h2 className={`text-xs font-black uppercase flex items-center gap-2 ${darkMode ? 'text-rose-400' : 'text-rose-600'}`}>
                                        📊 Relationship Analysis
                                    </h2>
                                    <button
                                        onClick={generatePulse}
                                        disabled={isGenerating || bridgeItems.length === 0}
                                        className={`text-[9px] font-bold px-3 py-1.5 rounded-full uppercase flex items-center gap-1 ${isGenerating ? 'opacity-50' : ''} ${darkMode ? 'bg-rose-900/50 text-rose-400 border border-rose-700' : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'}`}
                                    >
                                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                                        {isGenerating ? 'Analyzing...' : 'Generate Report'}
                                    </button>
                                </div>

                                {/* Time Filter Buttons */}
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { id: '7days', label: '7 Days' },
                                        { id: '14days', label: '14 Days' },
                                        { id: 'workweek', label: 'Work Week' },
                                        { id: 'weekend', label: 'Weekend' },
                                        { id: 'all', label: 'All Time' }
                                    ].map(filter => (
                                        <button
                                            key={filter.id}
                                            onClick={() => setAnalysisTimeFilter(filter.id)}
                                            className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase transition-all ${analysisTimeFilter === filter.id
                                                ? 'bg-rose-600 text-white'
                                                : darkMode
                                                    ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>

                                {pulse && (
                                    <div className="space-y-3">
                                        {/* Health Score */}
                                        <div className="flex items-center gap-3">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black ${(pulse.healthScore >= 7) ? 'bg-green-100 text-green-600' :
                                                (pulse.healthScore >= 4) ? 'bg-yellow-100 text-yellow-600' :
                                                    'bg-red-100 text-red-600'
                                                }`}>
                                                {pulse.healthScore}/10
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-lg font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{pulse.overallTone}</p>
                                                <p className={`text-[10px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{pulse.communicationStyle}</p>
                                            </div>
                                        </div>

                                        {/* Strengths */}
                                        {pulse.strengths && pulse.strengths.length > 0 && (
                                            <div className={`p-3 rounded-xl ${darkMode ? 'bg-green-900/30 border border-green-800' : 'bg-green-50 border border-green-100'}`}>
                                                <p className="text-[9px] font-black text-green-600 uppercase mb-1.5">💪 Strengths</p>
                                                <ul className="space-y-1">
                                                    {pulse.strengths.map((s, i) => (
                                                        <li key={i} className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-700'}`}>• {s}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Areas for Growth */}
                                        {pulse.areasForGrowth && pulse.areasForGrowth.length > 0 && (
                                            <div className={`p-3 rounded-xl ${darkMode ? 'bg-amber-900/30 border border-amber-800' : 'bg-amber-50 border border-amber-100'}`}>
                                                <p className="text-[9px] font-black text-amber-600 uppercase mb-1.5">🌱 Areas for Growth</p>
                                                <ul className="space-y-1">
                                                    {pulse.areasForGrowth.map((a, i) => (
                                                        <li key={i} className={`text-xs ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>• {a}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Patterns */}
                                        {pulse.patterns && (
                                            <div className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}>
                                                <p className={`text-[9px] font-black uppercase mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>🔄 Patterns Observed</p>
                                                <p className={`text-xs ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{pulse.patterns}</p>
                                            </div>
                                        )}

                                        {/* Recommendation */}
                                        {pulse.recommendation && (
                                            <div className={`p-3 rounded-xl ${darkMode ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50 border border-blue-100'}`}>
                                                <p className="text-[9px] font-black text-blue-600 uppercase mb-1">💡 Counselor Recommendation</p>
                                                <p className={`text-xs ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>{pulse.recommendation}</p>
                                            </div>
                                        )}

                                        {/* Share with Counselor Button */}
                                        <div className="flex gap-2 pt-2">
                                            <button
                                                onClick={() => {
                                                    const report = `UNITY BRIDGE - Relationship Analysis Report
═══════════════════════════════════════
Couple: ${husbandName || 'Husband'} & ${wifeName || 'Wife'}
Generated: ${new Date().toLocaleDateString()}

HEALTH SCORE: ${pulse.healthScore}/10
EMOTIONAL TONE: ${pulse.overallTone}
COMMUNICATION STYLE: ${pulse.communicationStyle}

STRENGTHS:
${pulse.strengths?.map(s => `  ✓ ${s}`).join('\n') || 'N/A'}

AREAS FOR GROWTH:
${pulse.areasForGrowth?.map(a => `  • ${a}`).join('\n') || 'N/A'}

PATTERNS OBSERVED:
${pulse.patterns || 'N/A'}

RECOMMENDATION:
${pulse.recommendation || 'N/A'}

───────────────────────────────────────
Generated by Unity Bridge - Relationship OS`;
                                                    navigator.clipboard.writeText(report);
                                                    alert('Report copied to clipboard! You can paste it into an email or document to share with your counselor.');
                                                }}
                                                className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-700 text-slate-300 border border-slate-600' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
                                            >
                                                <Copy className="w-3 h-3" /> Copy Report
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const report = encodeURIComponent(`UNITY BRIDGE - Relationship Analysis Report\n\nCouple: ${husbandName || 'Husband'} & ${wifeName || 'Wife'}\nGenerated: ${new Date().toLocaleDateString()}\n\nHEALTH SCORE: ${pulse.healthScore}/10\nEMOTIONAL TONE: ${pulse.overallTone}\nCOMMUNICATION STYLE: ${pulse.communicationStyle}\n\nSTRENGTHS:\n${pulse.strengths?.map(s => `  ✓ ${s}`).join('\n') || 'N/A'}\n\nAREAS FOR GROWTH:\n${pulse.areasForGrowth?.map(a => `  • ${a}`).join('\n') || 'N/A'}\n\nPATTERNS OBSERVED:\n${pulse.patterns || 'N/A'}\n\nRECOMMENDATION:\n${pulse.recommendation || 'N/A'}`);
                                                    window.open(`mailto:?subject=Unity Bridge - Relationship Analysis Report&body=${report}`);
                                                }}
                                                className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 bg-blue-600 text-white"
                                            >
                                                <Send className="w-3 h-3" /> Email to Counselor
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!pulse && (
                                    <p className={`text-xs text-center py-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Tap "Generate Report" to create a counselor-ready analysis of your recent communication
                                    </p>
                                )}
                            </div>

                            {/* Shared History - Compact */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <h2 className={`text-lg font-black tracking-tight ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Shared History</h2>
                                    <button onClick={clearBridgeView} className={`text-[8px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${darkMode ? 'text-slate-400 bg-slate-700' : 'text-slate-500 bg-slate-100'} hover:bg-red-100 hover:text-red-500`}>
                                        <Trash2 className="w-3 h-3" /> Clear
                                    </button>
                                </div>
                                {visibleBridgeItems.length === 0 ? (
                                    <div className={`text-center py-6 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        <p className="text-xs">No messages yet</p>
                                        <p className="text-[10px] mt-0.5">Share from the hub to start!</p>
                                    </div>
                                ) : (
                                    visibleBridgeItems.map(item => (
                                        <div key={item.id} className={`p-4 rounded-2xl border relative ${item.author === role ? (darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200') : (darkMode ? 'bg-rose-900/20 border-rose-800' : 'bg-rose-50/50 border-rose-200')}`}>
                                            <div className="flex justify-between mb-1">
                                                <span className={`text-[9px] font-black uppercase ${item.author === 'his' ? 'text-blue-500' : 'text-rose-500'}`}>{item.author === 'his' ? husbandName : wifeName}</span>
                                                {item.author === role && (
                                                    <button onClick={() => deleteFromBridge(item.id)} className="text-red-400 hover:text-red-600">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <p className={`text-sm italic font-medium leading-snug ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>"{item.content}"</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'date' && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4">
                            <div className="text-center space-y-2 pt-2">
                                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto border-2 border-white shadow-lg">
                                    <Heart className="w-8 h-8 text-pink-600" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Date Night</h2>
                                <p className="text-xs text-slate-400">AI-generated date ideas just for you two</p>
                            </div>

                            <div className="bg-white rounded-[2rem] shadow-xl border border-pink-100 p-4 space-y-3">
                                <h3 className="text-[10px] font-black text-pink-600 uppercase tracking-widest text-center">Select Your Budget</h3>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {[{ id: 'free', label: 'Free', emoji: '🆓' }, { id: 'cheap', label: '<$30', emoji: '💵' }, { id: 'moderate', label: '$30-75', emoji: '💳' }, { id: 'splurge', label: '$75+', emoji: '✨' }].map(budget => (
                                        <button
                                            key={budget.id}
                                            onClick={() => generateDateNight(budget.id)}
                                            disabled={isGenerating}
                                            className="p-2 bg-slate-50 hover:bg-pink-50 border border-slate-200 hover:border-pink-200 rounded-xl text-center transition-all disabled:opacity-50"
                                        >
                                            <span className="text-xl block">{budget.emoji}</span>
                                            <span className="text-[8px] font-bold text-slate-600 leading-tight block">{budget.label}</span>
                                        </button>
                                    ))}
                                </div>
                                {isGenerating && (
                                    <div className="text-center py-4 text-pink-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        <p className="text-xs font-bold">Planning romantic ideas...</p>
                                    </div>
                                )}
                            </div>

                            {dateIdeas.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-lg font-black text-slate-800 px-2">Your Date Ideas</h3>
                                    {dateIdeas.map((date, i) => (
                                        <div key={i} className="bg-white rounded-[2.5rem] shadow-xl border border-pink-100 p-6 space-y-4">
                                            <div className="flex items-start justify-between">
                                                <h4 className="text-lg font-black text-slate-800">{date.title}</h4>
                                                <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-full">{date.cost}</span>
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed">{date.description}</p>
                                            <div className="p-4 bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl border border-pink-100">
                                                <p className="text-[10px] font-black text-pink-600 uppercase mb-1">💡 Love Language Tip</p>
                                                <p className="text-xs text-slate-700 italic">{date.tip}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => copyToClipboard(`${date.title}: ${date.description}`, `d-${i}`)}
                                                    className="flex-1 py-3 text-[9px] font-bold text-slate-500 bg-slate-100 rounded-xl flex items-center justify-center gap-1"
                                                >
                                                    {copiedId === `d-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                    {copiedId === `d-${i}` ? 'Copied!' : 'Copy'}
                                                </button>
                                                <button
                                                    onClick={() => saveToBridge(`Date idea: ${date.title} - ${date.description}`)}
                                                    className="flex-1 py-3 text-[9px] font-bold text-white bg-pink-600 rounded-xl flex items-center justify-center gap-1"
                                                >
                                                    <Share2 className="w-3 h-3" />
                                                    Share
                                                </button>
                                            </div>
                                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                                <a
                                                    href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Date Night: ${date.title}`)}&details=${encodeURIComponent(`${date.description}\n\n💡 Tip: ${date.tip}\n\nBudget: ${date.cost}`)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex-1 py-3 text-[9px] font-bold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-1"
                                                >
                                                    <Calendar className="w-3 h-3" />
                                                    Google Calendar
                                                </a>
                                                <button
                                                    onClick={() => copyToClipboard(`Date Night: ${date.title}\n${date.description}\n\n💡 ${date.tip}\n\nBudget: ${date.cost}`, `cal-${i}`)}
                                                    className="flex-1 py-3 text-[9px] font-bold text-slate-600 bg-slate-100 rounded-xl flex items-center justify-center gap-1"
                                                >
                                                    {copiedId === `cal-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Calendar className="w-3 h-3" />}
                                                    {copiedId === `cal-${i}` ? 'Copied!' : 'iPhone Copy'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'resolve' && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4">
                            <div className="text-center space-y-2 pt-2">
                                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto border-2 border-white shadow-lg">
                                    <Anchor className="w-8 h-8 text-orange-600" />
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Support Center</h2>
                                <p className="text-xs text-slate-400">Let's figure out what you need right now</p>
                            </div>

                            {/* Step 1: How are you feeling? */}
                            {resolveStep === 'feeling' && (
                                <div className="bg-white rounded-[2rem] shadow-xl border border-orange-100 p-6 space-y-4">
                                    <h3 className="text-sm font-black text-slate-700 text-center">How are you feeling right now?</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'frustrated', emoji: '😤', label: 'Frustrated' },
                                            { id: 'hurt', emoji: '😔', label: 'Hurt/Sad' },
                                            { id: 'overwhelmed', emoji: '😰', label: 'Overwhelmed' },
                                            { id: 'confused', emoji: '🤔', label: 'Need Clarity' },
                                            { id: 'disconnected', emoji: '💔', label: 'Disconnected' },
                                            { id: 'fine', emoji: '🙂', label: 'I\'m okay' }
                                        ].map(feeling => (
                                            <button
                                                key={feeling.id}
                                                onClick={() => { setResolveFeeling(feeling); setResolveStep('need'); }}
                                                className="p-4 bg-slate-50 hover:bg-orange-50 border-2 border-slate-200 hover:border-orange-300 rounded-2xl text-center transition-all"
                                            >
                                                <span className="text-3xl block mb-1">{feeling.emoji}</span>
                                                <span className="text-xs font-bold text-slate-600">{feeling.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Step 2: What do you need? */}
                            {resolveStep === 'need' && (
                                <div className="bg-white rounded-[2rem] shadow-xl border border-orange-100 p-6 space-y-4">
                                    <div className="text-center mb-4">
                                        <span className="text-3xl">{resolveFeeling?.emoji}</span>
                                        <p className="text-sm font-bold text-slate-600 mt-1">You're feeling {resolveFeeling?.label?.toLowerCase()}</p>
                                    </div>
                                    <h3 className="text-sm font-black text-slate-700 text-center">What do you need right now?</h3>
                                    <div className="space-y-3">
                                        {[
                                            { id: 'vent', emoji: '📝', label: 'I need to vent/process my feelings', desc: 'Private journaling' },
                                            { id: 'communicate', emoji: '💬', label: 'I need help saying something', desc: 'AI-assisted messaging' },
                                            { id: 'resolve', emoji: '⚓', label: 'We need to work through something together', desc: 'Guided conflict resolution' },
                                            { id: 'encourage', emoji: '🤗', label: 'I just need some encouragement', desc: 'AI-generated support' }
                                        ].map(need => (
                                            <button
                                                key={need.id}
                                                onClick={() => { setResolveNeed(need); setResolveStep(need.id === 'communicate' ? 'topic' : 'action'); }}
                                                className="w-full p-4 bg-slate-50 hover:bg-orange-50 border-2 border-slate-200 hover:border-orange-300 rounded-2xl text-left transition-all flex items-center gap-4"
                                            >
                                                <span className="text-2xl">{need.emoji}</span>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">{need.label}</p>
                                                    <p className="text-[10px] text-slate-400">{need.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={() => setResolveStep('feeling')} className="w-full py-2 text-xs text-slate-400 font-bold">← Back</button>
                                </div>
                            )}

                            {/* Step 3: Topic input (for communicate) */}
                            {resolveStep === 'topic' && (
                                <div className="bg-white rounded-[2rem] shadow-xl border border-orange-100 p-6 space-y-4">
                                    <div className="text-center mb-2">
                                        <span className="text-3xl">💬</span>
                                        <p className="text-sm font-bold text-slate-600 mt-1">Let's help you communicate</p>
                                    </div>
                                    <h3 className="text-sm font-black text-slate-700 text-center">What topic are you struggling to discuss?</h3>
                                    <textarea
                                        value={resolveTopic}
                                        onChange={(e) => setResolveTopic(e.target.value)}
                                        placeholder="e.g., I want to talk about how we handle finances, or I need to express that I felt hurt yesterday..."
                                        className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm min-h-[100px] outline-none focus:border-orange-300"
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => setResolveStep('need')} className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl">← Back</button>
                                        <button
                                            onClick={() => {
                                                // Navigate to Talk tab with pre-filled content
                                                setInputText(`I want to talk about: ${resolveTopic}\n\nI'm feeling ${resolveFeeling?.label?.toLowerCase()} and need help expressing this.`);
                                                setView('hub');
                                                setActiveTab('communicate');
                                                setResolveStep('feeling');
                                                setResolveFeeling(null);
                                                setResolveNeed(null);
                                                setResolveTopic('');
                                            }}
                                            disabled={!resolveTopic.trim()}
                                            className="flex-1 py-3 text-sm font-bold text-white bg-orange-500 rounded-xl disabled:opacity-50"
                                        >
                                            Get AI Help →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 4: Action based on need */}
                            {resolveStep === 'action' && (
                                <div className="bg-white rounded-[2rem] shadow-xl border border-orange-100 p-6 space-y-4">
                                    {resolveNeed?.id === 'vent' && (
                                        <>
                                            <div className="text-center">
                                                <span className="text-4xl">📝</span>
                                                <h3 className="text-lg font-black text-slate-700 mt-2">Time to process</h3>
                                                <p className="text-sm text-slate-500 mt-1">Writing down your feelings can help you understand them better.</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setView('hub');
                                                    setActiveTab('journal');
                                                    setJournalPrompt('feeling');
                                                    setResolveStep('feeling');
                                                    setResolveFeeling(null);
                                                    setResolveNeed(null);
                                                }}
                                                className="w-full py-4 text-sm font-bold text-white bg-purple-600 rounded-2xl"
                                            >
                                                📔 Open Journal → Feeling Entry
                                            </button>
                                        </>
                                    )}

                                    {resolveNeed?.id === 'resolve' && (
                                        <>
                                            <div className="text-center">
                                                <span className="text-4xl">⚓</span>
                                                <h3 className="text-lg font-black text-slate-700 mt-2">Let's work through this together</h3>
                                                <p className="text-sm text-slate-500 mt-1">Guided steps to help you both find resolution.</p>
                                            </div>
                                            <button
                                                onClick={() => { setConflictStep(0); setResolveStep('steps'); }}
                                                className="w-full py-4 text-sm font-bold text-white bg-orange-600 rounded-2xl"
                                            >
                                                ⚓ Start Conflict Resolution
                                            </button>
                                        </>
                                    )}

                                    {resolveNeed?.id === 'encourage' && (
                                        <>
                                            <div className="text-center">
                                                <span className="text-4xl">🤗</span>
                                                <h3 className="text-lg font-black text-slate-700 mt-2">You've got this</h3>
                                                <p className="text-sm text-slate-500 mt-1">Here's some encouragement just for you...</p>
                                            </div>
                                            <div className="p-4 bg-gradient-to-r from-orange-50 to-rose-50 rounded-2xl border border-orange-100">
                                                <p className="text-sm italic text-slate-700">
                                                    {resolveFeeling?.id === 'frustrated' && "It's okay to feel frustrated. Take a deep breath. This feeling will pass, and you have the strength to work through this."}
                                                    {resolveFeeling?.id === 'hurt' && "Your feelings are valid. It's okay to feel hurt. Remember that healing takes time, and you're not alone in this."}
                                                    {resolveFeeling?.id === 'overwhelmed' && "One step at a time. You don't have to solve everything right now. Focus on just the next small thing."}
                                                    {resolveFeeling?.id === 'confused' && "Confusion is often the first step to clarity. Give yourself grace as you work through this."}
                                                    {resolveFeeling?.id === 'disconnected' && "Connection takes effort from both sides. The fact that you're here shows you care. That matters."}
                                                    {resolveFeeling?.id === 'fine' && "It's great that you're checking in with yourself. Staying proactive about your relationship is a sign of strength."}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setResolveStep('feeling');
                                                    setResolveFeeling(null);
                                                    setResolveNeed(null);
                                                    setView('hub');
                                                }}
                                                className="w-full py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl"
                                            >
                                                Thanks, I feel better 💕
                                            </button>
                                        </>
                                    )}

                                    <button onClick={() => setResolveStep('need')} className="w-full py-2 text-xs text-slate-400 font-bold">← Back</button>
                                </div>
                            )}

                            {/* Step 5: Conflict Resolution Steps */}
                            {resolveStep === 'steps' && (
                                <div className="bg-white rounded-[2rem] shadow-xl border border-orange-100 p-6 space-y-4">
                                    {(() => {
                                        const steps = [
                                            { title: 'Take a Pause', desc: 'If either of you feels flooded, take a 20-minute break. Signal this to your partner.', action: 'Signal Timeout', actionFn: () => saveToBridge("I'm feeling flooded and need a 20-minute timeout. I love you.") },
                                            { title: 'Soft Start', desc: 'Begin with "I feel..." not "You always...". Focus on your experience, not blame.', action: 'Continue', actionFn: null },
                                            { title: 'Really Listen', desc: 'Summarize what your partner said before responding. "What I hear you saying is..."', action: 'Continue', actionFn: null },
                                            { title: 'Find Common Ground', desc: 'What do you both want? Focus on shared goals, not individual positions.', action: 'Continue', actionFn: null },
                                            { title: 'Repair & Reconnect', desc: 'End with appreciation. Share one thing you love about each other.', action: 'Complete', actionFn: null }
                                        ];
                                        const step = steps[conflictStep];
                                        return (
                                            <>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-black text-orange-500 uppercase">Step {conflictStep + 1} of {steps.length}</span>
                                                    <div className="flex gap-1">
                                                        {steps.map((_, i) => (
                                                            <div key={i} className={`w-2 h-2 rounded-full ${i <= conflictStep ? 'bg-orange-500' : 'bg-slate-200'}`} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-center py-4">
                                                    <h3 className="text-xl font-black text-slate-800">{step.title}</h3>
                                                    <p className="text-sm text-slate-600 mt-2">{step.desc}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    {conflictStep > 0 && (
                                                        <button onClick={() => setConflictStep(conflictStep - 1)} className="flex-1 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl">← Previous</button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            if (step.actionFn) step.actionFn();
                                                            if (conflictStep < steps.length - 1) {
                                                                setConflictStep(conflictStep + 1);
                                                            } else {
                                                                setResolveStep('feeling');
                                                                setConflictStep(0);
                                                                setView('bridge');
                                                            }
                                                        }}
                                                        className="flex-1 py-3 text-sm font-bold text-white bg-orange-500 rounded-xl"
                                                    >
                                                        {step.action} {conflictStep < steps.length - 1 && '→'}
                                                    </button>
                                                </div>
                                            </>
                                        );
                                    })()}
                                    <button
                                        onClick={() => { setResolveStep('feeling'); setConflictStep(0); setView('bridge'); }}
                                        className="w-full py-2 text-xs text-slate-400 font-bold"
                                    >
                                        Exit to Bridge
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'games' && (
                        <div className="p-2 space-y-2 animate-in slide-in-from-bottom-4">
                            {!currentGameId && (
                                <div className="text-center space-y-1 pt-1">
                                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto border-2 border-white shadow-lg">
                                        <Gamepad2 className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tighter italic">Couple Games</h2>
                                    <p className="text-[10px] text-slate-400">Play together, wager fun rewards!</p>
                                </div>
                            )}

                            {/* Active Game or Create New */}
                            {/* Game View Logic */}
                            {(() => {
                                const activeGame = activeGames.find(g => g.id === currentGameId);

                                // 1. SPECIFIC GAME VIEW
                                if (activeGame) {
                                    return (
                                        <div className="bg-white rounded-2xl shadow-xl border border-purple-100 px-1 py-2 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <button
                                                    onClick={() => setCurrentGameId(null)}
                                                    className="text-xs font-bold text-slate-400 flex items-center gap-1"
                                                >
                                                    ← Back
                                                </button>
                                                <button
                                                    onClick={() => deleteActiveGame(activeGame.id)}
                                                    className="text-slate-300 hover:text-red-400"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* WORD SCRAMBLE UI */}
                                            {activeGame.type === 'word_scramble' && (
                                                <>
                                                    <div className="text-center">
                                                        <p className="text-[10px] font-bold text-purple-500 uppercase">Word Scramble from {activeGame.creatorName}</p>
                                                        {activeGame.hint && <p className="text-xs text-pink-500 mt-1">{activeGame.hint}</p>}
                                                    </div>
                                                    <div className="text-center py-6">
                                                        <p className="text-4xl font-black text-slate-800 tracking-[0.3em]">{activeGame.scrambled}</p>
                                                    </div>
                                                </>
                                            )}

                                            {/* Common Wager Display */}
                                            {activeGame.wager && (
                                                <div className="px-2 py-1 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg text-center">
                                                    <p className="text-[9px] font-bold text-purple-600 uppercase">💝 Wager</p>
                                                    <p className="text-xs font-bold text-slate-700">{activeGame.wager}</p>
                                                </div>
                                            )}


                                            {/* LETTER LINK UI */}
                                            {activeGame.type === 'letter_link' && (() => {
                                                let board = [];
                                                try { board = JSON.parse(activeGame.board || '[]'); } catch (e) { }
                                                if (board.length === 0) board = Array(121).fill(null);

                                                const myHand = activeGame.players?.[role]?.hand || [];

                                                return (() => {
                                                    // Prepare display board (permanent + temporary)
                                                    const displayBoard = [...board];
                                                    placedTiles.forEach(t => {
                                                        displayBoard[t.row * 11 + t.col] = { char: t.char, temporary: true };
                                                    });

                                                    // Prepare hand visualization
                                                    const handDisplay = myHand.map((char, originalIndex) => {
                                                        const isSelected = selectedTileIndex === originalIndex;
                                                        const isPlaced = placedTiles.some(t => t.fromHandIndex === originalIndex);
                                                        return { char, originalIndex, isSelected, isPlaced };
                                                    });

                                                    // Check turn
                                                    const currentTurn = activeGame.currentTurn || (activeGame.createdBy === 'his' ? 'hers' : 'his');
                                                    const isMyTurn = currentTurn === role;

                                                    return (
                                                        <div className="flex flex-col items-center gap-2">
                                                            {/* 11x11 BOARD */}
                                                            <div className="grid grid-cols-11 gap-[1px] bg-indigo-900 p-0.5 rounded-lg border border-indigo-950 shadow-inner select-none touch-none">
                                                                {displayBoard.map((cell, i) => {
                                                                    const isCenter = i === 60;
                                                                    const isTemporary = cell?.temporary;
                                                                    const bonus = getBonusType(i);

                                                                    // Bonus square colors
                                                                    const bonusStyles = {
                                                                        'TW': 'bg-red-500/80 text-red-100',
                                                                        'DW': 'bg-pink-400/70 text-pink-100',
                                                                        'TL': 'bg-blue-500/80 text-blue-100',
                                                                        'DL': 'bg-sky-400/70 text-sky-100',
                                                                        'STAR': 'bg-indigo-600 text-amber-300'
                                                                    };
                                                                    const bonusLabels = { 'TW': '3×W', 'DW': '2×W', 'TL': '3×L', 'DL': '2×L', 'STAR': '★' };

                                                                    return (
                                                                        <div
                                                                            key={i}
                                                                            onClick={() => handleBoardClick(i)}
                                                                            className={`w-[25px] h-[25px] flex items-center justify-center text-[10px] font-bold rounded-[2px] transition-all relative
                                                                                ${cell
                                                                                    ? (isTemporary ? 'bg-amber-200 text-amber-900 shadow-md transform scale-105 z-10 animate-pop' : 'bg-amber-100 text-amber-900 shadow-sm border border-amber-200')
                                                                                    : (bonus ? bonusStyles[bonus] : 'bg-indigo-50/10')
                                                                                }
                                                                                ${(selectedTileIndex !== null && !cell) ? 'animate-pulse ring-2 ring-amber-400 cursor-pointer' : ''}
                                                                            `}
                                                                        >
                                                                            {cell ? (
                                                                                <div className="flex flex-col items-center leading-none">
                                                                                    <span className="text-xs font-black">{cell.char}</span>
                                                                                    <span className="text-[5px] font-bold opacity-60">{LETTER_POINTS[cell.char] || 0}</span>
                                                                                </div>
                                                                            ) : (bonus ? <span className="text-[7px] font-bold">{bonusLabels[bonus]}</span> : '')}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            {/* SCORES & MOVE HISTORY */}
                                                            <div className="w-full flex justify-between items-center px-2 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                                                                <div className="text-center">
                                                                    <p className="text-[9px] font-bold text-indigo-400 uppercase">{husbandName || 'Him'}</p>
                                                                    <p className="text-lg font-black text-indigo-700">{activeGame.players?.his?.score || 0}</p>
                                                                </div>
                                                                <div className="text-center px-3">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Tiles Left</p>
                                                                    <p className="text-sm font-bold text-slate-600">{activeGame.bag?.length || 0}</p>
                                                                </div>
                                                                <div className="text-center">
                                                                    <p className="text-[9px] font-bold text-purple-400 uppercase">{wifeName || 'Her'}</p>
                                                                    <p className="text-lg font-black text-purple-700">{activeGame.players?.hers?.score || 0}</p>
                                                                </div>
                                                            </div>

                                                            {/* Last Move */}
                                                            {activeGame.history?.length > 0 && (
                                                                <div className="w-full px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 text-center">
                                                                    <p className="text-[10px] text-amber-700">
                                                                        <span className="font-bold">{activeGame.history[activeGame.history.length - 1]?.player === 'his' ? (husbandName || 'Him') : (wifeName || 'Her')}</span>
                                                                        {' scored '}
                                                                        <span className="font-black text-amber-900">{activeGame.history[activeGame.history.length - 1]?.points} pts</span>
                                                                        {activeGame.history[activeGame.history.length - 1]?.word && ` with "${activeGame.history[activeGame.history.length - 1]?.word}"`}
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {/* RACK / HAND */}
                                                            <div className="flex flex-col items-center gap-2 w-full">
                                                                <div className="w-full bg-amber-800 p-2 rounded-xl shadow-lg flex justify-center gap-1.5">
                                                                    {handDisplay.map((tile, i) => (
                                                                        <div
                                                                            key={i}
                                                                            onClick={() => !tile.isPlaced && handleTileClick(tile.originalIndex, tile.char)}
                                                                            className={`w-10 h-12 rounded flex flex-col items-center justify-center font-black shadow transition-all
                                                                                ${tile.isPlaced
                                                                                    ? 'bg-amber-900/50 text-amber-900/50 border-none'
                                                                                    : (tile.isSelected
                                                                                        ? 'bg-amber-300 text-amber-950 border-b-4 border-amber-500 -translate-y-1'
                                                                                        : 'bg-amber-100 text-amber-900 border-b-4 border-amber-300 hover:bg-amber-50')
                                                                                }
                                                                            `}
                                                                        >
                                                                            <span className="text-lg leading-none">{tile.char}</span>
                                                                            {!tile.isPlaced && <span className="text-[8px] font-bold opacity-60 leading-none">{LETTER_POINTS[tile.char] || 0}</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                {/* Primary Controls */}
                                                                <div className="flex gap-2 w-full">
                                                                    <button
                                                                        onClick={recallAllTiles}
                                                                        disabled={placedTiles.length === 0}
                                                                        className="flex-1 py-3 bg-red-100 text-red-600 font-bold text-xs rounded-xl disabled:opacity-50"
                                                                    >
                                                                        Recall
                                                                    </button>
                                                                    <button
                                                                        onClick={() => shuffleHand(activeGame.id)}
                                                                        disabled={!isMyTurn}
                                                                        className="flex-1 py-3 bg-blue-100 text-blue-600 font-bold text-xs rounded-xl disabled:opacity-50"
                                                                    >
                                                                        🔀 Shuffle
                                                                    </button>
                                                                    <button
                                                                        onClick={submitLetterLinkMove}
                                                                        disabled={!isMyTurn || placedTiles.length === 0}
                                                                        className="flex-2 w-full py-3 bg-green-500 text-white font-black text-xs rounded-xl disabled:bg-slate-300 disabled:text-slate-500 shadow-lg"
                                                                    >
                                                                        {isMyTurn ? '✓ Submit' : 'Waiting...'}
                                                                    </button>
                                                                </div>

                                                                {/* Secondary Controls */}
                                                                <div className="flex gap-2 w-full">
                                                                    <button
                                                                        onClick={() => passLetterLinkTurn(activeGame.id)}
                                                                        disabled={!isMyTurn || placedTiles.length > 0}
                                                                        className="flex-1 py-2 bg-slate-100 text-slate-500 font-bold text-[10px] rounded-lg disabled:opacity-40"
                                                                    >
                                                                        ⏭ Pass Turn
                                                                    </button>
                                                                    <button
                                                                        onClick={() => endLetterLinkGame(activeGame.id)}
                                                                        className="flex-1 py-2 bg-orange-100 text-orange-500 font-bold text-[10px] rounded-lg"
                                                                    >
                                                                        🏁 End Game
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })();
                                            })()}

                                            {/* BATTLESHIP UI */}
                                            {activeGame.type === 'battleship' && (() => {
                                                const myPlayerData = activeGame.players?.[role] || {};
                                                const opponentKey = role === 'his' ? 'hers' : 'his';
                                                const opponentData = activeGame.players?.[opponentKey] || {};
                                                const phase = activeGame.phase || 'placing';
                                                const isMyTurnBs = activeGame.currentTurn === role;
                                                const winner = activeGame.winner;

                                                let myGrid = [], myAttackGrid = [];
                                                try {
                                                    myGrid = JSON.parse(myPlayerData.grid || '[]');
                                                    myAttackGrid = JSON.parse(myPlayerData.attackGrid || '[]');
                                                } catch (e) { }
                                                if (myGrid.length === 0) myGrid = createEmptyGrid();
                                                if (myAttackGrid.length === 0) myAttackGrid = createEmptyGrid();

                                                const displayGrid = phase === 'placing' && !myPlayerData.ready ? localPlacementGrid : myGrid;

                                                return (
                                                    <div className="space-y-3">
                                                        <div className="text-center">
                                                            <p className="text-[10px] font-bold text-cyan-500 uppercase">
                                                                {phase === 'placing' ? '🚢 Place Your Ships' : phase === 'battle' ? '💥 Battle Phase' : '🏆 Game Over'}
                                                            </p>
                                                            {winner && (
                                                                <p className={`text-lg font-black ${winner === role ? 'text-green-600' : 'text-red-500'}`}>
                                                                    {winner === role ? '🎉 You Won!' : '💀 You Lost!'}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {phase === 'placing' && !myPlayerData.ready && (
                                                            <>
                                                                <div className="space-y-2">
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase">Select Ship:</p>
                                                                    <div className="grid grid-cols-5 gap-1">
                                                                        {Object.entries(SHIPS).map(([type, ship]) => (
                                                                            <button
                                                                                key={type}
                                                                                onClick={() => setBattleshipSelectedShip(type)}
                                                                                disabled={!!localShipPlacements[type]}
                                                                                className={`p-2 rounded-xl text-center transition-all ${localShipPlacements[type] ? 'bg-green-100 opacity-50'
                                                                                        : battleshipSelectedShip === type ? 'bg-cyan-500 text-white ring-2 ring-cyan-300'
                                                                                            : 'bg-slate-100 hover:bg-cyan-50'
                                                                                    }`}
                                                                            >
                                                                                <span className="text-xl">{ship.emoji}</span>
                                                                                <p className="text-[8px] font-bold">{ship.size}</p>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    <button onClick={() => setBattleshipOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')} className="w-full py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
                                                                        {battleshipOrientation === 'horizontal' ? '↔️ Horizontal' : '↕️ Vertical'}
                                                                    </button>
                                                                </div>

                                                                <div className="flex justify-center">
                                                                    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
                                                                        {displayGrid.flat().map((cell, idx) => {
                                                                            const row = Math.floor(idx / GRID_SIZE);
                                                                            const col = idx % GRID_SIZE;
                                                                            const hasShip = cell && cell.ship;
                                                                            return (
                                                                                <button key={idx} onClick={() => placeBattleshipShip(row, col)}
                                                                                    className={`w-7 h-7 rounded-sm text-xs font-bold transition-all ${hasShip ? 'bg-cyan-500 text-white' : 'bg-blue-100 hover:bg-cyan-200'}`}>
                                                                                    {hasShip ? '🚢' : ''}
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                <button onClick={() => confirmBattleshipPlacement(activeGame.id)} disabled={Object.keys(localShipPlacements).length < 5}
                                                                    className="w-full py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-black text-sm rounded-xl disabled:opacity-50">
                                                                    ✓ Ready! ({Object.keys(localShipPlacements).length}/5 ships)
                                                                </button>
                                                            </>
                                                        )}

                                                        {phase === 'placing' && myPlayerData.ready && (
                                                            <div className="text-center py-6">
                                                                <p className="text-2xl mb-2">⏳</p>
                                                                <p className="text-sm font-bold text-slate-600">Ships placed!</p>
                                                                <p className="text-xs text-slate-400">Waiting for opponent...</p>
                                                            </div>
                                                        )}

                                                        {phase === 'battle' && (
                                                            <>
                                                                <div className={`p-2 rounded-xl text-center ${isMyTurnBs ? 'bg-red-100 border-2 border-red-200' : 'bg-slate-100'}`}>
                                                                    <p className="text-xs font-bold">
                                                                        {isMyTurnBs ? <span className="text-red-600">🎯 FIRE!</span> : <span className="text-slate-500">⏳ Waiting...</span>}
                                                                    </p>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-2 text-center">
                                                                    <div className="bg-cyan-50 p-2 rounded-xl">
                                                                        <p className="text-[9px] font-black text-cyan-500 uppercase">Your Ships</p>
                                                                        <p className="text-lg font-black">{myPlayerData.shipsRemaining || 5} 🚢</p>
                                                                    </div>
                                                                    <div className="bg-red-50 p-2 rounded-xl">
                                                                        <p className="text-[9px] font-black text-red-500 uppercase">Enemy Ships</p>
                                                                        <p className="text-lg font-black">{opponentData.shipsRemaining || 5} 🚢</p>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[9px] font-black text-red-400 uppercase mb-1 text-center">Tap Enemy Waters to Attack</p>
                                                                    <div className="flex justify-center">
                                                                        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}>
                                                                            {myAttackGrid.flat().map((cell, idx) => {
                                                                                const row = Math.floor(idx / GRID_SIZE);
                                                                                const col = idx % GRID_SIZE;
                                                                                const isHit = cell && (cell.hit || cell === 'miss');
                                                                                const displayChar = cell === 'miss' ? '⚪' : (cell && cell.hit) ? '💥' : '';
                                                                                return (
                                                                                    <button key={idx} onClick={() => isMyTurnBs && !isHit && attackBattleshipCell(activeGame.id, row, col)}
                                                                                        disabled={!isMyTurnBs || isHit}
                                                                                        className={`w-7 h-7 rounded-sm text-xs font-bold transition-all ${isHit ? (cell === 'miss' ? 'bg-slate-200' : 'bg-red-400')
                                                                                                : isMyTurnBs ? 'bg-blue-200 hover:bg-red-200 cursor-crosshair' : 'bg-blue-100 opacity-60'
                                                                                            }`}>
                                                                                        {displayChar}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}

                                                        {phase === 'ended' && (
                                                            <button onClick={() => { deleteActiveGame(activeGame.id); setCurrentGameId(null); }}
                                                                className="w-full py-3 bg-slate-200 text-slate-600 font-bold text-sm rounded-xl">
                                                                Close Game
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Turn Indicator & Input */}
                                            {(() => {
                                                const currentTurn = activeGame.currentTurn || (activeGame.createdBy === 'his' ? 'hers' : 'his');
                                                const isMyTurn = currentTurn === role;
                                                const turnName = currentTurn === 'his' ? (husbandName || 'Him') : (wifeName || 'Her');

                                                return (
                                                    <>
                                                        <div className={`p-3 rounded-2xl text-center ${isMyTurn ? 'bg-green-50 border-2 border-green-200' : 'bg-slate-100 border-2 border-slate-200'}`}>
                                                            <p className="text-xs font-bold">
                                                                {isMyTurn ? <span className="text-green-600">🎯 Your turn to guess!</span> : <span className="text-slate-500">⏳ Waiting for {turnName}...</span>}
                                                            </p>
                                                        </div>

                                                        {/* Scramble Input */}
                                                        {activeGame.type === 'word_scramble' && (
                                                            <input
                                                                type="text"
                                                                value={gameAnswer}
                                                                onChange={(e) => setGameAnswer(e.target.value)}
                                                                placeholder={isMyTurn ? "Your answer..." : "Wait for your turn..."}
                                                                disabled={!isMyTurn}
                                                                className={`w-full p-4 border rounded-2xl text-center text-lg font-bold uppercase outline-none ${isMyTurn ? 'bg-slate-50 border-slate-200 focus:border-purple-300' : 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'}`}
                                                            />
                                                        )}

                                                        {activeGame.type !== 'letter_link' && (
                                                            <button
                                                                onClick={() => submitGameAnswer(activeGame.id, gameAnswer)}
                                                                disabled={!gameAnswer || !isMyTurn}
                                                                className="w-full py-4 text-sm font-black text-white bg-purple-600 rounded-2xl disabled:opacity-50 mt-2"
                                                            >
                                                                {isMyTurn ? 'Submit Answer' : 'Not Your Turn'}
                                                            </button>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    );
                                }

                                // 2a. CREATE NEW LETTER LINK UI
                                if (selectedGame === 'letter_link') {
                                    return (
                                        <div className="bg-white rounded-[2.5rem] shadow-xl border border-blue-100 p-6 space-y-4">
                                            <h3 className="text-center text-sm font-black text-blue-600 uppercase">New Letter Link Game</h3>
                                            <p className="text-xs text-center text-slate-400">Classic word building with a personalized twist!</p>
                                            <input
                                                type="text"
                                                placeholder="Optional wager for the winner..."
                                                className="w-full p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm outline-none focus:border-blue-300"
                                                id="ll-wager-input"
                                            />
                                            <button
                                                onClick={() => {
                                                    const wager = document.getElementById('ll-wager-input')?.value || '';
                                                    createLetterLinkGame(wager);
                                                    setSelectedGame(null);
                                                }}
                                                className="w-full py-4 text-sm font-black text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl shadow-lg"
                                            >
                                                🧩 Start Game
                                            </button>
                                            <button onClick={() => setSelectedGame(null)} className="w-full py-3 text-xs font-bold text-slate-400">Cancel</button>
                                        </div>
                                    );
                                }

                                // 2b. CREATE NEW BATTLESHIP UI
                                if (selectedGame === 'battleship') {
                                    return (
                                        <div className="bg-white rounded-[2.5rem] shadow-xl border border-cyan-100 p-6 space-y-4">
                                            <h3 className="text-center text-sm font-black text-cyan-600 uppercase">New Battleship Game</h3>
                                            <p className="text-xs text-center text-slate-400">Classic 10×10 naval warfare!</p>
                                            <div className="text-center py-2">
                                                <span className="text-4xl">⚓🚢💥</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Optional wager for the winner..."
                                                className="w-full p-4 bg-cyan-50 border border-cyan-100 rounded-2xl text-sm outline-none focus:border-cyan-300"
                                                id="bs-wager-input"
                                            />
                                            <button
                                                onClick={() => {
                                                    const wager = document.getElementById('bs-wager-input')?.value || '';
                                                    createBattleshipGame(wager);
                                                    setSelectedGame(null);
                                                }}
                                                className="w-full py-4 text-sm font-black text-white bg-gradient-to-r from-cyan-500 to-teal-500 rounded-2xl shadow-lg"
                                            >
                                                ⚓ Start Battle
                                            </button>
                                            <button onClick={() => setSelectedGame(null)} className="w-full py-3 text-xs font-bold text-slate-400">Cancel</button>
                                        </div>
                                    );
                                }

                                // 2. CREATE NEW SCRAMBLE (Existing)
                                if (selectedGame === 'word_scramble') {
                                    return (
                                        <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-100 p-6 space-y-4">
                                            <h3 className="text-center text-sm font-black text-purple-600 uppercase">New Word Scramble</h3>
                                            <input
                                                type="text"
                                                placeholder="Optional wager... (e.g., 'Loser gives a massage')"
                                                className="w-full p-4 bg-purple-50 border border-purple-100 rounded-2xl text-sm outline-none focus:border-purple-300"
                                                id="wager-input"
                                            />
                                            <button
                                                onClick={() => {
                                                    const wager = document.getElementById('wager-input')?.value || '';
                                                    createWordPuzzle(wager);
                                                    setSelectedGame(null); // Return to lobby
                                                }}
                                                className="w-full py-4 text-sm font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-lg"
                                            >
                                                🎲 Generate Puzzle
                                            </button>
                                            <button onClick={() => setSelectedGame(null)} className="w-full py-3 text-xs font-bold text-slate-400">Cancel</button>
                                        </div>
                                    );
                                }

                                // 3. GAME LOBBY (Default)
                                return (
                                    <div className="space-y-4">
                                        {/* Active Games List */}
                                        {activeGames.length > 0 && (
                                            <div className="space-y-2">
                                                <h3 className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Games</h3>
                                                {activeGames.map(game => {
                                                    const currentTurn = game.currentTurn || (game.createdBy === 'his' ? 'hers' : 'his');
                                                    const isMyTurn = currentTurn === role;
                                                    return (
                                                        <button
                                                            key={game.id}
                                                            onClick={() => setCurrentGameId(game.id)}
                                                            className={`w-full p-4 rounded-2xl border text-left transition-all ${isMyTurn ? 'bg-white border-purple-200 shadow-md ring-2 ring-purple-100' : 'bg-slate-50 border-slate-100 opacity-80'}`}
                                                        >
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-bold text-purple-500 uppercase">{game.type === 'word_scramble' ? 'Word Scramble' : game.type === 'letter_link' ? 'Letter Link' : 'Battleship'}</span>
                                                                {game.type === 'battleship' && game.phase === 'placing' && !game.players[role]?.ready && <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">PLACE SHIPS</span>}
                                                                {game.type === 'battleship' && game.phase === 'placing' && game.players[role]?.ready && <span className="text-[9px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">WAITING</span>}
                                                                {isMyTurn && game.type !== 'battleship' && <span className="text-[9px] font-black bg-green-100 text-green-600 px-2 py-0.5 rounded-full">YOUR TURN</span>}
                                                                {isMyTurn && game.type === 'battleship' && game.phase === 'battle' && <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full">FIRE!</span>}
                                                            </div>
                                                            <div className="flex justify-between items-end">
                                                                <div className="text-sm font-bold text-slate-700">
                                                                    {game.type === 'word_scramble' ? (game.scrambled || 'Puzzle') : game.type === 'battleship' ? `⚓ ${game.phase === 'placing' ? 'Setup' : game.phase === 'battle' ? 'Battle' : 'Ended'}` : 'Ongoing Match'}
                                                                </div>
                                                                <div className="text-xs text-slate-400">
                                                                    vs {game.creatorName === (husbandName || 'Husband') ? (wifeName || 'Wife') : (husbandName || 'Husband')}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Create New Game Menu */}
                                        <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-100 p-6 space-y-4">
                                            <h3 className="text-center text-sm font-black text-purple-600 uppercase">Start New Game</h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                <button
                                                    onClick={() => setSelectedGame('word_scramble')}
                                                    className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-100 rounded-2xl text-left hover:border-purple-300 transition-all flex items-center gap-4"
                                                >
                                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">🔤</div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">Word Scramble</p>
                                                        <p className="text-[10px] text-slate-500">Unscramble personalized words</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => setSelectedGame('letter_link')}
                                                    className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-2xl text-left hover:border-blue-300 transition-all flex items-center gap-4"
                                                >
                                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">🧩</div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">Letter Link</p>
                                                        <p className="text-[10px] text-slate-500">Scrabble-style with Memory Checks!</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => setSelectedGame('battleship')}
                                                    className="p-4 bg-gradient-to-r from-cyan-50 to-teal-50 border-2 border-cyan-100 rounded-2xl text-left hover:border-cyan-300 transition-all flex items-center gap-4"
                                                >
                                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">⚓</div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-sm">Battleship</p>
                                                        <p className="text-[10px] text-slate-500">Classic naval warfare!</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}


                            {/* Scoreboard with Points */}
                            <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-100 p-6 space-y-4">
                                <div className="flex items-center gap-2 justify-center">
                                    <Trophy className="w-5 h-5 text-yellow-500" />
                                    <h3 className="text-sm font-black text-slate-800 uppercase">Scoreboard</h3>
                                </div>

                                {/* Timeline Filter */}
                                <div className="flex justify-center gap-2">
                                    {[
                                        { id: '7days', label: '7 Days' },
                                        { id: '30days', label: '30 Days' },
                                        { id: 'all', label: 'All Time' }
                                    ].map(filter => (
                                        <button
                                            key={filter.id}
                                            onClick={() => setScoreboardFilter(filter.id)}
                                            className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase transition-all ${scoreboardFilter === filter.id
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>

                                {(() => {
                                    const now = new Date();
                                    const filteredHistory = gameHistory.filter(g => {
                                        if (scoreboardFilter === 'all') return true;
                                        const gameDate = g.solvedAt?.toDate ? g.solvedAt.toDate() : new Date(g.solvedAt);
                                        const daysDiff = Math.floor((now - gameDate) / (1000 * 60 * 60 * 24));
                                        return scoreboardFilter === '7days' ? daysDiff <= 7 : daysDiff <= 30;
                                    });
                                    const hisWins = filteredHistory.filter(g => g.solvedBy === 'his').length;
                                    const hersWins = filteredHistory.filter(g => g.solvedBy === 'hers').length;

                                    return (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="text-center p-4 bg-blue-50 rounded-2xl">
                                                <p className="text-[10px] font-bold text-blue-500 uppercase">{husbandName || 'Him'}</p>
                                                <p className="text-3xl font-black text-blue-600">{hisWins} 🏆</p>
                                                <p className="text-[9px] text-blue-400">wins</p>
                                            </div>
                                            <div className="text-center p-4 bg-rose-50 rounded-2xl">
                                                <p className="text-[10px] font-bold text-rose-500 uppercase">{wifeName || 'Her'}</p>
                                                <p className="text-3xl font-black text-rose-600">{hersWins} 🏆</p>
                                                <p className="text-[9px] text-rose-400">wins</p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {gameHistory.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Recent Games</p>
                                        {gameHistory.slice(0, 5).map((game, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                <span className="text-xs font-bold text-slate-600">{game.word}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-purple-600">+{game.points || 10} pts</span>
                                                    <span className="text-[9px] text-slate-400">{game.solverName}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Wager Debts Tracker */}
                            <div className="bg-white rounded-[2.5rem] shadow-xl border border-pink-100 p-6 space-y-4">
                                <div className="flex items-center gap-2 justify-center">
                                    <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
                                    <h3 className="text-sm font-black text-slate-800 uppercase">Wager Tracker</h3>
                                </div>
                                <p className="text-[10px] text-center text-slate-400">Track fun wagers and rewards owed!</p>

                                {/* Add New Debt */}
                                <div className="flex flex-col gap-2">
                                    <input
                                        type="text"
                                        id="new-debt-input"
                                        placeholder="e.g., Back massage, Dinner choice..."
                                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-pink-300"
                                    />
                                    <select id="new-debt-owner" className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none">
                                        <option value="his">{husbandName || 'He'} owes</option>
                                        <option value="hers">{wifeName || 'She'} owes</option>
                                    </select>
                                </div>
                                <button
                                    onClick={() => {
                                        const input = document.getElementById('new-debt-input');
                                        const owner = document.getElementById('new-debt-owner');
                                        if (input.value.trim()) {
                                            const newDebt = {
                                                id: Date.now(),
                                                description: input.value.trim(),
                                                owedBy: owner.value,
                                                paid: false,
                                                createdAt: new Date().toISOString()
                                            };
                                            const updatedDebts = [...gameDebts, newDebt];
                                            setGameDebts(updatedDebts);
                                            localStorage.setItem('game_debts', JSON.stringify(updatedDebts));
                                            input.value = '';
                                        }
                                    }}
                                    className="w-full py-3 bg-pink-500 text-white font-bold text-xs rounded-xl"
                                >
                                    ➕ Add Wager
                                </button>

                                {/* Debts List */}
                                {gameDebts.length > 0 && (
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Outstanding Wagers</p>
                                        {gameDebts.filter(d => !d.paid).map(debt => (
                                            <div key={debt.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => {
                                                            const updatedDebts = gameDebts.map(d =>
                                                                d.id === debt.id ? { ...d, paid: true } : d
                                                            );
                                                            setGameDebts(updatedDebts);
                                                            localStorage.setItem('game_debts', JSON.stringify(updatedDebts));
                                                        }}
                                                        className="w-6 h-6 rounded-full border-2 border-pink-300 bg-white hover:bg-pink-100 flex items-center justify-center transition-all"
                                                    >
                                                        <span className="text-pink-300 text-sm">💕</span>
                                                    </button>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-600">{debt.description}</p>
                                                        <p className="text-[9px] text-slate-400">
                                                            {debt.owedBy === 'his' ? (husbandName || 'He') : (wifeName || 'She')} owes
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Paid Debts */}
                                        {gameDebts.filter(d => d.paid).length > 0 && (
                                            <>
                                                <p className="text-[10px] font-bold text-green-500 uppercase pt-2">✅ Paid Up</p>
                                                {gameDebts.filter(d => d.paid).slice(0, 3).map(debt => (
                                                    <div key={debt.id} className="flex items-center justify-between p-3 bg-green-50 rounded-xl opacity-60">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                                                <Check className="w-4 h-4 text-white" />
                                                            </div>
                                                            <p className="text-xs text-slate-500 line-through">{debt.description}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const updatedDebts = gameDebts.filter(d => d.id !== debt.id);
                                                                setGameDebts(updatedDebts);
                                                                localStorage.setItem('game_debts', JSON.stringify(updatedDebts));
                                                            }}
                                                            className="text-slate-400 hover:text-red-500"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                )}

                                {gameDebts.length === 0 && (
                                    <p className="text-xs text-center text-slate-400 py-4">No wagers yet! Win a game and set a fun reward 🎁</p>
                                )}
                            </div>
                        </div >
                    )}

                    {
                        view === 'nudge' && (
                            <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4">
                                <div className="text-center space-y-2 pt-2">
                                    <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto border-2 border-white shadow-lg"><Bell className="w-7 h-7 text-rose-600" /></div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Nudge Center</h2>
                                    <p className="text-xs text-slate-400">Set daily reminders to nurture your connection</p>
                                </div>

                                {/* Notification Settings (Moved to Top) */}
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-rose-100 p-6 space-y-4">
                                    <div className="flex items-center gap-2 justify-center">
                                        <Bell className="w-5 h-5 text-rose-500" />
                                        <h3 className="text-sm font-black text-slate-800 uppercase">Notifications</h3>
                                    </div>

                                    {notificationPermission !== 'granted' ? (
                                        <div className="text-center space-y-3">
                                            <p className="text-xs text-slate-500">Enable notifications to get alerts for game turns, new messages, and reminders.</p>

                                            {/* iOS specific hint */}
                                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-left">
                                                <p className="text-[10px] font-bold text-blue-600 mb-1">📱 iPhone / iOS Users:</p>
                                                <p className="text-[10px] text-slate-600">Notifications <u>only</u> work if you:</p>
                                                <ol className="list-decimal pl-4 text-[10px] text-slate-600 mt-1 space-y-0.5">
                                                    <li>Tap the <strong>Share</strong> button (box with arrow)</li>
                                                    <li>Select <strong>Add to Home Screen</strong></li>
                                                    <li>Open the app from your home screen</li>
                                                </ol>
                                            </div>

                                            <button
                                                onClick={requestNotificationPermission}
                                                className="w-full py-4 bg-rose-500 text-white font-bold text-sm rounded-2xl hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
                                            >
                                                🔔 Enable Notifications
                                            </button>
                                            {notificationPermission === 'denied' && (
                                                <p className="text-xs text-red-500">Notifications are blocked. Check your browser settings to enable them.</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-xs text-green-600 text-center font-bold">✅ Notifications enabled!</p>

                                            {[
                                                { key: 'games', emoji: '🎮', label: 'Game Alerts', desc: 'When it\'s your turn to guess' },
                                                { key: 'bridge', emoji: '💬', label: 'Bridge Messages', desc: 'New messages from your partner' },
                                                { key: 'dateReminders', emoji: '💕', label: 'Date Reminders', desc: 'Reminder for your date nights' },
                                                { key: 'messageReminders', emoji: '💌', label: 'Daily Love Nudge', desc: 'Reminder to send a loving message' }
                                            ].map(pref => (
                                                <div key={pref.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xl">{pref.emoji}</span>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">{pref.label}</p>
                                                            <p className="text-xs text-slate-400">{pref.desc}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => updateNotifyPref(pref.key, !notifyPrefs[pref.key])}
                                                        className={`w-12 h-6 rounded-full transition-all ${notifyPrefs[pref.key] ? 'bg-rose-500' : 'bg-slate-300'}`}
                                                    >
                                                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${notifyPrefs[pref.key] ? 'ml-6' : 'ml-0.5'}`} />
                                                    </button>
                                                </div>
                                            ))}

                                            <button
                                                onClick={() => sendNotification('Test Notification 💕', 'This is a test from Unity Bridge!', 'general')}
                                                className="w-full py-3 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all"
                                            >
                                                🔔 Send Test Notification
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {['Morning', 'Lunch', 'Evening'].map(time => {
                                        const nudge = NUDGE_DATA[time];
                                        const NudgeIcon = nudge.icon;
                                        const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Unity Bridge: ${nudge.prompt}`)}&details=${encodeURIComponent(`Reminder: ${nudge.suggestion}\n\nOpen Unity Bridge to connect with your spouse.`)}&recur=RRULE:FREQ=DAILY`;
                                        const iphoneText = `${time} Unity Nudge (${nudge.time})\n${nudge.prompt}\n${nudge.suggestion}`;
                                        return (
                                            <div key={time} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-lg space-y-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center shrink-0">
                                                        <NudgeIcon className="w-5 h-5 text-rose-600" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-lg font-black text-slate-800 tracking-tight">{time} Check-in</p>
                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{nudge.time}</span>
                                                        </div>
                                                        <p className="text-sm font-bold text-rose-600 mt-1">{nudge.prompt}</p>
                                                        <p className="text-xs text-slate-500 mt-1 italic">"{nudge.suggestion}"</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 pt-2 border-t border-slate-50">
                                                    <button onClick={() => window.open(calendarUrl, '_blank')} className="flex-1 p-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-[10px] font-black uppercase text-blue-600 flex items-center justify-center gap-2 transition-all">
                                                        <Calendar className="w-4 h-4" />
                                                        Add to Google
                                                    </button>
                                                    <button onClick={() => copyToClipboard(iphoneText, `n-${time}`)} className="flex-1 p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                                                        {copiedId === `n-${time}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                        {copiedId === `n-${time}` ? 'Copied!' : 'Copy for iPhone'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                            </div>
                        )
                    }

                    {/* KID HUB VIEW */}
                    {view === 'kid_hub' && currentKid && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4">
                            {/* Kid Header */}
                            <div className="text-center space-y-2 pt-2">
                                <span className="text-6xl">{currentKid.avatar || '🧒'}</span>
                                <h2 className={`text-2xl font-black tracking-tighter ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                                    Hi, {currentKid.name}! 👋
                                </h2>
                            </div>

                            {/* Kid Tabs */}
                            <div className={`flex p-1.5 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
                                {[
                                    { id: 'journal', label: '📔 Journal' },
                                    { id: 'bridge', label: '💬 Parents' },
                                    { id: 'me', label: '⭐ Me' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${activeTab === tab.id ? 'bg-purple-600 text-white shadow-lg' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Journal Tab */}
                            {activeTab === 'journal' && (
                                <div className={`rounded-3xl shadow-xl border p-6 space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
                                    <h3 className={`text-lg font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Today's Journal</h3>

                                    {/* Mood Selector */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-purple-500 uppercase">How are you feeling?</p>
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {['😊', '😢', '😠', '😰', '😴', '🤗', '🤔', '🎉'].map(emoji => (
                                                <button
                                                    key={emoji}
                                                    onClick={() => setKidJournalItems(prev => ({ ...prev, mood: emoji }))}
                                                    className={`text-2xl p-2 rounded-xl transition-all ${kidJournalItems.mood === emoji ? 'bg-purple-100 scale-125' : 'hover:bg-slate-100'}`}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Journal Prompts */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-purple-500 uppercase">Pick a prompt or write freely</p>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                'What made me smile today?',
                                                'Something I learned',
                                                'A challenge I faced',
                                                'What I\'m grateful for',
                                                'My goal for tomorrow'
                                            ].map(prompt => (
                                                <button
                                                    key={prompt}
                                                    onClick={() => setInputText(prompt + ' ')}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${darkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-purple-200 text-purple-600 hover:bg-purple-50'}`}
                                                >
                                                    {prompt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Journal Entry */}
                                    <textarea
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        placeholder="Write about your day..."
                                        className={`w-full h-32 p-4 rounded-2xl border resize-none text-sm outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                                    />

                                    {/* Save Button */}
                                    <button
                                        onClick={async () => {
                                            if (!inputText.trim()) { alert('Write something first!'); return; }
                                            try {
                                                const journalRef = collection(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id, 'journal');
                                                await addDoc(journalRef, {
                                                    content: inputText,
                                                    mood: kidJournalItems.mood || '😊',
                                                    timestamp: serverTimestamp(),
                                                    viewedByParent: null
                                                });
                                                setInputText('');
                                                setKidJournalItems({ mood: null });
                                                alert('Journal saved! 📔');
                                            } catch (err) {
                                                console.error('Kid journal save error:', err);
                                                alert('Oops! Try again.');
                                            }
                                        }}
                                        className="w-full py-4 bg-purple-600 text-white font-bold rounded-2xl text-sm"
                                    >
                                        ✏️ Save Journal Entry
                                    </button>
                                </div>
                            )}

                            {/* Bridge Tab - Messages to Parents */}
                            {activeTab === 'bridge' && (
                                <div className={`rounded-3xl shadow-xl border p-6 space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
                                    <h3 className={`text-lg font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Message Mom & Dad</h3>

                                    {/* Quick Messages */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { emoji: '❤️', text: 'I love you!' },
                                            { emoji: '🙏', text: 'Thank you for everything' },
                                            { emoji: '🤗', text: 'I need a hug' },
                                            { emoji: '💬', text: 'Can we talk later?' },
                                            { emoji: '😊', text: 'Had a great day!' },
                                            { emoji: '🎯', text: 'I did my best today' }
                                        ].map(msg => (
                                            <button
                                                key={msg.text}
                                                onClick={async () => {
                                                    try {
                                                        const bridgeRef = collection(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id, 'bridge_items');
                                                        await addDoc(bridgeRef, {
                                                            content: `${msg.emoji} ${msg.text}`,
                                                            from: currentKid.name,
                                                            timestamp: serverTimestamp(),
                                                            readByParent: false
                                                        });
                                                        alert('Message sent to Mom & Dad! 💕');
                                                    } catch (err) {
                                                        console.error('Kid bridge error:', err);
                                                    }
                                                }}
                                                className={`p-4 rounded-2xl border text-left transition-all active:scale-95 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-purple-50 border-purple-100 hover:bg-purple-100'}`}
                                            >
                                                <span className="text-2xl block mb-1">{msg.emoji}</span>
                                                <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{msg.text}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Message */}
                                    <div className="space-y-2 pt-4 border-t border-slate-200">
                                        <p className="text-[10px] font-bold text-purple-500 uppercase">Or write your own</p>
                                        <textarea
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            placeholder="Write a message to your parents..."
                                            className={`w-full h-20 p-3 rounded-xl border resize-none text-sm outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                                        />
                                        <button
                                            onClick={async () => {
                                                if (!inputText.trim()) return;
                                                try {
                                                    const bridgeRef = collection(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id, 'bridge_items');
                                                    await addDoc(bridgeRef, {
                                                        content: inputText,
                                                        from: currentKid.name,
                                                        timestamp: serverTimestamp(),
                                                        readByParent: false
                                                    });
                                                    setInputText('');
                                                    alert('Message sent! 💕');
                                                } catch (err) {
                                                    console.error('Kid bridge error:', err);
                                                }
                                            }}
                                            className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl text-sm"
                                        >
                                            💬 Send Message
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Me Tab */}
                            {activeTab === 'me' && (
                                <div className={`rounded-3xl shadow-xl border p-6 space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
                                    <div className="text-center space-y-2">
                                        <span className="text-6xl">{currentKid.avatar || '🧒'}</span>
                                        <h3 className={`text-xl font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{currentKid.name}</h3>
                                    </div>

                                    {/* Badges/Stats placeholder */}
                                    <div className={`p-4 rounded-2xl ${darkMode ? 'bg-slate-700' : 'bg-purple-50'}`}>
                                        <p className="text-[10px] font-bold text-purple-500 uppercase mb-2">Coming Soon</p>
                                        <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>🏆 Badges and achievements will appear here!</p>
                                    </div>

                                    {/* Logout */}
                                    <button
                                        onClick={() => {
                                            setCurrentKid(null);
                                            setPortalMode('family');
                                            localStorage.removeItem('current_kid_id');
                                            setView('home');
                                        }}
                                        className={`w-full py-4 rounded-2xl text-sm font-bold ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        👋 Switch User
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PARENT HUB VIEW (Family Mode) */}
                    {view === 'parent_hub' && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4">
                            {/* Header */}
                            <div className="text-center space-y-2 pt-2">
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg ${darkMode ? 'bg-purple-900 border-purple-700' : 'bg-purple-100 border-white'}`}>
                                    <span className="text-3xl">{role === 'his' ? '👨' : '👩'}</span>
                                </div>
                                <h2 className={`text-2xl font-black tracking-tighter ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                                    {role === 'his' ? (husbandName || 'Dad') : (wifeName || 'Mom')}'s Dashboard
                                </h2>
                                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Family Management Hub</p>
                            </div>

                            {/* Kids Overview */}
                            <div className={`rounded-3xl shadow-xl border p-6 space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
                                <div className="flex justify-between items-center">
                                    <h3 className={`text-lg font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>👧👦 Your Kids</h3>
                                    <button
                                        onClick={() => setShowKidManager(true)}
                                        className="text-[10px] font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full"
                                    >
                                        + Add Kid
                                    </button>
                                </div>

                                {kidProfiles.length === 0 ? (
                                    <div className="text-center py-8">
                                        <span className="text-4xl">👨‍👩‍👧‍👦</span>
                                        <p className={`text-sm mt-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>No kids added yet</p>
                                        <button
                                            onClick={() => setShowKidManager(true)}
                                            className="mt-4 px-6 py-3 bg-purple-600 text-white font-bold text-sm rounded-xl"
                                        >
                                            Add Your First Kid
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {kidProfiles.map(kid => (
                                            <div key={kid.id} className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-purple-50 border-purple-100'}`}>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-4xl">{kid.avatar || '🧒'}</span>
                                                    <div className="flex-1">
                                                        <h4 className={`font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{kid.name}</h4>
                                                        <p className="text-[10px] text-purple-500 font-bold">Tap to view journal & messages</p>
                                                    </div>
                                                    <ChevronRight className={`w-5 h-5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quick Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowKidManager(true)}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                                >
                                    <span className="text-2xl">⚙️</span>
                                    <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Manage Kids</span>
                                </button>
                                <button
                                    onClick={() => { setPortalMode('couple'); setView('home'); }}
                                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                                >
                                    <span className="text-2xl">💑</span>
                                    <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Couple Portal</span>
                                </button>
                            </div>

                            {/* Logout */}
                            <button
                                onClick={() => { setRole(null); setView('home'); }}
                                className={`w-full py-4 rounded-2xl text-sm font-bold ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                            >
                                👋 Switch User
                            </button>
                        </div>
                    )}

                    {/* NEW: Conflict Resolution View */}
                    {
                        view === 'resolve' && (
                            <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4">
                                <div className="text-center space-y-2 pt-2">
                                    <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto border-2 border-white shadow-lg">
                                        <Anchor className="w-7 h-7 text-orange-600" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Conflict Resolution</h2>
                                    <p className="text-xs text-slate-400">A guided process to work through disagreements together</p>
                                </div>

                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-orange-100 p-6 space-y-4">
                                    {/* Progress */}
                                    <div className="flex gap-1">
                                        {CONFLICT_STEPS.map((_, i) => (
                                            <div key={i} className={`flex-1 h-2 rounded-full ${i <= conflictStep ? 'bg-orange-500' : 'bg-slate-200'}`} />
                                        ))}
                                    </div>

                                    {/* Current Step */}
                                    <div className="text-center py-4">
                                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2">Step {conflictStep + 1} of {CONFLICT_STEPS.length}</p>
                                        <h3 className="text-xl font-black text-slate-800">{CONFLICT_STEPS[conflictStep].title}</h3>
                                    </div>

                                    <div className="p-6 bg-orange-50 border border-orange-200 rounded-2xl">
                                        <p className="text-sm text-slate-700 text-center">{CONFLICT_STEPS[conflictStep].prompt}</p>
                                    </div>

                                    <button
                                        onClick={() => saveToBridge(CONFLICT_STEPS[conflictStep].action)}
                                        className="w-full py-4 bg-orange-100 text-orange-700 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-orange-200 transition-all"
                                    >
                                        <Share2 className="w-4 h-4" />
                                        Share: "{CONFLICT_STEPS[conflictStep].action}"
                                    </button>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setConflictStep(Math.max(0, conflictStep - 1))}
                                            disabled={conflictStep === 0}
                                            className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl disabled:opacity-50"
                                        >
                                            ← Previous
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (conflictStep < CONFLICT_STEPS.length - 1) {
                                                    setConflictStep(conflictStep + 1);
                                                } else {
                                                    alert('🎉 You completed the conflict resolution process! Great job working through this together.');
                                                    setConflictStep(0);
                                                }
                                            }}
                                            className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl"
                                        >
                                            {conflictStep === CONFLICT_STEPS.length - 1 ? 'Complete ✓' : 'Next →'}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => { setConflictStep(0); setView('hub'); }}
                                    className="w-full py-3 text-slate-400 text-xs font-bold"
                                >
                                    Exit to Hub
                                </button>
                            </div>
                        )
                    }
                </div >
            </main >

            {/* Kid Manager Modal (Parents only) */}
            {showKidManager && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-md p-6 rounded-3xl shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                        <div className="flex justify-between items-center">
                            <h3 className={`text-xl font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>👨‍👩‍👧‍👦 Manage Kids</h3>
                            <button
                                onClick={() => setShowKidManager(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Add New Kid Form */}
                        <div className={`p-4 rounded-2xl border space-y-3 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-purple-50 border-purple-100'}`}>
                            <p className="text-[10px] font-black text-purple-600 uppercase">Add New Kid</p>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    id="kid-name-input"
                                    placeholder="Kid's Name"
                                    className={`w-full p-3 rounded-xl text-sm border outline-none ${darkMode ? 'bg-slate-600 border-slate-500 text-slate-200' : 'bg-white border-slate-200'}`}
                                />
                                <div className="grid grid-cols-6 gap-2">
                                    {['🧒', '👦', '👧', '👶', '🧑', '👨‍🦱', '👩‍🦱', '🧔', '👸', '🤴', '🦸', '🧙'].map(emoji => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={(e) => e.target.closest('.space-y-2').querySelector('#kid-avatar-input').value = emoji}
                                            className={`text-2xl p-2 rounded-lg border transition-all hover:scale-110 ${darkMode ? 'border-slate-500 hover:bg-slate-500' : 'border-slate-200 hover:bg-purple-100'}`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="text"
                                    id="kid-avatar-input"
                                    defaultValue="🧒"
                                    className={`w-full p-3 rounded-xl text-sm border outline-none text-center text-2xl ${darkMode ? 'bg-slate-600 border-slate-500' : 'bg-white border-slate-200'}`}
                                    readOnly
                                />
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={4}
                                    id="kid-pin-input"
                                    placeholder="4-digit PIN"
                                    className={`w-full p-3 rounded-xl text-sm border outline-none text-center font-mono tracking-widest ${darkMode ? 'bg-slate-600 border-slate-500 text-slate-200' : 'bg-white border-slate-200'}`}
                                />
                                <button
                                    onClick={() => {
                                        const name = document.getElementById('kid-name-input').value.trim();
                                        const avatar = document.getElementById('kid-avatar-input').value || '🧒';
                                        const pin = document.getElementById('kid-pin-input').value;
                                        if (!name) { alert('Please enter a name'); return; }
                                        if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) { alert('Please enter a 4-digit PIN'); return; }
                                        addKidProfile(name, avatar, pin);
                                        document.getElementById('kid-name-input').value = '';
                                        document.getElementById('kid-avatar-input').value = '🧒';
                                        document.getElementById('kid-pin-input').value = '';
                                    }}
                                    className="w-full py-3 bg-purple-600 text-white font-bold text-sm rounded-xl"
                                >
                                    ➕ Add Kid
                                </button>
                            </div>
                        </div>

                        {/* Existing Kids */}
                        {kidProfiles.length > 0 && (
                            <div className="space-y-2">
                                <p className={`text-[10px] font-black uppercase ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Current Kids ({kidProfiles.length})</p>
                                {kidProfiles.map(kid => (
                                    <div key={kid.id} className={`p-3 rounded-xl border flex items-center justify-between ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{kid.avatar || '🧒'}</span>
                                            <div>
                                                <p className={`font-bold text-sm ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{kid.name}</p>
                                                <p className="text-[10px] text-slate-400">PIN: ••••</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => deleteKidProfile(kid.id, kid.name)}
                                            className="text-red-400 hover:text-red-600 p-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Navigation (Fixed) */}
            {
                view !== 'home' && (
                    <nav className="shrink-0 h-16 w-full bg-slate-900 flex items-center justify-around px-4 border-t border-white/5 z-50">
                        <button onClick={() => setView('hub')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'hub' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                            <User className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Hub</span>
                        </button>
                        <button onClick={() => setView('bridge')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'bridge' || view === 'resolve' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                            <ShieldCheckComp className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Bridge</span>
                        </button>
                        <button onClick={() => setView('games')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'games' ? 'text-purple-500 scale-110' : 'text-slate-500'}`}>
                            <Gamepad2 className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Games</span>
                        </button>
                        <button onClick={() => setView('date')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'date' ? 'text-pink-500 scale-110' : 'text-slate-500'}`}>
                            <Calendar className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Date</span>
                        </button>
                        <button onClick={() => setView('nudge')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'nudge' ? 'text-amber-500 scale-110' : 'text-slate-500'}`}>
                            <Bell className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Nudge</span>
                        </button>
                    </nav>
                )
            }
        </div >
    );
};

export default App;