import React, { useState } from 'react';
import { Lock, Unlock, Key, Gift, Send, Shield, Heart } from 'lucide-react';
import { updateDoc, serverTimestamp } from 'firebase/firestore';

const UnlockTheNight = ({ game, gameRef, role, husbandName, wifeName, sendPushNotification }) => {
    // Game state is passed in via 'game' prop from GameHub
    // game.reward, game.totalLocks, game.unlockedCount, game.keeperRole ('his'/'hers')
    // game.currentChallenge, game.turn ('seeker_wait', 'keeper_action', 'seeker_action')

    const [inputReward, setInputReward] = useState('');
    const [challengeInput, setChallengeInput] = useState('');

    // Derived state
    const isKeeper = role === game.keeperRole;
    const isSeeker = !isKeeper;
    const allUnlocked = game.unlockedCount >= game.totalLocks;

    const partnerName = role === 'his' ? wifeName : husbandName;
    const myName = role === 'his' ? husbandName : wifeName;
    const partnerRole = role === 'his' ? 'hers' : 'his';

    // Actions
    const handleSetReward = async () => {
        if (!inputReward.trim()) return;
        await updateDoc(gameRef, {
            reward: inputReward,
            totalLocks: 3,
            unlockedCount: 0,
            phase: 'locked',
            turn: 'seeker_action' // Seeker starts by asking for a key
        });
        // Notify Seeker
        if (game[`${partnerRole}FcmToken`] && sendPushNotification) {
            sendPushNotification(game[`${partnerRole}FcmToken`], 'Unity Bridge 🔒', `${myName} has locked a reward for tonight!`);
        }
    };

    const handleRequestKey = async () => {
        await updateDoc(gameRef, {
            turn: 'keeper_action', // Keeper needs to set a challenge
            lastAction: `requested a key`
        });
        // Notify Keeper
        if (game[`${partnerRole}FcmToken`] && sendPushNotification) {
            sendPushNotification(game[`${partnerRole}FcmToken`], 'Unity Bridge 🗝️', `${myName} is requesting a key!`);
        }
    };

    const handleSendChallenge = async () => {
        if (!challengeInput.trim()) return;
        await updateDoc(gameRef, {
            currentChallenge: challengeInput,
            turn: 'seeker_action', // Seeker needs to do the challenge
            challengeStatus: 'pending'
        });
        setChallengeInput('');
        // Notify Seeker
        if (game[`${partnerRole}FcmToken`] && sendPushNotification) {
            sendPushNotification(game[`${partnerRole}FcmToken`], 'Unity Bridge 🔥', `New Challenge: ${challengeInput}`);
        }
    };

    const handleMarkChallengeDone = async () => {
        await updateDoc(gameRef, {
            challengeStatus: 'completed',
            turn: 'keeper_action' // Keeper needs to verify and unlock
        });
        // Notify Keeper
        if (game[`${partnerRole}FcmToken`] && sendPushNotification) {
            sendPushNotification(game[`${partnerRole}FcmToken`], 'Unity Bridge ✅', `${myName} completed the challenge! Verify it.`);
        }
    };

    const handleUnlockKey = async () => {
        const newCount = (game.unlockedCount || 0) + 1;
        const revealed = newCount >= 3;
        await updateDoc(gameRef, {
            unlockedCount: newCount,
            currentChallenge: null,
            challengeStatus: null,
            turn: 'seeker_action', // Back to seeker to ask for next key
            phase: revealed ? 'revealed' : 'locked'
        });
        // Notify Seeker
        if (game[`${partnerRole}FcmToken`] && sendPushNotification) {
            if (revealed) {
                sendPushNotification(game[`${partnerRole}FcmToken`], 'Unity Bridge 🎁', `REWARD UNLOCKED: ${game.reward}`);
            } else {
                sendPushNotification(game[`${partnerRole}FcmToken`], 'Unity Bridge 🔓', `Key #${newCount} Unlocked! ${3 - newCount} to go.`);
            }
        }
    };

    // --- RENDER ---

    // Phase 1: Setup (Only visible to Keeper if reward not set)
    if (!game.reward) {
        if (isKeeper) {
            return (
                <div className="p-4 space-y-4 text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Gift className="w-8 h-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-bold text-purple-900">Unlock the Night</h3>
                    <p className="text-sm text-slate-600">
                        Set a secret reward for {partnerName} to unlock tonight.
                        They will have to complete 3 challenges to reveal it!
                    </p>
                    <input
                        type="text"
                        value={inputReward}
                        onChange={(e) => setInputReward(e.target.value)}
                        placeholder="e.g. A 30-min massage, Dinner at X..."
                        className="w-full p-3 border rounded-xl text-center"
                    />
                    <button
                        onClick={handleSetReward}
                        className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-all"
                    >
                        Lock it Away 🔒
                    </button>
                </div>
            );
        } else {
            return (
                <div className="p-8 text-center space-y-4">
                    <div className="animate-bounce">⏳</div>
                    <p className="text-slate-500 italic">Waiting for {partnerName} to prepare a secret reward...</p>
                </div>
            );
        }
    }

    // Phase 3: Revealed!
    if (game.phase === 'revealed') {
        return (
            <div className="p-6 text-center space-y-6 animate-in zoom-in-50 duration-500">
                <div className="relative inline-block">
                    <div className="absolute inset-0 bg-yellow-400 blur-xl opacity-50 animate-pulse"></div>
                    <Gift className="w-24 h-24 text-purple-600 relative z-10 mx-auto" />
                </div>

                <h2 className="text-2xl font-black text-purple-900 uppercase tracking-widest">Unlocked!</h2>

                <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-2xl border-2 border-purple-200">
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">The Reward</p>
                    <p className="text-xl font-medium text-slate-800 font-serif italic">"{game.reward}"</p>
                </div>

                <p className="text-xs text-slate-400">Enjoy your evening together! ❤️</p>
            </div>
        );
    }

    // Phase 2: Locked Gameplay
    return (
        <div className="p-2 space-y-4">
            {/* Header / Status */}
            <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-inner">
                <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`transition-all duration-500 ${i <= game.unlockedCount ? 'opacity-30 scale-90' : 'opacity-100 scale-110'}`}>
                            {i <= game.unlockedCount ? <Unlock size={20} className="text-green-400" /> : <Lock size={24} className="text-red-400" />}
                        </div>
                    ))}
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Progress</p>
                    <p className="text-sm font-bold">{game.unlockedCount} / {game.totalLocks} Keys</p>
                </div>
            </div>

            {/* Main Action Area */}
            <div className="bg-white border rounded-xl p-4 shadow-sm min-h-[200px] flex flex-col justify-center items-center text-center">

                {/* SEEKER VIEW */}
                {isSeeker && (
                    <>
                        {game.turn === 'seeker_action' && !game.currentChallenge && (
                            <div className="space-y-4">
                                <p className="text-slate-600">You need {3 - game.unlockedCount} more keys.</p>
                                <button
                                    onClick={handleRequestKey}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
                                >
                                    <Key size={18} /> Request Key #{game.unlockedCount + 1}
                                </button>
                            </div>
                        )}

                        {game.turn === 'keeper_action' && !game.currentChallenge && (
                            <div className="animate-pulse flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-xl">
                                <Shield size={32} className="text-slate-300" />
                                <p className="text-slate-600 font-bold">Waiting for Partner...</p>
                                <p className="text-xs text-slate-400 italic">They need to send you a challenge for the key.</p>
                            </div>
                        )}

                        {game.currentChallenge && game.challengeStatus !== 'completed' && (
                            <div className="space-y-4 w-full">
                                <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
                                    <p className="text-[10px] text-red-400 font-black uppercase mb-1">🔥 Your Challenge</p>
                                    <p className="text-lg font-medium text-slate-800">"{game.currentChallenge}"</p>
                                </div>
                                <button
                                    onClick={handleMarkChallengeDone}
                                    className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold"
                                >
                                    I Did It! (Verify)
                                </button>
                            </div>
                        )}

                        {game.challengeStatus === 'completed' && (
                            <div className="space-y-2">
                                <p className="text-green-600 font-bold">Challenge submitted!</p>
                                <p className="text-slate-400 text-xs">Waiting for verification...</p>
                            </div>
                        )}
                    </>
                )}

                {/* KEEPER VIEW */}
                {isKeeper && (
                    <>
                        {game.turn === 'seeker_action' && !game.currentChallenge && (
                            <div className="space-y-2">
                                <p className="text-slate-500">The Seeker is preparing to ask for a key...</p>
                            </div>
                        )}

                        {game.turn === 'keeper_action' && !game.currentChallenge && (
                            <div className="space-y-3 w-full">
                                <p className="text-sm font-bold text-slate-700">They want a key! Set a challenge:</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={challengeInput}
                                        onChange={(e) => setChallengeInput(e.target.value)}
                                        placeholder="e.g. Send a selfie, Text a kiss..."
                                        className="flex-1 p-2 border rounded-lg text-sm"
                                    />
                                    <button
                                        onClick={handleSendChallenge}
                                        className="bg-purple-600 text-white p-2 rounded-lg"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 justify-center mt-2">
                                    <button onClick={() => setChallengeInput("Send me a cute selfie")} className="text-[10px] bg-slate-100 px-2 py-1 rounded-full">📸 Selfie</button>
                                    <button onClick={() => setChallengeInput("Tell me what you want later")} className="text-[10px] bg-slate-100 px-2 py-1 rounded-full">💭 Fantasy</button>
                                    <button onClick={() => setChallengeInput("Bring me a drink")} className="text-[10px] bg-slate-100 px-2 py-1 rounded-full">🥤 Service</button>
                                </div>
                            </div>
                        )}

                        {game.currentChallenge && game.challengeStatus !== 'completed' && (
                            <div className="space-y-2">
                                <p className="text-slate-400 text-xs uppercase font-bold">Current Challenge</p>
                                <p className="font-medium">"{game.currentChallenge}"</p>
                                <p className="text-xs text-slate-400 italic">Waiting for them to complete it...</p>
                            </div>
                        )}

                        {game.challengeStatus === 'completed' && (
                            <div className="space-y-4 w-full">
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <p className="text-green-700 font-bold text-sm">They said they did it!</p>
                                </div>
                                <button
                                    onClick={handleUnlockKey}
                                    className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-400 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 animate-bounce"
                                >
                                    <Unlock size={20} /> Grant Key #{game.unlockedCount + 1}
                                </button>
                            </div>
                        )}
                    </>
                )}

            </div>
        </div>
    );
};

export default UnlockTheNight;
