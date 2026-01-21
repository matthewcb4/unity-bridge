import React, { useState, useEffect, useRef } from 'react';
import {
    Heart, Flame, Sparkles, MessageCircle, Copy, Check, Share2,
    RefreshCcw, Settings, BookOpen, ChevronRight, User, Gamepad2, Trophy,
    Loader2, ShieldCheck as ShieldIcon, Users, AlertCircle, Hand,
    Bell, Zap, Lock, Globe, Save, Trash2, Edit3, Send,
    Clock, Calendar, ExternalLink, Moon, Coffee, Anchor,
    Wind, Thermometer, PenTool, LayoutDashboard, Target, Shield, ShoppingCart
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
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import ShieldCheckComp from './components/ShieldCheckComp';
import CalendarView from './components/CalendarView';
import KidPortal from './features/kid-portal/KidPortal';
import GameHub from './features/games/GameHub';
import FamilyGamesHub from './features/games/FamilyGamesHub';
import { JOURNAL_TYPES, saveToJournal, deleteFromJournal, updateJournalEntry, exportJournalData } from './features/journaling/journalLogic';
import { requestNotificationPermission, sendPushNotification } from './features/notifications/notificationLogic';
import { useToast } from './components/Toast/ToastContext';
import OnboardingFlow from './components/Onboarding/OnboardingFlow';
import ProfilePhotoUpload from './components/ProfilePhotoUpload';
import ShoppingList from './components/ShoppingList';

// --- CONFIGURATION ---
const FIREBASE_CONFIG = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
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

const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

const APP_ID = 'unity-bridge-live';

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

// --- APP ---

const App = () => {
    // State
    const [user, setUser] = useState(null);
    const [authError, setAuthError] = useState(null);
    // Standard app logic (hold in memory, not persistent across reloads to avoid conflicts)
    const [view, setViewState] = useState(localStorage.getItem('current_view') || 'home');

    const setView = (newView) => {
        setViewState(newView);
        localStorage.setItem('current_view', newView);
    };

    const [role, setRole] = useState(localStorage.getItem('user_role'));
    const [activeTab, setActiveTab] = useState('affection');
    const [affectionType, setAffectionType] = useState('primary');

    const [wifeName, setWifeName] = useState('');
    const [husbandName, setHusbandName] = useState('');
    const [wifePetName, setWifePetName] = useState('');
    const [husbandPetName, setHusbandPetName] = useState('');
    const [coupleCode, setCoupleCode] = useState(localStorage.getItem('family_code') || '');
    const [coupleCodeInput, setCoupleCodeInput] = useState(localStorage.getItem('family_code') || ''); // Separate input state

    // Session-based authentication status (resets on tab close)
    const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('is_authenticated') === 'true');

    const [bridgeItems, setBridgeItems] = useState([]);
    const [replyingTo, setReplyingTo] = useState(null); // { id, content, author } - for replying to a bridge message
    const [expandedThreads, setExpandedThreads] = useState(new Set()); // Track which threads are expanded
    const [replyText, setReplyText] = useState(''); // Reply input text
    const [journalItems, setJournalItems] = useState([]);
    const [vaultMessages, setVaultMessages] = useState({ gentle: [], flirty: [], appreciative: [] });
    const [touchIdeas, setTouchIdeas] = useState({ daily: [], sensual: [], initiation: [] });
    const [pulse, setPulse] = useState(null);

    const [vaultStyle, setVaultStyle] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [inputText, setInputText] = useState(localStorage.getItem('talk_input_text') || '');
    const [editableOutput, setEditableOutput] = useState(localStorage.getItem('talk_editable_output') || '');
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

    // NEW: Profile Photos
    const [husbandPhoto, setHusbandPhoto] = useState('');
    const [wifePhoto, setWifePhoto] = useState('');

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
    const [currentKid, setCurrentKid] = useState(() => {
        const stored = localStorage.getItem('current_kid');
        return stored ? JSON.parse(stored) : null;
    });
    const [kidPinInput, setKidPinInput] = useState('');

    // Parent PIN Authentication
    const [parentPinInput, setParentPinInput] = useState('');
    const [showParentPinModal, setShowParentPinModal] = useState(false);
    const [pendingParentRole, setPendingParentRole] = useState(null); // 'his' or 'hers' - which parent is trying to log in

    // Missing States Fix
    const [showKidManager, setShowKidManager] = useState(false);
    const [gameHistory, setGameHistory] = useState([]);

    // Family Games Hub
    const [talkIntention, setTalkIntention] = useState('compliment'); // compliment, concern, question, update
    const [showFamilyCalendar, setShowFamilyCalendar] = useState(false);
    const [gamesMode, setGamesMode] = useState('couple'); // 'couple' | 'family' - toggle in Games view

    // Toast notifications
    const toast = useToast();

    // Onboarding flow
    const [showOnboarding, setShowOnboarding] = useState(() => {
        // Show onboarding if user has a couple code but hasn't completed setup
        const onboardingComplete = localStorage.getItem('onboarding_complete');
        return !onboardingComplete;
    });

    // Helper: Get current player ID (kid ID or parent role)
    const getCurrentPlayerId = () => currentKid ? currentKid.id : role;

    // Initialize PWA and Viewport
    useEffect(() => {
        const setAppHeight = () => {
            document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
        };
        window.addEventListener('resize', setAppHeight);
        setAppHeight();
        return () => window.removeEventListener('resize', setAppHeight);
    }, []);

    // Persistence for Talk Tab
    useEffect(() => {
        localStorage.setItem('talk_input_text', inputText);
    }, [inputText]);

    useEffect(() => {
        localStorage.setItem('talk_editable_output', editableOutput);
    }, [editableOutput]);

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

                // If we have a role/code but didn't land on hub/parent_hub, and we are authenticated, auto-route
                if (localStorage.getItem('family_code') && localStorage.getItem('user_role') && view === 'home') {
                    if (sessionStorage.getItem('is_authenticated') === 'true') {
                        setView(localStorage.getItem('current_view') || 'parent_hub');
                    }
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // Messaging Permission and Token Handling
    useEffect(() => {
        if (!messaging || !user || !coupleCode || !role) return;

        const requestPermission = async () => {
            try {
                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);
                if (permission === 'granted') {
                    const currentToken = await getToken(messaging, {
                        vapidKey: 'BAnTJrbcZ8fz0bvM08VSvGy5RHBnTs97n6Rh8SZtrXxAPqEY4npG42RimQ8ROnRaPlXikWcbdX_LdcaUJcGDGnM'
                    });
                    if (currentToken) {
                        console.log('FCM Token retrieved:', currentToken);
                        // Store token in Firestore
                        await setDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'fcm_tokens', role), {
                            token: currentToken,
                            updatedAt: serverTimestamp(),
                            userId: user.uid
                        });
                    } else {
                        console.log('No registration token available. Request permission to generate one.');
                    }
                }
            } catch (err) {
                console.error('An error occurred while retrieving token. ', err);
            }
        };

        requestPermission();

        const unsubMessage = onMessage(messaging, (payload) => {
            console.log('Message received. ', payload);
            sendNotification(payload.notification.title, payload.notification.body, 'general');
        });

        return () => unsubMessage();
    }, [user, coupleCode, role]);

    // Basic Family Data Listeners (Don't need role)
    useEffect(() => {
        if (!user || !db || !coupleCode) return;

        // Listen for shared settings (love languages, names) - both partners can edit
        const settingsRef = doc(db, 'couples', coupleCode.toLowerCase(), 'config', 'settings');
        const unsubSettings = onSnapshot(settingsRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.hisLoveLanguage) setHisLoveLanguage(data.hisLoveLanguage);
                if (data.herLoveLanguage) setHerLoveLanguage(data.herLoveLanguage);
                if (data.husbandName) setHusbandName(data.husbandName);
                if (data.wifeName) setWifeName(data.wifeName);
                if (data.husbandPhoto) setHusbandPhoto(data.husbandPhoto);
                if (data.wifePhoto) setWifePhoto(data.wifePhoto);

                // Auto-complete onboarding on new devices if names already exist
                if (data.husbandName && data.wifeName && !localStorage.getItem('onboarding_complete')) {
                    localStorage.setItem('onboarding_complete', 'true');
                    setShowOnboarding(false);
                }
            }
        }, (err) => console.error("Settings Sync Error:", err));

        // Listen for kid profiles (Family Bridge)
        const kidsRef = collection(db, 'families', coupleCode.toLowerCase(), 'kids');
        const unsubKids = onSnapshot(kidsRef, (snap) => {
            const kids = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setKidProfiles(kids.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        }, (err) => console.error("Kids Sync Error:", err));

        return () => { unsubSettings(); unsubKids(); };
    }, [user, coupleCode]);

    // Role-Specific Data Listeners
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

        // Initial content load
        refreshVaults();

        return () => { unsubBridge(); unsubJournal(); };
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

        const intentionContext = {
            compliment: "Heartfelt and specific appraisal/compliment.",
            concern: "Convert this frustration/concern into a soft 'I-Statement' focusing on feelings and needs.",
            question: "Curious, open-ended question that encourages connection and doesn't feel like an interrogation.",
            update: "Warm, engaging update or information share."
        };

        const systemPrompt = `You are a relationship counselor helping a couple communicate better.
Goal: ${talkIntention.toUpperCase()}
Context: ${intentionContext[talkIntention]}
Input: "${inputText}"

Convert the input into a high-quality, emotionally intelligent message that fosters connection and understanding.
Return JSON: { "translation": "..." }`;
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
            toast.info(`No messages found for "${timeFilterLabels[analysisTimeFilter]}". Try a different time period.`);
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
        if (result) {
            setPulse(result);
        } else {
            toast.error("Failed to generate relationship analysis. Please try again in a moment.");
        }
        setIsGenerating(false);
    };

    // Helper: Generate Google Calendar Event URL
    const generateCalendarUrl = (title, description, details = '') => {
        const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
        const params = new URLSearchParams({
            text: title,
            details: `${description}\n\n${details}`,
        });
        return `${baseUrl}&${params.toString()}`;
    };

    const saveToBridge = async (customContent = null) => {
        if (!user || !coupleCode) {
            toast.error('Please set a couple code on the home screen first');
            return;
        }
        if (!role) {
            toast.error('Please select your hub (Husband or Wife) first');
            return;
        }
        const content = typeof (customContent || editableOutput) === 'string'
            ? (customContent || editableOutput)
            : String(customContent || editableOutput);
        if (!content) return;
        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            await addDoc(collection(db, sharedNamespace, 'bridge_items'), {
                content, author: role, fromRole: role, timestamp: serverTimestamp(), type: customContent ? 'reset' : 'shared'
            });
            setEditableOutput(''); setInputText('');
            toast.success('Shared to bridge! ✓');
        } catch (err) {
            console.error('Save error:', err);
            toast.error('Failed to save. Please try again.');
        }
    };

    // Reply to a bridge message (threaded conversation)
    const replyToBridge = async (parentId) => {
        if (!user || !coupleCode || !role) return;
        if (!replyText.trim()) return;
        try {
            const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
            await addDoc(collection(db, sharedNamespace, 'bridge_items'), {
                content: replyText.trim(),
                author: role,
                fromRole: role,
                timestamp: serverTimestamp(),
                type: 'reply',
                parentId: parentId
            });
            setReplyText('');
            setReplyingTo(null);
            // Auto-expand the thread after replying
            setExpandedThreads(prev => new Set([...prev, parentId]));
        } catch (err) {
            console.error('Reply error:', err);
            toast.error('Failed to send reply. Please try again.');
        }
    };

    // Toggle thread expansion
    const toggleThread = (messageId) => {
        setExpandedThreads(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
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
            toast.success(`${name} has been added!`);
        } catch (err) {
            console.error('Add kid error:', err);
            toast.error('Failed to add kid profile.');
        }
    };

    const updateKidProfile = async (kidId, updates) => {
        if (!coupleCode || !db || !kidId) return;
        try {
            const kidRef = doc(db, 'families', coupleCode.toLowerCase(), 'kids', kidId);
            await setDoc(kidRef, updates, { merge: true });
        } catch (err) {
            console.error('Update kid error:', err);
            toast.error('Failed to update kid profile.');
        }
    };

    const deleteKidProfile = async (kidId, kidName) => {
        if (!coupleCode || !db || !kidId) return;
        if (!window.confirm(`Remove ${kidName}'s profile? This will delete their journal and messages.`)) return;
        try {
            const kidRef = doc(db, 'families', coupleCode.toLowerCase(), 'kids', kidId);
            await deleteDoc(kidRef);
            toast.success(`${kidName}'s profile has been removed.`);
        } catch (err) {
            console.error('Delete kid error:', err);
            toast.error('Failed to delete kid profile.');
        }
    };

    const handleSaveToJournal = async (manualText = null, meta = {}) => {
        const content = manualText || editableOutput || inputText;
        if (!content) {
            toast.warning('Please enter some text first');
            return;
        }
        try {
            await saveToJournal({ db, user, coupleCode, role, content, meta });
            setEditableOutput(''); setInputText(''); setJournalPrompt(null);
            toast.success('Saved to journal! ✓');
        } catch (err) {
            console.error('Journal save error:', err);
            toast.error(err.message || 'Failed to save. Please try again.');
        }
    };

    const handleDeleteFromJournal = async (itemId) => {
        if (!window.confirm('Are you sure you want to delete this journal entry?')) return;
        try {
            await deleteFromJournal({ db, coupleCode, role, itemId });
        } catch (err) {
            console.error('Journal delete error:', err);
            toast.error('Failed to delete. Please try again.');
        }
    };

    const generateJournalInsights = async () => {
        if (journalItems.length === 0) {
            toast.info('Add some journal entries first to get insights');
            return;
        }
        setIsGenerating(true);
        const recentEntries = journalItems.slice(0, 5).map(j => `[${j.type || 'entry'}]: ${j.content}`).join('\n');
        const partnerName = role === 'his' ? (wifeName || 'your wife') : (husbandName || 'your husband');
        const systemPrompt = `You are a relationship counselor. Based on these recent journal entries:\n${recentEntries}\n\nProvide personalized communication suggestions for talking with ${partnerName}. Return JSON: { "insights": "brief analysis of patterns", "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"] }`;
        const result = await callGemini(systemPrompt);
        if (result) {
            toast.success(`💡 Insights: ${result.insights}`);
        } else {
            toast.error('Could not generate insights. Please try again.');
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
            toast.error('Failed to delete. Please try again.');
        }
    };

    // NEW: Update Journal Entry
    const handleUpdateJournalEntry = async (itemId, newContent) => {
        if (!newContent.trim()) return;
        try {
            await updateJournalEntry({ db, coupleCode, role, itemId, newContent: newContent.trim() });
            setEditingJournalId(null);
            setEditingJournalContent('');
        } catch (err) {
            console.error('Journal update error:', err);
            toast.error('Failed to update. Please try again.');
        }
    };

    // NEW: Weekly Summary
    const generateWeeklySummary = async () => {
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const weekEntries = journalItems.filter(j =>
            j.timestamp?.seconds && (j.timestamp.seconds * 1000) > oneWeekAgo
        );
        if (weekEntries.length === 0) {
            toast.info('No journal entries from this week to analyze');
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
    const handleExportJournalData = () => {
        if (journalItems.length === 0) {
            toast.info('No journal entries to export');
            return;
        }
        exportJournalData(journalItems);
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
            toast.error('Could not generate date ideas. Please try again.');
        }
        setIsGenerating(false);
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
            toast.warning('Notifications are not supported on this browser.');
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
                toast.warning('Notifications were denied. Please enable them in your browser settings.');
            }
        } catch (err) {
            console.error('Notification permission error:', err);
            toast.error('Error requesting permission: ' + err.message);
        }
    };

    const sendNotification = async (title, body, type = 'general') => {
        if (typeof Notification === 'undefined') {
            if (type === 'general') toast.warning('Notifications not supported: ' + title);
            return;
        }

        if (notificationPermission !== 'granted') {
            if (type === 'general') toast.info('Please enable notifications first to see this test!');
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
                toast.error('Notification failed. Try adding to Home Screen if on mobile.');
            }
        }
    };

    const updateNotifyPref = (key, value) => {
        const updated = { ...notifyPrefs, [key]: value };
        setNotifyPrefs(updated);
        localStorage.setItem('notify_prefs', JSON.stringify(updated));
    };

    const logout = () => {
        if (!window.confirm('Are you sure you want to sign out? This will clear your saved session on this device.')) return;
        setRole(null);
        setCurrentKid(null);
        setPortalMode('couple');
        setIsAuthenticated(false);
        setView('home');
        localStorage.removeItem('user_role');
        localStorage.removeItem('current_kid');
        localStorage.removeItem('portal_mode');
        localStorage.removeItem('current_view');
        sessionStorage.removeItem('is_authenticated');
    };

    // Filter bridge items based on user's clear timestamp
    const visibleBridgeItems = bridgeItems.filter(item => {
        if (!bridgeClearedAt) return !item.parentId; // Only top-level messages (no parentId)
        const itemTimestamp = item.timestamp?.seconds ? item.timestamp.seconds * 1000 : 0;
        return itemTimestamp > bridgeClearedAt && !item.parentId;
    });

    // Get replies for a specific message
    const getReplies = (parentId) => {
        return bridgeItems
            .filter(item => item.parentId === parentId)
            .sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0)); // Oldest first for replies
    };

    const copyToClipboard = (text, id) => {
        const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    };

    // --- RENDERS ---

    if (!app) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100 font-sans">
            <div className="text-6xl animate-pulse">💕</div>
            <p className="mt-4 text-slate-500 font-medium animate-pulse">Connecting...</p>
        </div>
    );

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

    // Show onboarding: either for new users without names, or when manually triggered from settings
    if (showOnboarding && coupleCode && user) {
        return (
            <OnboardingFlow
                coupleCode={coupleCode}
                onComplete={() => {
                    setShowOnboarding(false);
                    setView('home');  // Return to home screen to select hub
                    setRole(null);    // Clear any auto-selected role
                    localStorage.removeItem('user_role');
                    toast.success('Setup complete! Choose your hub below 💕');
                }}
                saveSettings={saveSettings}
                requestNotificationPermission={requestNotificationPermission}
                darkMode={darkMode}
                initialHusbandName={husbandName}
                initialWifeName={wifeName}
                initialHisLoveLanguage={hisLoveLanguage}
                initialHerLoveLanguage={herLoveLanguage}
            />
        );
    }

    const renderHome = () => (
        <div className="flex flex-col items-center px-4 space-y-4 py-4">
            {/* Compact Header */}
            <div className="text-center space-y-1">
                <div className="bg-gradient-to-br from-rose-100 to-purple-100 p-4 rounded-full inline-block border-2 border-white shadow-lg">
                    <Heart className="w-8 h-8 text-rose-600 fill-rose-600" />
                </div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tighter italic">
                    Unity Bridge
                </h1>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    Family Connection OS
                </p>
            </div>

            {/* Unified Family Code Entry */}
            <div className={`w-full p-4 rounded-2xl shadow-lg border space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <div className="space-y-1.5">
                    <label className={`text-[9px] font-black uppercase ml-1 flex items-center gap-1 ${darkMode ? 'text-purple-400' : 'text-purple-500'}`}>
                        <Lock className="w-3 h-3" /> Family Code
                    </label>
                    <input
                        value={coupleCodeInput}
                        onChange={(e) => setCoupleCodeInput(e.target.value)}
                        onBlur={() => {
                            if (coupleCodeInput.trim() && coupleCodeInput !== coupleCode) {
                                setCoupleCode(coupleCodeInput.trim());
                                localStorage.setItem('family_code', coupleCodeInput.trim());
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && coupleCodeInput.trim()) {
                                setCoupleCode(coupleCodeInput.trim());
                                localStorage.setItem('family_code', coupleCodeInput.trim());
                                e.target.blur();
                            }
                        }}
                        placeholder="e.g. smith"
                        className={`w-full p-3 rounded-xl text-sm border outline-none text-center font-mono tracking-wider ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-purple-50 border-purple-100 focus:border-purple-300'}`}
                    />
                    <p className={`text-[8px] text-center ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Tap outside or press Enter to connect</p>
                </div>
            </div>

            {/* Who's Using the App? */}
            <div className={`w-full p-4 rounded-2xl shadow-lg border space-y-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                <p className={`text-xs font-black text-center ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>Who's using the app?</p>

                {/* Parent Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => {
                            if (coupleCode) {
                                if (role === 'his' && isAuthenticated) {
                                    setView('parent_hub');
                                } else {
                                    setPendingParentRole('his');
                                    setParentPinInput('');
                                    setShowParentPinModal(true);
                                }
                            }
                        }}
                        disabled={!coupleCode}
                        className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50'} ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-blue-50 border-blue-100'}`}
                    >
                        {husbandPhoto ? (
                            <img src={husbandPhoto} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-blue-200" />
                        ) : (
                            <span className="text-2xl">👨</span>
                        )}
                        <span className="text-[10px] font-bold text-blue-600">{husbandName || "Dad"}</span>
                    </button>
                    <button
                        onClick={() => {
                            if (coupleCode) {
                                if (role === 'hers' && isAuthenticated) {
                                    setView('parent_hub');
                                } else {
                                    setPendingParentRole('hers');
                                    setParentPinInput('');
                                    setShowParentPinModal(true);
                                }
                            }
                        }}
                        disabled={!coupleCode}
                        className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50'} ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-rose-50 border-rose-100'}`}
                    >
                        {wifePhoto ? (
                            <img src={wifePhoto} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-rose-200" />
                        ) : (
                            <span className="text-2xl">👩</span>
                        )}
                        <span className="text-[10px] font-bold text-rose-600">{wifeName || "Mom"}</span>
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
                                onClick={() => {
                                    if (currentKid?.id === kid.id && isAuthenticated) {
                                        setView('kid_hub');
                                    } else {
                                        setCurrentKid(kid);
                                        setKidPinInput('');
                                        // Fix "stuck" session: if portalMode is already 'kid', 
                                        // we must reset it to trigger the PIN modal for the newly selected profile
                                        if (portalMode === 'kid') {
                                            setPortalMode('couple');
                                        }
                                    }
                                }}
                                disabled={!coupleCode}
                                className={`p-3 border rounded-xl flex flex-col items-center gap-1 transition-all ${coupleCode ? 'active:scale-95' : 'opacity-50'} ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-purple-50 border-purple-100'}`}
                            >
                                {kid.photoUrl ? (
                                    <img src={kid.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-purple-200" />
                                ) : (
                                    <span className="text-2xl">{kid.avatar || '🧒'}</span>
                                )}
                                <span className="text-[10px] font-bold text-purple-600">{kid.name}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-[10px] text-slate-400 mb-2">No kid profiles yet</p>
                        <p className="text-[9px] text-slate-400">Login as Mom or Dad to add kids</p>
                    </div>
                )}
            </div>

            {/* Parent PIN Modal */}
            {showParentPinModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-xs p-6 rounded-3xl shadow-2xl space-y-4 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
                        <div className="text-center">
                            <span className="text-5xl">{pendingParentRole === 'his' ? '👨' : '👩'}</span>
                            <h3 className={`text-lg font-black mt-2 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {pendingParentRole === 'his' ? (husbandName || 'Husband') : (wifeName || 'Wife')}
                            </h3>
                            <p className="text-xs text-slate-400">Enter your 4-digit PIN</p>
                            <p className="text-[10px] text-slate-400 mt-1">(Default: 0000)</p>
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
                                        localStorage.setItem('family_code', coupleCode);
                                        sessionStorage.setItem('is_authenticated', 'true');
                                        setIsAuthenticated(true);
                                        setShowParentPinModal(false);
                                        setParentPinInput('');
                                        setPendingParentRole(null);
                                        // UNIFIED ROUTING: Always go to parent_hub (Dashboard)
                                        // Parents can navigate to HUB (Couples) from there
                                        setView('parent_hub');
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

            {/* Kid PIN Modal */}
            {currentKid && portalMode !== 'kid' && !role && (
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
                                if (val.length === 4) {
                                    if (val === currentKid.pin) {
                                        setPortalMode('kid'); // Still useful state tracking
                                        localStorage.setItem('current_kid', JSON.stringify(currentKid));
                                        localStorage.setItem('portal_mode', 'kid');
                                        sessionStorage.setItem('is_authenticated', 'true');
                                        setIsAuthenticated(true);
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
                                onClick={() => {
                                    setCurrentKid(null);
                                    setKidPinInput('');
                                    localStorage.removeItem('current_kid_id');
                                    localStorage.removeItem('portal_mode');
                                }}
                                className="flex-1 py-3 bg-slate-200 text-slate-600 font-bold text-sm rounded-xl"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!coupleCode && <p className="text-[9px] text-purple-500 font-bold">↑ Enter Family Code to start</p>}

            {isAuthenticated && (
                <button
                    onClick={logout}
                    className={`mt-8 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${darkMode ? 'border-slate-700 text-slate-500 hover:text-rose-400' : 'border-slate-200 text-slate-400 hover:text-rose-500'}`}
                >
                    Sign Out / Reset Session
                </button>
            )}
        </div>
    );

    return (
        <div className={`fixed inset-0 w-full flex flex-col font-sans overflow-hidden select-none ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-[#FDF8F8] text-slate-900'}`} style={{ height: 'var(--app-height, 100vh)' }}>
            <header className={`shrink-0 h-16 w-full flex items-center justify-between px-6 z-50 shadow-sm ${darkMode ? 'bg-slate-800 border-b border-slate-700' : 'bg-white border-b border-rose-50'}`}>
                <div className="w-10" />
                <h1 className="text-xl font-black text-rose-600 flex items-center gap-2 tracking-tighter italic select-none"><Heart className="fill-rose-600 w-5 h-5" /> UNITY</h1>
                <div className="w-10" />
            </header>

            <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth touch-pan-y relative px-4">
                <div className="max-w-md mx-auto w-full h-full pb-24 pt-4">
                    {view === 'home' && renderHome()}

                    {view === 'cart_mate' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4">
                            <button
                                onClick={() => setView('parent_hub')}
                                className={`flex items-center gap-2 text-sm font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                            >
                                <ChevronRight className="w-4 h-4 rotate-180" />
                                Back to Dashboard
                            </button>
                            <ShoppingList
                                db={db}
                                coupleCode={coupleCode}
                                darkMode={darkMode}
                                userRole={role}
                                userName={role === 'his' ? husbandName : (role === 'hers' ? wifeName : (currentKid?.name || 'Family'))}
                            />
                        </div>
                    )}

                    {view === 'hub' && (
                        <div className="space-y-6">
                            <div className={`flex gap-1 p-1.5 rounded-2xl border shadow-sm sticky top-0 z-10 ${darkMode ? 'bg-slate-800/90 border-slate-700 backdrop-blur-md' : 'bg-white/80 border-slate-100 backdrop-blur-md'}`}>
                                {[
                                    { id: 'affection', label: '💕 Love', short: '💕' },
                                    { id: 'communicate', label: '💬 Talk', short: '💬' },
                                    { id: 'date', label: '📅 Date', short: '📅' },
                                    { id: 'calendar', label: '🗓️ Cal', short: '🗓️' },
                                    { id: 'journal', label: '📔 Journal', short: '📔' }
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-2.5 px-1 text-[9px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === tab.id ? 'bg-rose-600 text-white shadow-lg' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {tab.label}
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
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-blue-500 uppercase ml-2 tracking-widest">Select Your Goal</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'compliment', label: 'Compliment', emoji: '🌸' },
                                                { id: 'concern', label: 'Concern', emoji: '🗣️' },
                                                { id: 'question', label: 'Question', emoji: '❓' },
                                                { id: 'update', label: 'Update', emoji: '📢' }
                                            ].map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setTalkIntention(item.id)}
                                                    className={`p-3 rounded-2xl border text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${talkIntention === item.id ? (darkMode ? 'bg-blue-900 border-blue-500 text-blue-200 shadow-lg scale-105' : 'bg-blue-50 border-blue-200 text-blue-700 shadow-md scale-105') : (darkMode ? 'bg-slate-700 border-slate-600 text-slate-400 opacity-60' : 'bg-white border-slate-100 text-slate-500 opacity-60')}`}
                                                >
                                                    <span>{item.emoji}</span> {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={`Draft your ${talkIntention}...`} className={`w-full p-5 border rounded-3xl text-sm min-h-[140px] outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500/30' : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-50'}`} />
                                    <button onClick={translateMessage} disabled={isGenerating || !inputText} className="w-full bg-slate-900 text-white font-black py-4 rounded-3xl shadow-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "TRANSLATE"}
                                    </button>
                                    {editableOutput && (
                                        <div className="space-y-4 pt-4 animate-in fade-in">
                                            <div className={`p-1 border-2 rounded-[2rem] overflow-hidden ${darkMode ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-100'}`}>
                                                <textarea value={editableOutput} onChange={(e) => setEditableOutput(e.target.value)} className={`w-full p-6 bg-transparent text-sm italic font-medium outline-none min-h-[120px] ${darkMode ? 'text-slate-200' : 'text-slate-700'}`} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button onClick={() => handleSaveToJournal()} className={`font-bold py-4 rounded-2xl text-[10px] flex items-center justify-center gap-2 border ${darkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>PRIVATE</button>
                                                <button onClick={() => saveToBridge()} className="bg-green-600 text-white font-bold py-4 rounded-2xl text-[10px] flex items-center justify-center gap-2">SHARE</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'date' && (
                                <div className={`rounded-[2.5rem] shadow-xl border p-6 space-y-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-rose-50'}`}>
                                    <div className="text-center space-y-2">
                                        <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto border-2 border-white shadow-lg">
                                            <Heart className="w-8 h-8 text-pink-600" />
                                        </div>
                                        <h2 className={`text-2xl font-black tracking-tighter italic ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Date Night</h2>
                                        <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>AI-generated date ideas just for you two</p>
                                    </div>

                                    <div className={`rounded-3xl border p-4 space-y-3 ${darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-pink-100 shadow-sm'}`}>
                                        <h3 className="text-[10px] font-black text-pink-600 uppercase tracking-widest text-center">Select Your Budget</h3>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {[{ id: 'free', label: 'Free', emoji: '🆓' }, { id: 'cheap', label: '<$30', emoji: '💵' }, { id: 'moderate', label: '$30-75', emoji: '💳' }, { id: 'splurge', label: '$75+', emoji: '✨' }].map(budget => (
                                                <button
                                                    key={budget.id}
                                                    onClick={() => generateDateNight(budget.id)}
                                                    disabled={isGenerating}
                                                    className={`p-2 rounded-xl text-center transition-all disabled:opacity-50 ${darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-600' : 'bg-slate-50 hover:bg-pink-50 border-slate-200 hover:border-pink-200'}`}
                                                >
                                                    <span className="text-xl block">{budget.emoji}</span>
                                                    <span className={`text-[8px] font-bold leading-tight block ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{budget.label}</span>
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
                                            <h3 className={`text-lg font-black px-2 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Your Date Ideas</h3>
                                            {dateIdeas.map((date, i) => (
                                                <div key={i} className={`rounded-[2rem] shadow-sm border p-6 space-y-4 ${darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-pink-100'}`}>
                                                    <div className="flex items-start justify-between">
                                                        <h4 className={`text-lg font-black ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>{date.title}</h4>
                                                        <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-3 py-1 rounded-full">{date.cost}</span>
                                                    </div>
                                                    <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{date.description}</p>
                                                    <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-pink-900/20 border-pink-800' : 'bg-gradient-to-r from-pink-50 to-rose-50 border-pink-100'}`}>
                                                        <p className="text-[10px] font-black text-pink-600 uppercase mb-1">💡 Love Language Tip</p>
                                                        <p className={`text-xs italic ${darkMode ? 'text-pink-100' : 'text-slate-700'}`}>{date.tip}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => copyToClipboard(`${date.title}: ${date.description}`, `d-${i}`)}
                                                            className={`flex-1 py-3 text-[9px] font-bold rounded-xl flex items-center justify-center gap-1 ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}
                                                        >
                                                            {copiedId === `d-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                                            {copiedId === `d-${i}` ? 'Copied!' : 'Copy'}
                                                        </button>
                                                        <button
                                                            onClick={() => saveToBridge(`Date idea: ${date.title} - ${date.description}`)}
                                                            className="flex-1 py-3 text-[9px] font-bold text-white bg-pink-600 rounded-xl flex items-center justify-center gap-1 shadow-lg"
                                                        >
                                                            <Share2 className="w-3 h-3" />
                                                            Share
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                                                        <a
                                                            href={generateCalendarUrl(`Date Night: ${date.title}`, date.description, `💡 Tip: ${date.tip}\nBudget: ${date.cost}`)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 py-3 text-[9px] font-bold text-white bg-blue-600 rounded-xl flex items-center justify-center gap-1 shadow-lg active:scale-95 transition-all"
                                                        >
                                                            <Calendar className="w-3 h-3" />
                                                            Add to Calendar
                                                        </a>
                                                        <button
                                                            onClick={() => copyToClipboard(`Date Night: ${date.title}\n${date.description}\n\n💡 ${date.tip}\n\nBudget: ${date.cost}`, `cal-${i}`)}
                                                            className={`flex-1 py-3 text-[9px] font-bold rounded-xl flex items-center justify-center gap-1 ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                                                        >
                                                            {copiedId === `cal-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Calendar className="w-3 h-3" />}
                                                            {copiedId === `cal-${i}` ? 'Copied!' : 'iPhone Copy'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Shared Calendar */}
                                    <CalendarView
                                        calendarId="NDU5ZWZkNDZlYzVjNzYwNGU2YTg0N2I2OGQxNmEzMzFiOWNhYzhmNzU1MjY1N2E4YjFiMjBmNDQ0OTZmODM2Y0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t"
                                        title="Couples Calendar"
                                        darkMode={darkMode}
                                        mode="AGENDA"
                                    />
                                </div>
                            )}

                            {activeTab === 'calendar' && (
                                <div className={`rounded-[2.5rem] shadow-xl border p-6 space-y-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-rose-50'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-rose-500" />
                                            <h2 className={`font-black text-sm uppercase ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Shared Calendars</h2>
                                        </div>
                                        <button
                                            onClick={() => window.open(generateCalendarUrl('Quick Event', 'Added from Unity Bridge'), '_blank')}
                                            className="p-2 bg-rose-600 text-white rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 px-3"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase">Quick Add</span>
                                        </button>
                                    </div>

                                    <div className="space-y-8">
                                        <CalendarView
                                            calendarId="NDU5ZWZkNDZlYzVjNzYwNGU2YTg0N2I2OGQxNmEzMzFiOWNhYzhmNzU1MjY1N2E4YjFiMjBmNDQ0OTZmODM2Y0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t"
                                            title="Couples (Month View)"
                                            darkMode={darkMode}
                                            mode="MONTH"
                                        />

                                        <CalendarView
                                            calendarId="ZmFtaWx5MDY4MDk0MTIyMTIxNzk0OTA5NTJAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ"
                                            title="Family (Week View)"
                                            darkMode={darkMode}
                                            mode="WEEK"
                                        />
                                    </div>
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
                                            <button onClick={() => { const val = document.getElementById('studio-input').value; handleSaveToJournal(val, { type: journalPrompt }); }} className={`w-full ${JOURNAL_TYPES[journalPrompt].color.replace('text-', 'bg-').replace('-600', '-600')} text-white py-3 rounded-xl text-[10px] font-black shadow-lg`} style={{ backgroundColor: journalPrompt === 'feeling' ? '#9333ea' : journalPrompt === 'ai_log' ? '#2563eb' : journalPrompt === 'win' ? '#16a34a' : '#d97706' }}>SAVE {JOURNAL_TYPES[journalPrompt].label.toUpperCase()}</button>
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
                                                    onClick={handleExportJournalData}
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
                                                                        onClick={() => handleUpdateJournalEntry(item.id, editingJournalContent)}
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
                                                                        onClick={() => handleDeleteFromJournal(item.id)}
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
                                    visibleBridgeItems.map(item => {
                                        const replies = getReplies(item.id);
                                        const isExpanded = expandedThreads.has(item.id);
                                        const isReplying = replyingTo?.id === item.id;

                                        return (
                                            <div key={item.id} className="space-y-2">
                                                {/* Main Message */}
                                                <div className={`p-4 rounded-2xl border relative ${item.author === role ? (darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200') : (darkMode ? 'bg-rose-900/20 border-rose-800' : 'bg-rose-50/50 border-rose-200')}`}>
                                                    <div className="flex items-start justify-between mb-1">
                                                        <div className="flex flex-col">
                                                            <span className={`text-[9px] font-black uppercase ${item.author === 'his' ? 'text-blue-500' : 'text-rose-500'}`}>{item.author === 'his' ? husbandName : wifeName}</span>
                                                            <span className="text-[7px] text-slate-400 font-bold">{item.timestamp?.toDate ? new Date(item.timestamp.toDate()).toLocaleDateString() : ''}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {/* Reply Button */}
                                                            <button
                                                                onClick={() => setReplyingTo(isReplying ? null : { id: item.id, content: item.content, author: item.author })}
                                                                className={`p-1.5 rounded-lg border transition-all ${isReplying ? (darkMode ? 'bg-green-900/40 border-green-500 text-green-400' : 'bg-green-50 border-green-300 text-green-600') : (darkMode ? 'bg-slate-600 border-slate-500 hover:bg-green-900/40 text-green-400' : 'bg-white border-slate-200 hover:bg-green-50 text-green-600')}`}
                                                                title="Reply"
                                                            >
                                                                <MessageCircle className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => window.open(generateCalendarUrl('Bridge Review / Note', item.content, `Shared by: ${item.author === 'his' ? husbandName : wifeName}`), '_blank')}
                                                                className={`p-1.5 rounded-lg border transition-all ${darkMode ? 'bg-slate-600 border-slate-500 hover:bg-blue-900/40 text-blue-400' : 'bg-white border-slate-200 hover:bg-blue-50 text-blue-600'}`}
                                                                title="Add to Calendar"
                                                            >
                                                                <Calendar className="w-3 h-3" />
                                                            </button>
                                                            {item.author === role && (
                                                                <button onClick={() => deleteFromBridge(item.id)} className={`p-1.5 rounded-lg border transition-all ${darkMode ? 'bg-slate-600 border-slate-500 hover:bg-red-900/40 text-red-400' : 'bg-white border-slate-200 hover:bg-red-50 text-red-400'}`}>
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className={`text-sm italic font-medium leading-snug ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>"{item.content}"</p>

                                                    {/* Thread Indicator */}
                                                    {replies.length > 0 && (
                                                        <button
                                                            onClick={() => toggleThread(item.id)}
                                                            className={`mt-2 text-[9px] font-bold flex items-center gap-1 ${darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Replies (when expanded) */}
                                                {isExpanded && replies.length > 0 && (
                                                    <div className="ml-4 pl-3 border-l-2 border-slate-200 space-y-2">
                                                        {replies.map(reply => (
                                                            <div key={reply.id} className={`p-3 rounded-xl border ${reply.author === role ? (darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200') : (darkMode ? 'bg-rose-900/10 border-rose-800/50' : 'bg-rose-50/30 border-rose-200')}`}>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`text-[8px] font-black uppercase ${reply.author === 'his' ? 'text-blue-500' : 'text-rose-500'}`}>{reply.author === 'his' ? husbandName : wifeName}</span>
                                                                    <span className="text-[7px] text-slate-400">{reply.timestamp?.toDate ? new Date(reply.timestamp.toDate()).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                                                </div>
                                                                <p className={`text-xs font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{reply.content}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Reply Input */}
                                                {isReplying && (
                                                    <div className="ml-4 pl-3 border-l-2 border-green-300">
                                                        <div className={`p-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                                            <p className="text-[8px] text-slate-400 mb-2">Replying to {item.author === 'his' ? husbandName : wifeName}...</p>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={replyText}
                                                                    onChange={(e) => setReplyText(e.target.value)}
                                                                    placeholder="Type your reply..."
                                                                    className={`flex-1 px-3 py-2 text-xs rounded-lg border ${darkMode ? 'bg-slate-600 border-slate-500 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400'}`}
                                                                    onKeyDown={(e) => e.key === 'Enter' && replyToBridge(item.id)}
                                                                />
                                                                <button
                                                                    onClick={() => replyToBridge(item.id)}
                                                                    disabled={!replyText.trim()}
                                                                    className="px-3 py-2 bg-green-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:bg-green-600 transition-all"
                                                                >
                                                                    Send
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
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
                        <div className="space-y-4">
                            {/* Games Toggle - Only show if user has kids */}
                            {kidProfiles.length > 0 && (
                                <div className={`flex gap-1 p-1.5 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-800/90 border-slate-700' : 'bg-white/80 border-slate-100'}`}>
                                    <button
                                        onClick={() => setGamesMode('couple')}
                                        className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${gamesMode === 'couple' ? 'bg-rose-500 text-white shadow-lg' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                                    >
                                        💑 Couple
                                    </button>
                                    <button
                                        onClick={() => setGamesMode('family')}
                                        className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-1 ${gamesMode === 'family' ? 'bg-purple-500 text-white shadow-lg' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                                    >
                                        👨‍👩‍👧‍👦 Family
                                    </button>
                                </div>
                            )}

                            {/* Render Couple Games or Family Games */}
                            {gamesMode === 'couple' ? (
                                <GameHub
                                    role={role}
                                    coupleCode={coupleCode}
                                    db={db}
                                    darkMode={darkMode}
                                    husbandName={husbandName}
                                    wifeName={wifeName}
                                    sendNotification={sendNotification}
                                    sendPushNotification={sendPushNotification}
                                />
                            ) : (
                                <FamilyGamesHub
                                    role={role}
                                    currentKid={currentKid}
                                    kidProfiles={kidProfiles}
                                    coupleCode={coupleCode}
                                    db={db}
                                    darkMode={darkMode}
                                    husbandName={husbandName}
                                    wifeName={wifeName}
                                    sendNotification={sendNotification}
                                    sendPushNotification={sendPushNotification}
                                />
                            )}
                        </div>
                    )}

                    {
                        view === 'nudge' && (
                            <div className="space-y-4 pt-2">
                                {/* Header */}
                                <div className="text-center space-y-2">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg ${darkMode ? 'bg-amber-900 border-amber-700' : 'bg-amber-100 border-white'}`}>
                                        <Bell className="w-7 h-7 text-amber-600" />
                                    </div>
                                    <h2 className={`text-2xl font-black tracking-tighter italic ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Nudge & Settings</h2>
                                    <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage reminders and your connection settings</p>
                                </div>

                                {/* Sub Tabs for Nudge */}
                                <div className={`flex gap-1 p-1.5 rounded-2xl border shadow-sm sticky top-0 z-10 ${darkMode ? 'bg-slate-800/90 border-slate-700 backdrop-blur-md' : 'bg-white/80 border-slate-100 backdrop-blur-md'}`}>
                                    {[
                                        { id: 'reminders', label: '🔔 Nudges' },
                                        { id: 'settings', label: '⚙️ Settings' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === tab.id ? 'bg-amber-600 text-white shadow-lg' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {activeTab === 'reminders' && (
                                    <div className="space-y-4 animate-in fade-in">
                                        {/* Notification Settings */}
                                        <div className={`rounded-[2.5rem] shadow-xl border p-6 space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-rose-100'}`}>
                                            <div className="flex items-center gap-2 justify-center">
                                                <Bell className="w-5 h-5 text-rose-500" />
                                                <h3 className={`text-sm font-black uppercase ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Notifications</h3>
                                            </div>

                                            {notificationPermission !== 'granted' ? (
                                                <div className="text-center space-y-3">
                                                    <p className="text-xs text-slate-500">Enable notifications to get alerts for game turns, new messages, and reminders.</p>
                                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 text-left">
                                                        <p className="text-[10px] font-bold text-blue-600 mb-1">📱 iPhone / iOS Users:</p>
                                                        <p className="text-[10px] text-slate-600">Notifications <u>only</u> work if you:</p>
                                                        <ol className="list-decimal pl-4 text-[10px] text-slate-600 mt-1 space-y-0.5">
                                                            <li>Tap the <strong>Share</strong> button</li>
                                                            <li>Select <strong>Add to Home Screen</strong></li>
                                                            <li>Open from home screen</li>
                                                        </ol>
                                                    </div>
                                                    <button onClick={() => requestNotificationPermission(db, role, coupleCode)} className="w-full py-4 bg-rose-500 text-white font-bold text-sm rounded-2xl hover:bg-rose-600 transition-all">
                                                        🔔 Enable Notifications
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="bg-green-50 p-2 rounded-xl border border-green-100 flex items-center justify-between">
                                                        <p className="text-xs text-green-600 font-bold ml-2">✅ Active</p>
                                                        <button
                                                            onClick={async () => {
                                                                await requestNotificationPermission(db, role, coupleCode);
                                                                alert('✅ Notification settings resynced! Try sending a test nudge.');
                                                            }}
                                                            className="text-[10px] bg-white border border-green-200 text-green-700 px-3 py-1.5 rounded-lg font-bold hover:bg-green-50"
                                                        >
                                                            🔄 Resync
                                                        </button>
                                                    </div>
                                                    {[
                                                        { key: 'games', emoji: '🎮', label: 'Game Alerts', desc: 'When it\'s your turn' },
                                                        { key: 'bridge', emoji: '💬', label: 'Bridge Messages', desc: 'New messages from partner' },
                                                        { key: 'dateReminders', emoji: '💕', label: 'Date Reminders', desc: 'Reminder for date nights' },
                                                        { key: 'messageReminders', emoji: '💌', label: 'Daily Love Nudge', desc: 'Reminder to send a message' }
                                                    ].map(pref => (
                                                        <div key={pref.key} className={`flex items-center justify-between p-3 rounded-xl ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xl">{pref.emoji}</span>
                                                                <div>
                                                                    <p className={`text-xs font-bold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{pref.label}</p>
                                                                    <p className="text-[10px] text-slate-400">{pref.desc}</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => updateNotifyPref(pref.key, !notifyPrefs[pref.key])} className={`w-12 h-6 rounded-full transition-all ${notifyPrefs[pref.key] ? 'bg-rose-500' : 'bg-slate-300'}`}>
                                                                <div className={`w-5 h-5 bg-white rounded-full shadow transition-all ${notifyPrefs[pref.key] ? 'ml-6' : 'ml-0.5'}`} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Daily Reminders */}
                                        <div className="space-y-3">
                                            {['Morning', 'Lunch', 'Evening'].map(time => {
                                                const nudge = NUDGE_DATA[time];
                                                const NudgeIcon = nudge.icon;
                                                const iphoneText = `${time} Unity Nudge (${nudge.time})\n${nudge.prompt}\n${nudge.suggestion}`;
                                                return (
                                                    <div key={time} className={`p-4 border rounded-2xl shadow-lg space-y-3 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                                                        <div className="flex items-start gap-3">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${darkMode ? 'bg-rose-900/30' : 'bg-rose-50'}`}>
                                                                <NudgeIcon className="w-5 h-5 text-rose-600" />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <p className={`text-lg font-black tracking-tight ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{time} Check-in</p>
                                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>{nudge.time}</span>
                                                                </div>
                                                                <p className="text-sm font-bold text-rose-600 mt-1">{nudge.prompt}</p>
                                                                <p className={`text-xs mt-1 italic ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>"{nudge.suggestion}"</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 pt-2 border-t border-slate-50">
                                                            <button onClick={() => window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Unity Bridge: ${nudge.prompt}`)}&details=${encodeURIComponent(`Reminder: ${nudge.suggestion}`)}&recur=RRULE:FREQ=DAILY`, '_blank')} className={`flex-1 p-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                                                <Calendar className="w-3 h-3" /> Go-Cal
                                                            </button>
                                                            <button onClick={() => copyToClipboard(iphoneText, `n-${time}`)} className="flex-1 p-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all">
                                                                {copiedId === `n-${time}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                                {copiedId === `n-${time}` ? 'Copied' : 'iPhone'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'settings' && (
                                    <div className={`rounded-[2.5rem] shadow-xl border p-6 space-y-6 animate-in fade-in ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
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

                                        {/* Profile Photos & Names */}
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">Profile Photos</p>
                                            <div className="flex justify-center gap-8">
                                                <div className="flex flex-col items-center gap-2">
                                                    <ProfilePhotoUpload
                                                        currentPhotoUrl={husbandPhoto}
                                                        onPhotoChange={(url) => { setHusbandPhoto(url); saveSettings({ husbandPhoto: url }); }}
                                                        profileId={coupleCode}
                                                        profileType="husband"
                                                        darkMode={darkMode}
                                                        size="lg"
                                                    />
                                                    <input
                                                        value={husbandName}
                                                        onChange={(e) => { setHusbandName(e.target.value); saveSettings({ husbandName: e.target.value }); }}
                                                        placeholder="His Name"
                                                        className={`w-24 p-2 rounded-xl text-xs text-center border outline-none font-bold ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-blue-50 border-blue-200'}`}
                                                    />
                                                </div>
                                                <div className="flex flex-col items-center gap-2">
                                                    <ProfilePhotoUpload
                                                        currentPhotoUrl={wifePhoto}
                                                        onPhotoChange={(url) => { setWifePhoto(url); saveSettings({ wifePhoto: url }); }}
                                                        profileId={coupleCode}
                                                        profileType="wife"
                                                        darkMode={darkMode}
                                                        size="lg"
                                                    />
                                                    <input
                                                        value={wifeName}
                                                        onChange={(e) => { setWifeName(e.target.value); saveSettings({ wifeName: e.target.value }); }}
                                                        placeholder="Her Name"
                                                        className={`w-24 p-2 rounded-xl text-xs text-center border outline-none font-bold ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-rose-50 border-rose-200'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Pet Names */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className={`text-[9px] font-black uppercase ml-1 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`}>His Pet Name</label>
                                                <input
                                                    value={husbandPetName}
                                                    onChange={(e) => { setHusbandPetName(e.target.value); localStorage.setItem('husband_pet_name', e.target.value); saveSettings({ husbandPetName: e.target.value }); }}
                                                    placeholder="honey"
                                                    className={`w-full p-2.5 rounded-xl text-xs border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-blue-50 border-blue-100 focus:border-blue-300'}`}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className={`text-[9px] font-black uppercase ml-1 ${darkMode ? 'text-rose-400' : 'text-rose-500'}`}>Her Pet Name</label>
                                                <input
                                                    value={wifePetName}
                                                    onChange={(e) => { setWifePetName(e.target.value); localStorage.setItem('wife_pet_name', e.target.value); saveSettings({ wifePetName: e.target.value }); }}
                                                    placeholder="sweetie"
                                                    className={`w-full p-2.5 rounded-xl text-xs border outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-rose-50 border-rose-100 focus:border-rose-300'}`}
                                                />
                                            </div>
                                        </div>

                                        {/* Love Languages */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black text-blue-400 uppercase ml-1">His Language</label>
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
                                                <label className="text-[9px] font-black text-rose-400 uppercase ml-1">Her Language</label>
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

                                        <button onClick={() => setShowKidManager(true)} className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${darkMode ? 'bg-purple-900/50 text-purple-400 border border-purple-700' : 'bg-purple-50 text-purple-600 border border-purple-200'}`}>
                                            <Users className="w-4 h-4" /> Manage Kids
                                        </button>

                                        <button onClick={() => { const newPin = prompt('New 4-digit PIN:'); if (newPin && /^\d{4}$/.test(newPin)) { localStorage.setItem(`${role}_pin`, newPin); alert('PIN updated!'); } }} className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${darkMode ? 'bg-slate-700 text-slate-300 border border-slate-600' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                            <Lock className="w-4 h-4" /> Change PIN
                                        </button>

                                        {/* Milestones */}
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black text-amber-500 uppercase ml-2 tracking-widest flex items-center gap-2"><Trophy className="w-3 h-3" /> Milestones</p>
                                            <div className="flex flex-wrap gap-2">
                                                {checkMilestones().length > 0 ? checkMilestones().map(m => (
                                                    <span key={m.id} className={`px-4 py-2 border rounded-2xl text-xs font-bold ${darkMode ? 'bg-amber-900/30 border-amber-700 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{m.emoji} {m.label}</span>
                                                )) : <p className="text-xs italic text-slate-400">Keep sharing to earn badges!</p>}
                                            </div>
                                        </div>

                                        <button onClick={handleExportJournalData} disabled={journalItems.length === 0} className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${darkMode ? 'bg-green-900/50 text-green-400 border border-green-700' : 'bg-green-50 text-green-600 border border-green-200'} disabled:opacity-50`}>
                                            <Save className="w-4 h-4" /> Export Data
                                        </button>

                                        <button
                                            onClick={() => {
                                                localStorage.removeItem('onboarding_complete');
                                                setShowOnboarding(true);
                                            }}
                                            className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${darkMode ? 'bg-indigo-900/50 text-indigo-400 border border-indigo-700' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'}`}
                                        >
                                            <Sparkles className="w-4 h-4" /> Run Setup Wizard
                                        </button>
                                    </div>
                                )}

                            </div>
                        )
                    }

                    {/* KID HUB VIEW */}
                    {
                        view === 'kid_hub' && (
                            <KidPortal
                                currentKid={currentKid}
                                role={role}
                                coupleCode={coupleCode}
                                db={db}
                                darkMode={darkMode}
                                setView={setView}
                                setCurrentKid={setCurrentKid}
                                setPortalMode={setPortalMode}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                inputText={inputText}
                                setInputText={setInputText}
                                setDarkMode={setDarkMode}
                                husbandName={husbandName}
                                wifeName={wifeName}
                            />
                        )
                    }

                    {/* PARENT HUB VIEW (Family Mode) */}
                    {
                        view === 'parent_hub' && (
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
                                                <button
                                                    key={kid.id}
                                                    onClick={() => { setCurrentKid(kid); setView('kid_hub'); setActiveTab('journal'); }}
                                                    className={`w-full p-4 rounded-2xl border text-left transition-all active:scale-98 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-purple-50 border-purple-100 hover:bg-purple-100'}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-4xl">{kid.avatar || '🧒'}</span>
                                                        <div className="flex-1">
                                                            <h4 className={`font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{kid.name}</h4>
                                                            <p className="text-[10px] text-purple-500 font-bold">Tap to view journal & messages</p>
                                                        </div>
                                                        <ChevronRight className={`w-5 h-5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                                    </div>
                                                </button>
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
                                        onClick={() => setShowFamilyCalendar(!showFamilyCalendar)}
                                        className={`p-4 rounded-2xl border flex flex-col items-center gap-2 ${darkMode ? 'bg-amber-900/30 border-amber-700' : 'bg-amber-50 border-amber-200'}`}
                                    >
                                        <span className="text-2xl">📅</span>
                                        <span className={`text-xs font-bold ${darkMode ? 'text-amber-300' : 'text-amber-600'}`}>{showFamilyCalendar ? 'Hide Cal' : 'Family Cal'}</span>
                                    </button>
                                </div>

                                {/* Family Calendar View */}
                                {showFamilyCalendar && (
                                    <div className="animate-in fade-in slide-in-from-top-4">
                                        <CalendarView
                                            calendarId="ZmFtaWx5MDY4MDk0MTIyMTIxNzk0OTA5NTJAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ"
                                            title="Family Calendar"
                                            darkMode={darkMode}
                                        />
                                    </div>
                                )}

                                {/* Cart Mate Button */}
                                <button
                                    onClick={() => setView('cart_mate')}
                                    className={`w-full p-4 rounded-2xl border flex items-center gap-4 transition-all active:scale-98 ${darkMode ? 'bg-green-900/30 border-green-700' : 'bg-gradient-to-r from-green-500 to-emerald-600 border-green-400'}`}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${darkMode ? 'bg-green-800' : 'bg-white/20'}`}>
                                        <ShoppingCart className={`w-6 h-6 ${darkMode ? 'text-green-400' : 'text-white'}`} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <h4 className={`font-black ${darkMode ? 'text-green-300' : 'text-white'}`}>Cart Mate</h4>
                                        <p className={`text-[10px] ${darkMode ? 'text-green-400' : 'text-white/80'}`}>📸 Scan lists · 🛒 Shop at Walmart</p>
                                    </div>
                                    <ChevronRight className={`w-5 h-5 ${darkMode ? 'text-green-500' : 'text-white/60'}`} />
                                </button>

                                {/* Logout */}
                                <button
                                    onClick={() => {
                                        setRole(null);
                                        setCurrentKid(null);
                                        localStorage.removeItem('user_role');
                                        localStorage.removeItem('current_kid_id');
                                        localStorage.setItem('unity_bridge_view', 'home');
                                        setView('home');
                                    }}
                                    className={`w-full py-4 rounded-2xl text-sm font-bold ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    👋 Switch User
                                </button>
                            </div>
                        )
                    }

                    {
                        (view === 'family_games' || view === 'family_game_play') && (
                            <FamilyGamesHub
                                role={role}
                                coupleCode={coupleCode}
                                db={db}
                                darkMode={darkMode}
                                husbandName={husbandName}
                                wifeName={wifeName}
                                kidProfiles={kidProfiles}
                                currentKid={currentKid}
                                sendNotification={sendNotification}
                                sendPushNotification={sendPushNotification}
                                onBack={() => setView(currentKid ? 'kid_hub' : 'parent_hub')}
                            />
                        )
                    }


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

                    {/* Kid Manager Modal (Parents only) */}
                    {
                        showKidManager && (
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
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setShowKidManager(false);
                                                                setCurrentKid(kid);
                                                                setView('family_games');
                                                                alert(`Ready to play games with ${kid.name}! Start a new game from the lobby.`);
                                                            }}
                                                            className="text-purple-500 hover:text-purple-700 p-2 bg-purple-50 rounded-lg flex items-center gap-1"
                                                        >
                                                            <Gamepad2 className="w-4 h-4" />
                                                            <span className="text-[10px] font-bold">Play</span>
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                const newPin = prompt(`Enter new 4-digit PIN for ${kid.name}:`);
                                                                if (newPin && /^\d{4}$/.test(newPin)) {
                                                                    try {
                                                                        await updateDoc(doc(db, 'families', coupleCode.toLowerCase(), 'kids', kid.id), { pin: newPin });
                                                                        alert('PIN updated successfully! 🔒');
                                                                    } catch (err) {
                                                                        console.error(err);
                                                                        alert('Failed to update PIN.');
                                                                    }
                                                                } else if (newPin !== null) {
                                                                    alert('Invalid PIN. Must be 4 digits.');
                                                                }
                                                            }}
                                                            className="text-orange-400 hover:text-orange-600 p-2"
                                                            title="Reset PIN"
                                                        >
                                                            <Lock className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteKidProfile(kid.id, kid.name)}
                                                            className="text-red-400 hover:text-red-600 p-2"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }
                </div>
            </main >
            {
                view !== 'home' && portalMode !== 'kid' && (
                    <nav className="shrink-0 h-16 w-full bg-slate-900 flex items-center justify-around px-4 border-t border-white/5 z-50">
                        <button onClick={() => { setView('hub'); if (activeTab === 'settings' || activeTab === 'reminders') setActiveTab('affection'); }} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'hub' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                            <User className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Hub</span>
                        </button>
                        <button onClick={() => setView('bridge')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'bridge' || view === 'resolve' ? 'text-rose-500 scale-110' : 'text-slate-500'}`}>
                            <ShieldIcon className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Bridge</span>
                        </button>
                        <button onClick={() => setView('games')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'games' ? 'text-purple-500 scale-110' : 'text-slate-500'}`}>
                            <Gamepad2 className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Games</span>
                        </button>
                        <button onClick={() => setView('parent_hub')} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'parent_hub' ? 'text-blue-500 scale-110' : 'text-slate-500'}`}>
                            <LayoutDashboard className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Dashboard</span>
                        </button>
                        <button onClick={() => { setView('nudge'); if (activeTab !== 'settings' && activeTab !== 'reminders') setActiveTab('reminders'); }} className={`flex flex-col items-center gap-0.5 transition-all ${view === 'nudge' ? 'text-amber-500 scale-110' : 'text-slate-500'}`}>
                            <Bell className="w-6 h-6" /><span className="text-[8px] font-bold uppercase">Nudge</span>
                        </button>
                    </nav>
                )
            }
        </div >
    );
};

export default App;