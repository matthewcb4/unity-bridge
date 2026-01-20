import React, { useState } from 'react';

/**
 * WordScramble Component
 * Reusable component for both Couples and Family game modes.
 * 
 * Props:
 * @param {Object} game - The game data from Firestore
 * @param {string} role - 'his' or 'hers' for couples, or current kid ID for family
 * @param {Function} onSubmit - Handler for submitting an answer
 * @param {boolean} darkMode - Dark mode flag
 * @param {string} husbandName
 * @param {string} wifeName
 */
const WordScramble = ({
    game,
    role,
    onSubmit,
    darkMode,
    husbandName = 'Him',
    wifeName = 'Her'
}) => {
    const [inputText, setInputText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        onSubmit(game.id, inputText.trim());
        setInputText('');
    };

    const isFamilyGame = !!game.players && typeof game.players === 'object' &&
        !('his' in (game.players || {})) && !('hers' in (game.players || {}));
    const myId = role;
    const isMyTurn = game.currentTurn === myId;

    return (
        <div className={`space-y-4 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            <div className="text-center">
                <p className="text-[10px] font-bold text-purple-500 uppercase">
                    {isFamilyGame ? 'Family Word Scramble' : `Word Scramble from ${game.creatorName || (game.createdBy === 'his' ? husbandName : wifeName)}`}
                </p>
                {game.hint && <p className="text-xs text-pink-500 mt-1">{game.hint}</p>}
            </div>

            <div className="text-center py-6">
                <p className="text-4xl font-black tracking-[0.3em] uppercase">{game.scrambled}</p>
            </div>

            {/* Scoreboard (Visible for all) */}
            <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-purple-50 p-2 rounded-xl">
                    <p className="text-[9px] font-black text-purple-500 uppercase">You</p>
                    <p className="text-2xl font-black text-purple-600">
                        {isFamilyGame
                            ? (game.players?.[myId]?.score || 0)
                            : (myId === 'his' ? (game.hisScore || 0) : (game.hersScore || 0))}
                    </p>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Opponent</p>
                    <p className="text-2xl font-black text-slate-600">
                        {isFamilyGame
                            ? (Object.entries(game.players || {}).find(([id]) => id !== myId)?.[1]?.score || 0)
                            : (myId === 'his' ? (game.hersScore || 0) : (game.hisScore || 0))}
                    </p>
                </div>
            </div>
            {isFamilyGame && <p className="col-span-2 text-[9px] text-slate-400 text-center">First to {game.targetScore} points wins!</p>}

            {/* Turn indicator */}
            {!isMyTurn && (
                <div className={`p-3 rounded-xl text-center ${darkMode ? 'bg-slate-700' : 'bg-amber-50 border border-amber-200'}`}>
                    <p className={`text-xs font-bold italic ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                        ⏳ Waiting for {isFamilyGame ? "opponent's" : (myId === 'his' ? wifeName : husbandName) + "'s"} turn...
                    </p>
                </div>
            )}

            {isMyTurn && (
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type your guess..."
                        className={`flex-1 p-3 rounded-xl border font-bold text-sm ${darkMode
                            ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                            : 'bg-slate-50 border-purple-100 placeholder-slate-400'
                            }`}
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:bg-purple-700 active:scale-95 transition-all text-sm"
                    >
                        Guess
                    </button>
                </form>
            )}
        </div>
    );
};

export default WordScramble;
