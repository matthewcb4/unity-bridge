import React, { useState, useEffect } from 'react';
import {
    Heart, Flame, Sparkles, MessageCircle, Copy, Check,
    RefreshCcw, Settings, BookOpen, ChevronRight, User,
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

const GEMINI_API_KEY = "AIzaSyBeXevp3C3TwFRpJCbnjUXllSG5YH1ok9A";

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
    const [affectionType, setAffectionType] = useState('words');

    const [wifeName, setWifeName] = useState(localStorage.getItem('wife_name') || '');
    const [husbandName, setHusbandName] = useState(localStorage.getItem('husband_name') || '');

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
        if (!user || !role || !db) return;

        const bridgeRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'bridge_items');
        const unsubBridge = onSnapshot(bridgeRef, (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setBridgeItems(items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
        }, (err) => console.error("Bridge Sync Error:", err));

        const journalRef = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'private_journal');
        const unsubJournal = onSnapshot(journalRef, (snap) => {
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setJournalItems(items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
        }, (err) => console.error("Journal Sync Error:", err));

        // Initial content load
        refreshVaults();

        return () => { unsubBridge(); unsubJournal(); };
    }, [user, role]);

    // --- ACTIONS ---

    const callGemini = async (prompt) => {
        if (!GEMINI_API_KEY) { alert("Missing API Key"); return null; }
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });
            const data = await response.json();
            return JSON.parse(data.candidates[0].content.parts[0].text);
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
        const primaryGoal = role === 'his'
            ? `Help ${sender} (Husband) meet the needs of ${receiver} (Wife). Her primary love language is WORDS OF AFFIRMATION and FLIRTING.`
            : `Help ${sender} (Wife) meet the needs of ${receiver} (Husband). His primary love language is PHYSICAL TOUCH and INTIMACY.`;

        const systemPrompt = `You are a relationship expert. ${primaryGoal} Return ONLY JSON: { "words": { "gentle": [], "flirty": [], "appreciative": [] }, "touch": { "daily": [], "sensual": [], "initiation": [] } }`;
        const result = await callGemini(systemPrompt);
        if (result) {
            setVaultMessages(result.words);
            setTouchIdeas(result.touch);
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
        if (!user) return;
        const content = customContent || editableOutput;
        if (!content) return;
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'bridge_items'), {
            content, author: role, timestamp: serverTimestamp(), type: customContent ? 'reset' : 'shared'
        });
        setEditableOutput(''); setInputText('');
    };

    const saveToJournal = async (manualText = null, meta = {}) => {
        if (!user) return;
        const content = manualText || editableOutput || inputText;
        if (!content) return;
        await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'private_journal'), {
            content, timestamp: serverTimestamp(), ...meta
        });
        setEditableOutput(''); setInputText(''); setJournalPrompt(null);
    };

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
                        <input value={husbandName} onChange={(e) => { setHusbandName(e.target.value); localStorage.setItem('husband_name', e.target.value); }} placeholder="Name" className="w-full bg-slate-50 p-5 rounded-[2rem] text-sm border border-slate-100 focus:border-blue-300 outline-none shadow-inner" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-rose-500 uppercase ml-2 tracking-widest">Wife</label>
                        <input value={wifeName} onChange={(e) => { setWifeName(e.target.value); localStorage.setItem('wife_name', e.target.value); }} placeholder="Name" className="w-full bg-slate-50 p-5 rounded-[2rem] text-sm border border-slate-100 focus:border-rose-300 outline-none shadow-inner" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 w-full gap-5">
                <button onClick={() => { setRole('his'); setView('hub'); setAffectionType('words'); }} className="p-7 bg-white border border-slate-100 rounded-[3rem] shadow-xl flex items-center justify-between active:scale-95 transition-all">
                    <div className="text-left"><h3 className="text-2xl font-black text-slate-800">Husband's Hub</h3><p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">Nurturing her needs</p></div>
                    <div className="w-14 h-14 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner"><MessageCircle className="w-7 h-7" /></div>
                </button>
                <button onClick={() => { setRole('hers'); setView('hub'); setAffectionType('physical'); }} className="p-7 bg-white border border-slate-100 rounded-[3rem] shadow-xl flex items-center justify-between active:scale-95 transition-all">
                    <div className="text-left"><h3 className="text-2xl font-black text-slate-800">Wife's Hub</h3><p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mt-1">Nurturing his needs</p></div>
                    <div className="w-14 h-14 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner"><Hand className="w-7 h-7" /></div>
                </button>
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
                                {['affection', 'conflict', 'journal'].map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400'}`}>{tab}</button>
                                ))}
                            </div>

                            {activeTab === 'affection' && (
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-rose-50 p-6 space-y-6">
                                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                                        <button onClick={() => { setAffectionType('words'); setVaultStyle('gentle'); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${affectionType === 'words' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Words</button>
                                        <button onClick={() => { setAffectionType('physical'); setVaultStyle('daily'); }} className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${affectionType === 'physical' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Physical</button>
                                    </div>
                                    <div className="flex gap-1.5 p-1 bg-slate-100/50 rounded-xl overflow-x-auto no-scrollbar">
                                        {(affectionType === 'words' ? ['gentle', 'flirty', 'appreciative'] : ['daily', 'sensual', 'initiation']).map(s => (
                                            <button key={s} onClick={() => setVaultStyle(s)} className={`flex-1 py-2 px-3 text-[8px] font-black uppercase whitespace-nowrap rounded-lg transition-all ${vaultStyle === s ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>{s}</button>
                                        ))}
                                    </div>
                                    <div className="space-y-4">
                                        {(affectionType === 'words' ? (vaultMessages[vaultStyle] || []) : (touchIdeas[vaultStyle] || [])).map((msg, i) => (
                                            <button key={i} onClick={() => affectionType === 'words' && copyToClipboard(msg, `v-${i}`)} className="w-full text-left p-6 rounded-[2rem] bg-slate-50 border border-slate-200 relative active:scale-[0.98] transition-all hover:bg-white hover:border-rose-200">
                                                <p className="text-sm text-slate-700 italic font-medium pr-8 leading-relaxed">"{msg}"</p>
                                            </button>
                                        ))}
                                    </div>
                                    <button onClick={refreshVaults} className="w-full py-4 text-[10px] font-black uppercase text-slate-400 flex items-center justify-center gap-2"><RefreshCcw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} /> Get New Ideas</button>
                                </div>
                            )}

                            {activeTab === 'conflict' && (
                                <div className="bg-white rounded-[2.5rem] shadow-xl border border-rose-50 p-6 space-y-6">
                                    <div className="flex items-center gap-3"><AlertCircle className="w-5 h-5 text-orange-500" /><h2 className="font-black text-slate-800 text-sm uppercase">Rephrasing</h2></div>
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
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Your Entries</h3>
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
                                                    <p className="text-xs text-slate-600 italic leading-relaxed">"{item.content}"</p>
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
                                <h2 className="text-2xl font-black text-slate-800 tracking-tighter italic px-4">Shared History</h2>
                                {bridgeItems.map(item => (
                                    <div key={item.id} className={`p-8 rounded-[3rem] border-2 relative ${item.author === role ? 'bg-slate-50 border-slate-100' : 'bg-rose-50/50 border-rose-100'}`}>
                                        <div className="flex justify-between mb-3"><span className={`text-[10px] font-black uppercase tracking-widest ${item.author === 'his' ? 'text-blue-500' : 'text-rose-500'}`}>{item.author === 'his' ? husbandName : wifeName}</span></div>
                                        <p className="text-base text-slate-700 italic font-medium leading-relaxed">"{item.content}"</p>
                                    </div>
                                ))}
                            </div>
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
                <nav className="shrink-0 h-20 w-full bg-slate-900 flex items-center justify-around px-8 border-t border-white/5 z-50">
                    <button onClick={() => setView('hub')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'hub' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                        <User className="w-7 h-7" /><span className="text-[9px] font-black uppercase tracking-[0.2em]">Hub</span>
                    </button>
                    <button onClick={() => setView('bridge')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'bridge' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                        <ShieldCheckComp className="w-7 h-7" /><span className="text-[9px] font-black uppercase tracking-[0.2em]">Bridge</span>
                    </button>
                    <button onClick={() => setView('nudge')} className={`flex flex-col items-center gap-1.5 transition-all ${view === 'nudge' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                        <Bell className="w-7 h-7" /><span className="text-[9px] font-black uppercase tracking-[0.2em]">Nudge</span>
                    </button>
                </nav>
            )}
        </div>
    );
};

export default App;