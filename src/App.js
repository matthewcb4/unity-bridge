import React, { useState, useEffect } from 'react';
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
    getFirestore, doc, setDoc, getDoc, collection,
    onSnapshot, addDoc, serverTimestamp, query
} from 'firebase/firestore';

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
    const [view, setView] = useState('home');
    const [role, setRole] = useState(localStorage.getItem('user_role') || null);
    const [activeTab, setActiveTab] = useState('affection');
    const [affectionType, setAffectionType] = useState('primary');

    const [wifeName, setWifeName] = useState(localStorage.getItem('wife_name') || '');
    const [husbandName, setHusbandName] = useState(localStorage.getItem('husband_name') || '');
    const [coupleCode, setCoupleCode] = useState(localStorage.getItem('couple_code') || '');

    const [bridgeItems, setBridgeItems] = useState([]);
    const [journalItems, setJournalItems] = useState([]);
    const [vaultMessages, setVaultMessages] = useState({ gentle: [], flirty: [], appreciative: [] });
    const [touchIdeas, setTouchIdeas] = useState({ daily: [], sensual: [], initiation: [] });
    const [pulse, setPulse] = useState(null);

    const [vaultStyle, setVaultStyle] = useState('gentle');
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
    const [currentGame, setCurrentGame] = useState(null);
    const [gameHistory, setGameHistory] = useState([]);
    const [gameAnswer, setGameAnswer] = useState('');

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
        const settingsRef = doc(db, sharedNamespace, 'settings');
        const unsubSettings = onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.hisLoveLanguage) setHisLoveLanguage(data.hisLoveLanguage);
                if (data.herLoveLanguage) setHerLoveLanguage(data.herLoveLanguage);
                if (data.husbandName) setHusbandName(data.husbandName);
                if (data.wifeName) setWifeName(data.wifeName);
            }
        }, (err) => console.error("Settings Sync Error:", err));

        // Listen for active game
        const gameRef = doc(db, sharedNamespace, 'current_game');
        const unsubGame = onSnapshot(gameRef, (snap) => {
            if (snap.exists()) {
                setCurrentGame({ id: snap.id, ...snap.data() });
            } else {
                setCurrentGame(null);
            }
        }, (err) => console.error("Game Sync Error:", err));

        // Listen for game history
        const historyRef = collection(db, sharedNamespace, 'game_history');
        const unsubHistory = onSnapshot(historyRef, (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setGameHistory(items.sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)));
        }, (err) => console.error("Game History Error:", err));

        // Initial content load
        refreshVaults();

        return () => { unsubBridge(); unsubJournal(); unsubSettings(); unsubGame(); unsubHistory(); };
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

        const systemPrompt = `You are a relationship expert helping ${sender} show love to ${receiver}.

Partner's PRIMARY love language: ${partnerLanguage}

Generate specific, actionable suggestions in these categories:
- Primary category 1: "${cats.primary[0]}" - 3 ideas
- Primary category 2: "${cats.primary[1]}" - 3 ideas
- Primary category 3: "${cats.primary[2]}" - 3 ideas
- Secondary category 1: "${cats.secondary[0]}" - 3 ideas
- Secondary category 2: "${cats.secondary[1]}" - 3 ideas
- Secondary category 3: "${cats.secondary[2]}" - 3 ideas

Return ONLY JSON: { "primary": { "${cats.primary[0]}": ["idea1", "idea2", "idea3"], "${cats.primary[1]}": ["idea1", "idea2", "idea3"], "${cats.primary[2]}": ["idea1", "idea2", "idea3"] }, "secondary": { "${cats.secondary[0]}": ["idea1", "idea2", "idea3"], "${cats.secondary[1]}": ["idea1", "idea2", "idea3"], "${cats.secondary[2]}": ["idea1", "idea2", "idea3"] } }`;

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
        const logs = bridgeItems.slice(0, 10).map(i => `${i.author}: ${i.content}`).join('\n');
        const systemPrompt = `Analyze logs:\n${logs}\nJSON: { "vibe": "one word", "pattern": "one sentence", "focus": "one goal" }`;
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
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            const settingsRef = doc(db, sharedNamespace, 'settings');
            await setDoc(settingsRef, updates, { merge: true });
        } catch (err) {
            console.error('Settings save error:', err);
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
    const getPersonalizedWords = () => {
        const words = [];

        // Add partner names (minimum 4 letters)
        if (husbandName && husbandName.length >= 4) words.push(husbandName.toUpperCase());
        if (wifeName && wifeName.length >= 4) words.push(wifeName.toUpperCase());

        // Extract meaningful words from journal entries
        journalItems.forEach(item => {
            if (item.content) {
                const journalWords = item.content
                    .split(/\s+/)
                    .map(w => w.replace(/[^a-zA-Z]/g, '').toUpperCase())
                    .filter(w => w.length >= 4 && w.length <= 8);
                words.push(...journalWords);
            }
        });

        // Add romantic fallback words
        const fallbackWords = [
            'LOVE', 'HEART', 'TRUST', 'UNITY', 'CARE', 'HOPE', 'DREAM', 'BLISS',
            'ADORE', 'SPARK', 'SWEET', 'CHARM', 'GRACE', 'FAITH', 'LOYAL',
            'PEACE', 'HAPPY', 'SMILE', 'WARM', 'KIND', 'GENTLE', 'TENDER', 'DEAR'
        ];
        words.push(...fallbackWords);

        // Remove duplicates and short words
        return [...new Set(words)].filter(w => w.length >= 4);
    };

    const scrambleWord = (word) => {
        if (word.length < 3) return word;
        const arr = word.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        // Make sure it's actually scrambled
        return arr.join('') === word ? scrambleWord(word) : arr.join('');
    };

    const createWordPuzzle = async (wager = '') => {
        if (!coupleCode || !db || !role) return;

        const personalWords = getPersonalizedWords();
        const word = personalWords[Math.floor(Math.random() * personalWords.length)];
        const scrambled = scrambleWord(word);
        const creatorName = role === 'his' ? husbandName : wifeName;

        // Check if it's a personal word (name or from journal)
        const isPersonal = word === husbandName?.toUpperCase() || word === wifeName?.toUpperCase() ||
            journalItems.some(j => j.content?.toUpperCase().includes(word));

        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            const gameRef = doc(db, sharedNamespace, 'current_game');
            await setDoc(gameRef, {
                type: 'word_scramble',
                word: word,
                scrambled: scrambled,
                wager: wager,
                isPersonal: isPersonal,
                hint: isPersonal ? '💕 This word is special to us!' : '',
                createdBy: role,
                creatorName: creatorName,
                createdAt: serverTimestamp(),
                solved: false
            });
            setGameAnswer('');
        } catch (err) {
            console.error('Create game error:', err);
            alert('Could not create game. Please try again.');
        }
    };

    const submitGameAnswer = async () => {
        if (!currentGame || !gameAnswer || !coupleCode || !db) return;

        const isCorrect = gameAnswer.toUpperCase().trim() === currentGame.word;
        const playerName = role === 'his' ? husbandName : wifeName;

        if (isCorrect) {
            try {
                const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;

                // Save to history
                const historyRef = collection(db, sharedNamespace, 'game_history');
                await addDoc(historyRef, {
                    type: currentGame.type,
                    word: currentGame.word,
                    wager: currentGame.wager,
                    createdBy: currentGame.createdBy,
                    creatorName: currentGame.creatorName,
                    solvedBy: role,
                    solverName: playerName,
                    completedAt: serverTimestamp()
                });

                // Clear current game
                const gameRef = doc(db, sharedNamespace, 'current_game');
                await setDoc(gameRef, { solved: true, solvedBy: role, solverName: playerName }, { merge: true });

                alert(`🎉 Correct! ${currentGame.wager ? `\n\n💝 Wager: ${currentGame.wager}` : ''}`);
                setGameAnswer('');
            } catch (err) {
                console.error('Submit answer error:', err);
            }
        } else {
            alert('❌ Not quite! Try again.');
        }
    };

    const clearCurrentGame = async () => {
        if (!coupleCode || !db) return;
        if (!window.confirm('Clear this puzzle? Both partners will lose it.')) return;
        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            const gameRef = doc(db, sharedNamespace, 'current_game');
            await setDoc(gameRef, {}, { merge: false });
            setCurrentGame(null);
        } catch (err) {
            console.error('Clear game error:', err);
        }
    };

    const clearBridgeView = () => {
        if (window.confirm('Clear your bridge history? (This only clears your view, not your partner\'s)')) {
            const now = Date.now();
            setBridgeClearedAt(now);
            localStorage.setItem(`bridge_cleared_${role}`, now.toString());
        }
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
        <div className="flex flex-col items-center justify-center h-full px-8 space-y-12 py-12">
            <div className="text-center space-y-3">
                <div className="bg-rose-100 p-8 rounded-full inline-block mb-2 shadow-inner border-4 border-white">
                    <Heart className="w-16 h-16 text-rose-600 fill-rose-600" />
                </div>
                <h1 className="text-5xl font-black text-slate-800 tracking-tighter italic uppercase">Unity Bridge</h1>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em]">Relationship OS</p>
            </div>

            <div className="w-full bg-white p-8 rounded-[3rem] shadow-2xl border border-rose-50 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-500 uppercase ml-2 tracking-widest">Husband</label>
                        <input value={husbandName} onChange={(e) => { setHusbandName(e.target.value); localStorage.setItem('husband_name', e.target.value); saveSettings({ husbandName: e.target.value }); }} placeholder="Name" className="w-full bg-slate-50 p-5 rounded-[2rem] text-sm border border-slate-100 focus:border-blue-300 outline-none shadow-inner" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-rose-500 uppercase ml-2 tracking-widest">Wife</label>
                        <input value={wifeName} onChange={(e) => { setWifeName(e.target.value); localStorage.setItem('wife_name', e.target.value); saveSettings({ wifeName: e.target.value }); }} placeholder="Name" className="w-full bg-slate-50 p-5 rounded-[2rem] text-sm border border-slate-100 focus:border-rose-300 outline-none shadow-inner" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">His Love Language</label>
                        <select
                            value={hisLoveLanguage}
                            onChange={(e) => { setHisLoveLanguage(e.target.value); localStorage.setItem('his_love_language', e.target.value); saveSettings({ hisLoveLanguage: e.target.value }); }}
                            className="w-full bg-blue-50 p-4 rounded-2xl text-xs border border-blue-100 outline-none"
                        >
                            <option>Physical Touch</option>
                            <option>Words of Affirmation</option>
                            <option>Quality Time</option>
                            <option>Acts of Service</option>
                            <option>Receiving Gifts</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-rose-400 uppercase ml-2 tracking-widest">Her Love Language</label>
                        <select
                            value={herLoveLanguage}
                            onChange={(e) => { setHerLoveLanguage(e.target.value); localStorage.setItem('her_love_language', e.target.value); saveSettings({ herLoveLanguage: e.target.value }); }}
                            className="w-full bg-rose-50 p-4 rounded-2xl text-xs border border-rose-100 outline-none"
                        >
                            <option>Words of Affirmation</option>
                            <option>Physical Touch</option>
                            <option>Quality Time</option>
                            <option>Acts of Service</option>
                            <option>Receiving Gifts</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="text-[10px] font-black text-purple-500 uppercase ml-2 tracking-widest flex items-center gap-2">
                        <Lock className="w-3 h-3" /> Couple Code
                    </label>
                    <input
                        value={coupleCode}
                        onChange={(e) => { setCoupleCode(e.target.value); localStorage.setItem('couple_code', e.target.value); }}
                        placeholder="Enter a shared code (e.g. smith2024)"
                        className="w-full bg-purple-50 p-5 rounded-[2rem] text-sm border border-purple-100 focus:border-purple-300 outline-none shadow-inner text-center font-mono tracking-widest"
                    />
                    <p className="text-[9px] text-slate-400 text-center px-4">Use the same code on all your devices to sync your data</p>
                </div>
            </div>

            <div className="grid grid-cols-1 w-full gap-5">
                <button
                    onClick={() => { if (coupleCode) { setRole('his'); localStorage.setItem('user_role', 'his'); setView('hub'); setAffectionType('words'); } }}
                    className={`p-7 bg-white border border-slate-100 rounded-[3rem] shadow-xl flex items-center justify-between transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
                >
                    <div className="text-left"><h3 className="text-2xl font-black text-slate-800">Husband's Hub</h3><p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">Nurturing her needs</p></div>
                    <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner"><MessageCircle className="w-7 h-7" /></div>
                </button>
                <button
                    onClick={() => { if (coupleCode) { setRole('hers'); localStorage.setItem('user_role', 'hers'); setView('hub'); setAffectionType('physical'); } }}
                    className={`p-7 bg-white border border-slate-100 rounded-[3rem] shadow-xl flex items-center justify-between transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
                >
                    <div className="text-left"><h3 className="text-2xl font-black text-slate-800">Wife's Hub</h3><p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mt-1">Nurturing his needs</p></div>
                    <div className="w-14 h-14 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner"><Hand className="w-7 h-7" /></div>
                </button>
                {!coupleCode && <p className="text-[10px] text-purple-500 text-center font-bold">Enter a couple code above to get started</p>}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 w-full bg-[#FDF8F8] flex flex-col font-sans text-slate-900 overflow-hidden select-none" style={{ height: 'var(--app-height, 100vh)' }}>
            <header className="shrink-0 h-16 w-full flex items-center justify-between px-6 bg-white border-b border-rose-50 z-50 shadow-sm">
                {view !== 'home' ? (
                    <button onClick={() => setView('home')} className="p-2 active:bg-slate-50 rounded-xl transition-all"><ChevronRight className="w-6 h-6 rotate-180 text-slate-400" /></button>
                ) : <div className="w-10" />}
                <h1 className="text-xl font-black text-rose-600 flex items-center gap-2 tracking-tighter italic select-none"><Heart className="fill-rose-600 w-5 h-5" /> UNITY</h1>
                <div className="w-10" />
            </header>

            <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth touch-pan-y relative px-4">
                <div className="max-w-md mx-auto w-full h-full pb-24 pt-4">
                    {view === 'home' && renderHome()}

                    {view === 'hub' && (
                        <div className="space-y-6">
                            <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-100 shadow-sm sticky top-0 z-10">
                                {['affection', 'communicate', 'journal'].map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'}`}>{tab}</button>
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
                                    <div className="bg-white rounded-[2.5rem] shadow-xl border border-rose-50 p-6 space-y-6">
                                        <div className="text-center pb-2 border-b border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">For {partnerName}'s Love Language:</p>
                                            <p className="text-lg font-black text-rose-600">{partnerLanguage}</p>
                                        </div>
                                        <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                            <button onClick={() => { setAffectionType('primary'); setVaultStyle(primaryKeys[0] || ''); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${affectionType === 'primary' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Primary</button>
                                            <button onClick={() => { setAffectionType('secondary'); setVaultStyle(secondaryKeys[0] || ''); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${affectionType === 'secondary' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Secondary</button>
                                        </div>
                                        {currentKeys.length > 0 && (
                                            <div className="flex gap-1.5 p-1 bg-slate-100/50 rounded-xl overflow-x-auto no-scrollbar">
                                                {currentKeys.map(s => (
                                                    <button key={s} onClick={() => setVaultStyle(s)} className={`flex-1 py-2 px-3 text-[8px] font-black uppercase whitespace-nowrap rounded-lg transition-all ${vaultStyle === s ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>{s}</button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            {currentItems.length > 0 ? currentItems.map((msg, i) => (
                                                <div key={i} className="w-full p-6 rounded-[2rem] bg-slate-50 border border-slate-200 relative hover:bg-white hover:border-rose-200 transition-all">
                                                    <p className="text-sm text-slate-700 italic font-medium pr-12 leading-relaxed">"{msg}"</p>
                                                    <button
                                                        onClick={() => copyToClipboard(msg, `v-${i}`)}
                                                        className="absolute top-4 right-4 p-2 rounded-xl bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50 transition-all"
                                                    >
                                                        {copiedId === `v-${i}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                                                    </button>
                                                </div>
                                            )) : (
                                                <div className="text-center py-8 text-slate-400">
                                                    <p className="text-sm">Tap "Get New Ideas" to load suggestions</p>
                                                    <p className="text-xs mt-1">tailored to {partnerName}'s love language</p>
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={refreshVaults} disabled={isRefreshing} className="w-full py-4 text-[10px] font-black uppercase text-slate-400 flex items-center justify-center gap-2 disabled:opacity-50">
                                            <RefreshCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                                            {isRefreshing ? 'Generating...' : 'Get New Ideas'}
                                        </button>
                                    </div>
                                );
                            })()}

                            {activeTab === 'communicate' && (
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-rose-50 p-6 space-y-6">
                                    <div className="flex items-center gap-3"><MessageCircle className="w-5 h-5 text-blue-500" /><h2 className="font-black text-slate-800 text-sm uppercase">Communicate Better</h2></div>
                                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Draft your thought..." className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl text-sm min-h-[140px] outline-none focus:ring-4 focus:ring-orange-50" />
                                    <button onClick={translateMessage} disabled={isGenerating || !inputText} className="w-full bg-slate-900 text-white font-black py-4 rounded-3xl shadow-xl flex items-center justify-center gap-2">
                                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "TRANSLATE"}
                                    </button>
                                    {editableOutput && (
                                        <div className="space-y-4 pt-4 animate-in fade-in">
                                            <div className="p-1 bg-green-50 border-2 border-green-100 rounded-[2rem] overflow-hidden">
                                                <textarea value={editableOutput} onChange={(e) => setEditableOutput(e.target.value)} className="w-full p-6 bg-transparent text-sm italic font-medium text-slate-700 outline-none min-h-[120px]" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={() => saveToJournal()} className="bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl text-[10px] flex items-center justify-center gap-2 border border-slate-200">PRIVATE</button>
                                                <button onClick={saveToBridge} className="bg-green-600 text-white font-bold py-4 rounded-2xl text-[10px] flex items-center justify-center gap-2">SHARE</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'journal' && (
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 p-6 space-y-6">
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
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Entries</h3>
                                            <button
                                                onClick={generateJournalInsights}
                                                disabled={isGenerating || journalItems.length === 0}
                                                className="text-[9px] font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full uppercase flex items-center gap-1 hover:bg-purple-100 transition-all disabled:opacity-50"
                                            >
                                                <Sparkles className="w-3 h-3" />
                                                {isGenerating ? 'Analyzing...' : 'Get Insights'}
                                            </button>
                                        </div>
                                        {journalItems.map(item => {
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
                                                    <p className="text-xs text-slate-600 italic leading-relaxed mb-3">"{item.content}"</p>
                                                    <div className="flex gap-2">
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
                                                            Share to Bridge
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'bridge' && (
                        <div className="p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                            <div className="bg-slate-900 rounded-[3rem] p-8 shadow-2xl space-y-6 border border-white/10 relative overflow-hidden">
                                <div className="flex items-center gap-4"><Wind className="w-6 h-6 text-blue-400" /><h2 className="text-white font-black uppercase text-sm tracking-widest">Safe Reset</h2></div>
                                <button onClick={() => saveToBridge("I'm feeling flooded and need a 20-minute timeout. I love you.")} className="w-full bg-blue-600 text-white font-black py-5 rounded-[2.5rem] shadow-lg active:scale-95 text-sm">SIGNAL TIMEOUT</button>
                            </div>
                            <div className="bg-white rounded-[3rem] shadow-xl border border-rose-100 p-8 space-y-6">
                                <div className="flex justify-between items-center"><h2 className="text-xs font-black text-rose-600 uppercase">Pulse Analysis</h2><button onClick={generatePulse} className="text-[10px] font-black text-rose-600 border px-4 py-1 rounded-full uppercase">Analyze</button></div>
                                {pulse && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 rounded-[2rem] text-center"><p className="text-[8px] font-black text-slate-400 mb-1">Vibe</p><p className="text-sm font-black text-rose-600 italic">"{pulse.vibe}"</p></div>
                                        <div className="p-4 bg-slate-50 rounded-[2rem]"><p className="text-[8px] font-black text-slate-400 mb-1">Pattern</p><p className="text-[11px] font-bold text-slate-700">{pulse.pattern}</p></div>
                                        <div className="p-6 bg-rose-600 rounded-[2.5rem] text-white col-span-2"><p className="text-[10px] font-black opacity-70 mb-1 uppercase tracking-widest">Shared Focus</p><p className="text-sm font-bold leading-relaxed">{pulse.focus}</p></div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-4">
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic">Shared History</h2>
                                    <button
                                        onClick={clearBridgeView}
                                        className="text-[9px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-red-50 hover:text-red-500 transition-all"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        Clear My View
                                    </button>
                                </div>
                                {visibleBridgeItems.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <p className="text-sm">No messages yet</p>
                                        <p className="text-xs mt-1">Share something from the hub to start!</p>
                                    </div>
                                ) : (
                                    visibleBridgeItems.map(item => (
                                        <div key={item.id} className={`p-8 rounded-[3rem] border-2 relative ${item.author === role ? 'bg-slate-50 border-slate-100' : 'bg-rose-50/50 border-rose-100'}`}>
                                            <div className="flex justify-between mb-3"><span className={`text-[10px] font-black uppercase tracking-widest ${item.author === 'his' ? 'text-blue-500' : 'text-rose-500'}`}>{item.author === 'his' ? husbandName : wifeName}</span></div>
                                            <p className="text-base text-slate-700 italic font-medium leading-relaxed">"{item.content}"</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'date' && (
                        <div className="p-8 space-y-8 animate-in slide-in-from-bottom-4">
                            <div className="text-center space-y-4 pt-4">
                                <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-xl">
                                    <Heart className="w-12 h-12 text-pink-600" />
                                </div>
                                <h2 className="text-4xl font-black text-slate-800 tracking-tighter italic">Date Night</h2>
                                <p className="text-sm text-slate-400">AI-generated date ideas just for you two</p>
                            </div>

                            <div className="bg-white rounded-[3rem] shadow-xl border border-pink-100 p-6 space-y-4">
                                <h3 className="text-xs font-black text-pink-600 uppercase tracking-widest text-center">Select Your Budget</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    {[{ id: 'free', label: 'Free', emoji: '🆓' }, { id: 'cheap', label: '<$30', emoji: '💵' }, { id: 'moderate', label: '$30-75', emoji: '💳' }, { id: 'splurge', label: '$75+', emoji: '✨' }].map(budget => (
                                        <button
                                            key={budget.id}
                                            onClick={() => generateDateNight(budget.id)}
                                            disabled={isGenerating}
                                            className="p-4 bg-slate-50 hover:bg-pink-50 border border-slate-200 hover:border-pink-200 rounded-2xl text-center transition-all disabled:opacity-50"
                                        >
                                            <span className="text-2xl block mb-1">{budget.emoji}</span>
                                            <span className="text-[9px] font-bold text-slate-600">{budget.label}</span>
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

                    {view === 'games' && (
                        <div className="p-6 space-y-6 animate-in slide-in-from-bottom-4">
                            <div className="text-center space-y-3 pt-4">
                                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-xl">
                                    <Gamepad2 className="w-10 h-10 text-purple-600" />
                                </div>
                                <h2 className="text-3xl font-black text-slate-800 tracking-tighter italic">Couple Games</h2>
                                <p className="text-sm text-slate-400">Play together, wager fun rewards!</p>
                            </div>

                            {/* Active Game or Create New */}
                            {currentGame && !currentGame.solved ? (
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-100 p-6 space-y-4">
                                    <div className="text-center">
                                        <p className="text-[10px] font-bold text-purple-500 uppercase">Word Scramble from {currentGame.creatorName}</p>
                                        {currentGame.hint && (
                                            <p className="text-xs text-pink-500 mt-1">{currentGame.hint}</p>
                                        )}
                                    </div>
                                    <div className="text-center py-6">
                                        <p className="text-4xl font-black text-slate-800 tracking-[0.3em]">{currentGame.scrambled}</p>
                                    </div>
                                    {currentGame.wager && (
                                        <div className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl text-center">
                                            <p className="text-[10px] font-bold text-purple-600 uppercase">💝 Wager</p>
                                            <p className="text-sm font-bold text-slate-700 mt-1">{currentGame.wager}</p>
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        value={gameAnswer}
                                        onChange={(e) => setGameAnswer(e.target.value)}
                                        placeholder="Your answer..."
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-lg font-bold uppercase outline-none focus:border-purple-300"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={submitGameAnswer}
                                            disabled={!gameAnswer}
                                            className="flex-1 py-4 text-sm font-black text-white bg-purple-600 rounded-2xl disabled:opacity-50"
                                        >
                                            Submit Answer
                                        </button>
                                        <button
                                            onClick={clearCurrentGame}
                                            className="py-4 px-4 text-sm font-bold text-slate-400 bg-slate-100 rounded-2xl"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-100 p-6 space-y-4">
                                    <h3 className="text-center text-sm font-black text-purple-600 uppercase">Create a Puzzle for Your Partner</h3>
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
                                        }}
                                        className="w-full py-4 text-sm font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl shadow-lg"
                                    >
                                        🎲 Generate Word Puzzle
                                    </button>
                                </div>
                            )}

                            {/* Game History & Scoreboard */}
                            {gameHistory.length > 0 && (
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-purple-100 p-6 space-y-4">
                                    <div className="flex items-center gap-2 justify-center">
                                        <Trophy className="w-5 h-5 text-yellow-500" />
                                        <h3 className="text-sm font-black text-slate-800 uppercase">Scoreboard</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center p-4 bg-blue-50 rounded-2xl">
                                            <p className="text-[10px] font-bold text-blue-500 uppercase">{husbandName || 'Him'}</p>
                                            <p className="text-3xl font-black text-blue-600">
                                                {gameHistory.filter(g => g.solvedBy === 'his').length}
                                            </p>
                                        </div>
                                        <div className="text-center p-4 bg-rose-50 rounded-2xl">
                                            <p className="text-[10px] font-bold text-rose-500 uppercase">{wifeName || 'Her'}</p>
                                            <p className="text-3xl font-black text-rose-600">
                                                {gameHistory.filter(g => g.solvedBy === 'hers').length}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Recent Games</p>
                                        {gameHistory.slice(0, 5).map((game, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                <span className="text-xs font-bold text-slate-600">{game.word}</span>
                                                <span className="text-[10px] font-bold text-purple-600">Won by {game.solverName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'nudge' && (
                        <div className="p-8 space-y-8 animate-in slide-in-from-bottom-4">
                            <div className="text-center space-y-4 pt-4">
                                <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-xl"><Bell className="w-12 h-12 text-rose-600" /></div>
                                <h2 className="text-4xl font-black text-slate-800 tracking-tighter italic">Nudge Center</h2>
                                <p className="text-sm text-slate-400">Set daily reminders to nurture your connection</p>
                            </div>
                            <div className="space-y-4">
                                {['Morning', 'Lunch', 'Evening'].map(time => {
                                    const nudge = NUDGE_DATA[time];
                                    const NudgeIcon = nudge.icon;
                                    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Unity Bridge: ${nudge.prompt}`)}&details=${encodeURIComponent(`Reminder: ${nudge.suggestion}\n\nOpen Unity Bridge to connect with your spouse.`)}&recur=RRULE:FREQ=DAILY`;
                                    const iphoneText = `${time} Unity Nudge (${nudge.time})\n${nudge.prompt}\n${nudge.suggestion}`;
                                    return (
                                        <div key={time} className="p-6 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center shrink-0">
                                                    <NudgeIcon className="w-6 h-6 text-rose-600" />
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
                    )}
                </div>
            </main>

            {/* Navigation (Fixed) */}
            {view !== 'home' && (
                <nav className="shrink-0 h-20 w-full bg-slate-900 flex items-center justify-around px-4 border-t border-white/5 z-50">
                    <button onClick={() => setView('hub')} className={`flex flex-col items-center gap-1 transition-all ${view === 'hub' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                        <User className="w-6 h-6" /><span className="text-[8px] font-black uppercase tracking-wider">Hub</span>
                    </button>
                    <button onClick={() => setView('bridge')} className={`flex flex-col items-center gap-1 transition-all ${view === 'bridge' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                        <ShieldCheckComp className="w-6 h-6" /><span className="text-[8px] font-black uppercase tracking-wider">Bridge</span>
                    </button>
                    <button onClick={() => setView('games')} className={`flex flex-col items-center gap-1 transition-all ${view === 'games' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                        <Gamepad2 className="w-6 h-6" /><span className="text-[8px] font-black uppercase tracking-wider">Games</span>
                    </button>
                    <button onClick={() => setView('date')} className={`flex flex-col items-center gap-1 transition-all ${view === 'date' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                        <Calendar className="w-6 h-6" /><span className="text-[8px] font-black uppercase tracking-wider">Date</span>
                    </button>
                    <button onClick={() => setView('nudge')} className={`flex flex-col items-center gap-1 transition-all ${view === 'nudge' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                        <Bell className="w-6 h-6" /><span className="text-[8px] font-black uppercase tracking-wider">Nudge</span>
                    </button>
                </nav>
            )}
        </div>
    );
};

export default App;