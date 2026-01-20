import React, { useState } from 'react';
import { Heart, User, MessageCircle, Bell, ChevronRight, Check, Sparkles } from 'lucide-react';

const LOVE_LANGUAGES = [
    { id: 'Words of Affirmation', emoji: '💬', desc: 'Verbal compliments and encouragement' },
    { id: 'Quality Time', emoji: '⏰', desc: 'Undivided attention and presence' },
    { id: 'Physical Touch', emoji: '🤗', desc: 'Hugs, kisses, and physical closeness' },
    { id: 'Acts of Service', emoji: '🛠️', desc: 'Helpful actions that ease burdens' },
    { id: 'Gifts', emoji: '🎁', desc: 'Thoughtful presents and surprises' }
];

const OnboardingFlow = ({
    coupleCode,
    onComplete,
    saveSettings,
    requestNotificationPermission,
    darkMode = false,
    initialHusbandName = '',
    initialWifeName = '',
    initialHisLoveLanguage = '',
    initialHerLoveLanguage = ''
}) => {
    const [step, setStep] = useState(0);
    const [husbandName, setHusbandName] = useState(initialHusbandName);
    const [wifeName, setWifeName] = useState(initialWifeName);
    const [hisLoveLanguage, setHisLoveLanguage] = useState(initialHisLoveLanguage);
    const [herLoveLanguage, setHerLoveLanguage] = useState(initialHerLoveLanguage);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);

    const steps = [
        { title: 'Welcome', icon: Heart },
        { title: 'Names', icon: User },
        { title: 'Love Languages', icon: MessageCircle },
        { title: 'Notifications', icon: Bell },
        { title: 'Ready!', icon: Sparkles }
    ];

    const canProceed = () => {
        if (step === 1) return husbandName.trim() && wifeName.trim();
        if (step === 2) return hisLoveLanguage && herLoveLanguage;
        return true;
    };

    const handleNext = async () => {
        if (step === 1 && saveSettings) {
            await saveSettings({ husbandName, wifeName });
        }
        if (step === 2 && saveSettings) {
            await saveSettings({ hisLoveLanguage, herLoveLanguage });
        }
        if (step === 3 && requestNotificationPermission) {
            try {
                await requestNotificationPermission();
                setNotificationsEnabled(true);
            } catch (e) {
                // User declined, continue anyway
            }
        }
        if (step === steps.length - 1) {
            localStorage.setItem('onboarding_complete', 'true');
            onComplete?.();
        } else {
            setStep(s => s + 1);
        }
    };

    const bgClass = darkMode ? 'bg-slate-900' : 'bg-gradient-to-br from-rose-50 via-purple-50 to-indigo-100';
    const cardClass = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white/90 border-white';
    const textClass = darkMode ? 'text-white' : 'text-slate-800';

    return (
        <div className={`fixed inset-0 ${bgClass} flex flex-col items-center justify-center p-4 z-50`}>
            {/* Progress */}
            <div className="flex gap-2 mb-6">
                {steps.map((s, i) => (
                    <div
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${i <= step ? 'bg-rose-500 scale-110' : 'bg-slate-300'}`}
                    />
                ))}
            </div>

            {/* Card */}
            <div className={`w-full max-w-sm ${cardClass} rounded-3xl border shadow-2xl p-6 space-y-4`}>
                {/* Step 0: Welcome */}
                {step === 0 && (
                    <div className="text-center space-y-4">
                        <div className="text-6xl animate-bounce">💕</div>
                        <h1 className={`text-2xl font-black ${textClass}`}>Welcome to Unity Bridge</h1>
                        <p className="text-slate-500 text-sm">Let's set up your shared space in just a few steps.</p>
                        <div className={`text-xs font-mono px-3 py-2 rounded-xl ${darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                            Family Code: <span className="font-bold">{coupleCode}</span>
                        </div>
                    </div>
                )}

                {/* Step 1: Names */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="text-center">
                            <span className="text-4xl">👫</span>
                            <h2 className={`text-xl font-black mt-2 ${textClass}`}>What are your names?</h2>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">His Name</label>
                                <input
                                    type="text"
                                    value={husbandName}
                                    onChange={(e) => setHusbandName(e.target.value)}
                                    placeholder="e.g., Matt"
                                    className={`w-full px-4 py-3 rounded-xl border font-bold outline-none focus:ring-2 focus:ring-rose-300 ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'}`}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Her Name</label>
                                <input
                                    type="text"
                                    value={wifeName}
                                    onChange={(e) => setWifeName(e.target.value)}
                                    placeholder="e.g., Sarah"
                                    className={`w-full px-4 py-3 rounded-xl border font-bold outline-none focus:ring-2 focus:ring-rose-300 ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-50 border-slate-200'}`}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Love Languages */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="text-center">
                            <span className="text-4xl">❤️</span>
                            <h2 className={`text-xl font-black mt-2 ${textClass}`}>Love Languages</h2>
                            <p className="text-xs text-slate-500">This helps us personalize messages</p>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{husbandName || 'His'} Love Language</label>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {LOVE_LANGUAGES.map(lang => (
                                        <button
                                            key={lang.id}
                                            onClick={() => setHisLoveLanguage(lang.id)}
                                            className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${hisLoveLanguage === lang.id
                                                ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-200'
                                                : darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}
                                        >
                                            <span className="text-lg">{lang.emoji}</span>
                                            <span className={`text-xs font-bold ${hisLoveLanguage === lang.id ? 'text-blue-700' : textClass}`}>{lang.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{wifeName || 'Her'} Love Language</label>
                                <div className="grid grid-cols-1 gap-1.5">
                                    {LOVE_LANGUAGES.map(lang => (
                                        <button
                                            key={lang.id}
                                            onClick={() => setHerLoveLanguage(lang.id)}
                                            className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${herLoveLanguage === lang.id
                                                ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-200'
                                                : darkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'}`}
                                        >
                                            <span className="text-lg">{lang.emoji}</span>
                                            <span className={`text-xs font-bold ${herLoveLanguage === lang.id ? 'text-rose-700' : textClass}`}>{lang.id}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Notifications */}
                {step === 3 && (
                    <div className="text-center space-y-4">
                        <span className="text-5xl">🔔</span>
                        <h2 className={`text-xl font-black ${textClass}`}>Stay Connected</h2>
                        <p className="text-sm text-slate-500">Get notified when your partner sends messages or plays games.</p>
                        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-amber-50 border-amber-200'}`}>
                            <p className="text-xs text-amber-700">Notifications work best when the app is added to your home screen!</p>
                        </div>
                    </div>
                )}

                {/* Step 4: Complete */}
                {step === 4 && (
                    <div className="text-center space-y-4">
                        <div className="text-6xl">🎉</div>
                        <h2 className={`text-2xl font-black ${textClass}`}>You're All Set!</h2>
                        <p className="text-sm text-slate-500">
                            Welcome, {husbandName} & {wifeName}! Your Unity Bridge is ready.
                        </p>
                        <div className={`flex items-center justify-center gap-2 p-3 rounded-xl ${darkMode ? 'bg-green-900/30' : 'bg-green-100'}`}>
                            <Check className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-bold text-green-700">Setup Complete</span>
                        </div>
                    </div>
                )}

                {/* Next Button */}
                <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 transition-all ${canProceed()
                        ? 'bg-gradient-to-r from-rose-500 to-purple-500 hover:shadow-lg hover:scale-[1.02]'
                        : 'bg-slate-300 cursor-not-allowed'}`}
                >
                    {step === steps.length - 1 ? 'Start Connecting' : step === 3 ? 'Enable Notifications' : 'Continue'}
                    <ChevronRight className="w-5 h-5" />
                </button>

                {step === 3 && (
                    <button
                        onClick={() => setStep(s => s + 1)}
                        className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600"
                    >
                        Skip for now
                    </button>
                )}
            </div>
        </div>
    );
};

export default OnboardingFlow;
