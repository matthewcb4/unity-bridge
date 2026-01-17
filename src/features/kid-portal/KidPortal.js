import React, { useState, useEffect } from 'react';
import {
    ChevronRight, Check, MessageCircle, Heart, Calendar,
    BookOpen, User, PenTool, Trash2, Lock, Shield
} from 'lucide-react';
import {
    collection, addDoc, doc, updateDoc, serverTimestamp,
    query, onSnapshot, orderBy, limit
} from 'firebase/firestore';

const KidPortal = ({
    currentKid,
    role,
    coupleCode,
    db,
    darkMode,
    setView,
    setCurrentKid,
    setPortalMode,
    activeTab,
    setActiveTab,
    inputText,
    setInputText,
    setDarkMode
}) => {
    // Internal State
    const [kidJournalItems, setKidJournalItems] = useState({ mood: null });
    const [kidBridgeMessages, setKidBridgeMessages] = useState([]);
    const [kidJournalEntries, setKidJournalEntries] = useState([]);
    const [journalPrivacy, setJournalPrivacy] = useState(true);

    // Kid Bridge Listener & Journal Listener
    useEffect(() => {
        if (!currentKid || !coupleCode || !db) return;

        // Bridge Messages
        const qBridge = query(
            collection(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id, 'bridge_items'),
            orderBy('timestamp', 'asc'),
            limit(50)
        );

        // Journal Entries
        const qJournal = query(
            collection(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id, 'journal'),
            orderBy('timestamp', 'desc'),
            limit(20)
        );

        const unsubBridge = onSnapshot(qBridge, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setKidBridgeMessages(msgs);
        });

        const unsubJournal = onSnapshot(qJournal, (snapshot) => {
            const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setKidJournalEntries(entries);
        });

        return () => {
            unsubBridge();
            unsubJournal();
        };
    }, [currentKid, coupleCode, db]);

    if (!currentKid) return null;

    return (
        <div className="p-4 space-y-4 animate-in slide-in-from-bottom-4">
            {/* Kid Header */}
            {(role === 'his' || role === 'hers') && (
                <div className="bg-amber-100 text-amber-900 px-4 py-2 text-xs font-bold text-center rounded-xl flex items-center justify-center gap-2">
                    <span>👀</span>
                    <span>Viewing as {currentKid.name} (Managed by {role === 'his' ? 'Dad' : 'Mom'})</span>
                </div>
            )}
            <div className="text-center space-y-2 pt-2 relative">
                {role && (
                    <button
                        onClick={() => setView('parent_hub')}
                        className="absolute top-0 left-0 p-2 text-slate-400 hover:text-purple-600 transition-colors"
                        title="Back to Dashboard"
                    >
                        <ChevronRight className="w-6 h-6 rotate-180" />
                    </button>
                )}
                <button
                    onClick={() => {
                        if (window.confirm('Switch users?')) {
                            setCurrentKid(null);
                            setPortalMode('couple');
                            localStorage.removeItem('current_kid_id');
                            localStorage.removeItem('portal_mode');
                            setView('home');
                        }
                    }}
                    className="absolute top-0 right-0 p-2 text-slate-400 hover:text-rose-500"
                    title="Sign Out"
                >
                    👋
                </button>
                <span className="text-6xl">{currentKid.avatar || '🧒'}</span>
                <h2 className={`text-2xl font-black tracking-tighter ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    Hi, {currentKid.name}! 👋
                </h2>
            </div>

            {/* Kid Tabs */}
            <div className={`flex p-1.5 rounded-2xl border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
                {[
                    { id: 'journal', label: '📔 Journal' },
                    { id: 'games', label: '🎮 Games' },
                    { id: 'bridge', label: '💬 Parents' },
                    { id: 'me', label: '⭐ Me' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => tab.id === 'games' ? setView('family_games') : setActiveTab(tab.id)}
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

                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Write about your day..."
                        className={`w-full h-32 p-4 rounded-2xl border resize-none text-sm outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                    />

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

                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center">
                            <h4 className={`text-xs font-black uppercase ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                                {role === 'his' || role === 'hers' ? '🔒 Kid Journal' : 'Your Past Entries'}
                            </h4>
                            {(role === 'his' || role === 'hers') && (
                                <button
                                    onClick={() => setJournalPrivacy(!journalPrivacy)}
                                    className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded-lg"
                                >
                                    {journalPrivacy ? '👁️ Reveal All' : '🔒 Hide Content'}
                                </button>
                            )}
                        </div>

                        {kidJournalEntries.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center">No entries yet. Start writing!</p>
                        ) : (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {kidJournalEntries.map(entry => {
                                    const isParent = role === 'his' || role === 'hers';
                                    const isBlurred = isParent && journalPrivacy;

                                    return (
                                        <div key={entry.id} className={`relative p-4 rounded-2xl border transition-all ${darkMode ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-100'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xl">{entry.mood || '😊'}</span>
                                                <div className="text-right">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                                        {entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                                                    </span>
                                                    {entry.readByParent && (
                                                        <span className="text-[9px] font-bold text-green-500 flex items-center justify-end gap-0.5">
                                                            <Check className="w-3 h-3" /> Read by Parent
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`relative ${isBlurred ? 'blur-sm select-none' : ''}`}>
                                                <p className={`text-sm mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>{entry.content}</p>
                                            </div>

                                            {isBlurred && (
                                                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-[1px]">
                                                    <button
                                                        onClick={() => setJournalPrivacy(false)}
                                                        className="px-3 py-1.5 bg-slate-800 text-white text-[10px] font-bold rounded-full shadow-lg"
                                                    >
                                                        🔒 Private • Tap to Reveal
                                                    </button>
                                                </div>
                                            )}

                                            <div className="flex justify-end gap-2 mt-2">
                                                {isParent && !entry.readByParent && !isBlurred && (
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const entryRef = doc(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id, 'journal', entry.id);
                                                                await updateDoc(entryRef, { readByParent: true });
                                                            } catch (err) { console.error(err); }
                                                        }}
                                                        className="px-3 py-1.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full hover:bg-green-200"
                                                    >
                                                        ✓ Mark as Read
                                                    </button>
                                                )}

                                                {!isParent && (
                                                    <button
                                                        onClick={async () => {
                                                            if (window.confirm('Share this entry with Mom & Dad?')) {
                                                                try {
                                                                    const bridgeRef = collection(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id, 'bridge_items');
                                                                    await addDoc(bridgeRef, {
                                                                        content: `[Shared Journal Entry] ${entry.content}`,
                                                                        from: currentKid.name,
                                                                        authorId: currentKid.id,
                                                                        timestamp: serverTimestamp(),
                                                                        readByParent: false
                                                                    });
                                                                    alert('Shared to Parents! 📤');
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert('Failed to share.');
                                                                }
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full hover:bg-green-200"
                                                    >
                                                        Share with Parents 📤
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Bridge Tab */}
            {activeTab === 'bridge' && (
                <div className={`rounded-3xl shadow-xl border p-6 space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
                    <h3 className={`text-lg font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Message Mom & Dad</h3>

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
                                            authorId: currentKid.id,
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

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-purple-500 uppercase">Or write your own</p>
                        <div className="flex gap-2">
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Write a message..."
                                className={`flex-1 h-12 p-3 rounded-xl border resize-none text-sm outline-none ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'}`}
                            />
                            <button
                                onClick={async () => {
                                    if (!inputText.trim()) return;
                                    try {
                                        const bridgeRef = collection(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id, 'bridge_items');
                                        await addDoc(bridgeRef, {
                                            content: inputText,
                                            from: currentKid.name,
                                            authorId: currentKid.id,
                                            timestamp: serverTimestamp(),
                                            readByParent: false
                                        });
                                        setInputText('');
                                    } catch (err) {
                                        console.error('Kid bridge error:', err);
                                    }
                                }}
                                className="w-12 bg-purple-600 text-white font-bold rounded-xl flex items-center justify-center text-xl"
                            >
                                ➤
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto p-2 bg-slate-50/50 rounded-xl border border-slate-100/50 flex flex-col-reverse">
                        {kidBridgeMessages.length === 0 ? (
                            <p className="text-xs text-center text-slate-400 py-4 italic">No messages yet. Say hi! 👋</p>
                        ) : (
                            kidBridgeMessages.map(msg => {
                                const isFromKid = msg.authorId === currentKid.id || msg.from === currentKid.name;
                                return (
                                    <div key={msg.id} className={`flex ${isFromKid ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-bold ${isFromKid
                                            ? (darkMode ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-purple-100 text-purple-900 rounded-tr-none')
                                            : (darkMode ? 'bg-slate-700 text-slate-200 rounded-tl-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none')
                                            }`}>
                                            {!isFromKid && <p className="text-[9px] font-black opacity-50 mb-1 uppercase">{msg.from}</p>}
                                            {msg.content}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Me Tab */}
            {activeTab === 'me' && (
                <div className={`rounded-3xl shadow-xl border p-6 space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-purple-100'}`}>
                    <div className="text-center space-y-2">
                        <span className="text-6xl animate-bounce-slow">{currentKid.avatar || '🧒'}</span>
                        <h3 className={`text-xl font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{currentKid.name}</h3>
                    </div>

                    {currentKid.birthday ? (
                        <div className={`p-4 rounded-2xl text-center space-y-1 ${darkMode ? 'bg-slate-700' : 'bg-gradient-to-r from-purple-100 to-pink-100'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-purple-600'}`}>I have been alive for</p>
                            <p className={`text-4xl font-black ${darkMode ? 'text-white' : 'text-purple-700'}`}>
                                {Math.floor((new Date() - new Date(currentKid.birthday)) / (1000 * 60 * 60 * 24)).toLocaleString()}
                            </p>
                            <p className={`text-xs font-bold ${darkMode ? 'text-slate-400' : 'text-purple-600'}`}>Days! 🎂</p>
                        </div>
                    ) : (
                        <div className={`p-4 rounded-2xl text-center border-dashed border-2 ${darkMode ? 'border-slate-600 bg-slate-700' : 'border-purple-200 bg-purple-50'}`}>
                            <p className="text-xs text-slate-400 mb-2">When is your birthday?</p>
                            <input
                                type="date"
                                className={`p-2 rounded-xl text-sm font-bold text-center outline-none ${darkMode ? 'bg-slate-600 text-white' : 'bg-white text-purple-600 border border-purple-100'}`}
                                onChange={async (e) => {
                                    const newBirthday = e.target.value;
                                    try {
                                        const kidRef = doc(db, 'families', coupleCode.toLowerCase(), 'kids', currentKid.id);
                                        await updateDoc(kidRef, { birthday: newBirthday });
                                        // Update parent state if needed, or rely on snapshot
                                    } catch (err) {
                                        console.error('Error updating birthday:', err);
                                    }
                                }}
                            />
                        </div>
                    )}

                    <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Settings</p>
                        <button
                            onClick={() => {
                                const newMode = !darkMode;
                                setDarkMode(newMode);
                                localStorage.setItem('theme', newMode ? 'dark' : 'light');
                            }}
                            className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-all ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-700'}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{darkMode ? '🌙' : '☀️'}</span>
                                <span className="text-sm font-bold">{darkMode ? 'Dark Mode' : 'Light Mode'}</span>
                            </div>
                            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${darkMode ? 'bg-purple-600' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            if (window.confirm('Are you sure you want to switch users?')) {
                                setCurrentKid(null);
                                setPortalMode('couple');
                                localStorage.removeItem('current_kid_id');
                                localStorage.removeItem('portal_mode');
                                setView('home');
                            }
                        }}
                        className={`w-full py-4 rounded-2xl text-sm font-bold mt-4 ${darkMode ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
                    >
                        👋 Switch User
                    </button>
                </div>
            )}
        </div>
    );
};

export default KidPortal;
