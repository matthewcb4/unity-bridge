import React, { useState, useEffect } from 'react';
import {
    collection,
    query,
    onSnapshot,
    orderBy,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from 'firebase/firestore';
import { Gamepad2, Trash2 } from 'lucide-react';
import WordScramble from './components/WordScramble';
import LetterLink from './components/LetterLink';
import Battleship from './components/Battleship';

const GameHub = ({
    role,
    coupleCode,
    db,
    darkMode,
    husbandName,
    wifeName,
    sendNotification
}) => {
    const [activeGames, setActiveGames] = useState([]);
    const [currentGameId, setCurrentGameId] = useState(null);
    const [wager, setWager] = useState('');
    const [gameAnswer, setGameAnswer] = useState('');

    // --- Firestore Listener for Couple Games ---
    useEffect(() => {
        if (!coupleCode || !db) return;
        const gamesRef = collection(db, 'couples', coupleCode.toLowerCase(), 'active_games');
        const q = query(gamesRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActiveGames(games);
        });

        return () => unsubscribe();
    }, [coupleCode, db]);

    // --- Helper: Scramble Word ---
    const scrambleWord = (word) => {
        if (word.length < 3) return word;
        const arr = word.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('') === word ? scrambleWord(word) : arr.join('');
    };

    // --- Creation Handlers ---
    const createWordPuzzle = async () => {
        if (!coupleCode || !db || !role) return;
        const words = ['LOVE', 'KISS', 'HUG', 'HOME', 'TRUST', 'FOREVER', 'HEART', 'SMILE', 'DREAM', 'HAPPY'];
        const word = words[Math.floor(Math.random() * words.length)];
        const scrambled = scrambleWord(word);

        try {
            const gamesRef = collection(db, 'couples', coupleCode.toLowerCase(), 'active_games');
            const docRef = await addDoc(gamesRef, {
                type: 'word_scramble',
                word: word,
                scrambled: scrambled,
                wager: wager,
                createdBy: role,
                creatorName: role === 'his' ? husbandName : wifeName,
                createdAt: serverTimestamp(),
                currentTurn: role === 'his' ? 'hers' : 'his',
                hisScore: 0,
                hersScore: 0,
                targetScore: 10,
                solved: false
            });
            setWager('');
            setCurrentGameId(docRef.id);
        } catch (err) {
            console.error('Create game error:', err);
            alert('Could not create game.');
        }
    };

    const createLetterLinkGame = async () => {
        if (!coupleCode || !db || !role) return;
        const bagDist = { E: 12, A: 9, I: 9, O: 8, N: 6, R: 6, T: 6, L: 4, S: 4, U: 4, D: 4, G: 3, B: 2, C: 2, M: 2, P: 2, F: 2, H: 2, V: 2, W: 2, Y: 2, K: 1, J: 1, X: 1, Q: 1, Z: 1, '_': 2 };
        let bag = [];
        Object.entries(bagDist).forEach(([char, count]) => {
            for (let i = 0; i < count; i++) bag.push(char);
        });
        bag = bag.sort(() => Math.random() - 0.5);
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
                currentTurn: role,
                board: JSON.stringify(Array(121).fill(null)),
                bag: bag,
                players: {
                    his: { hand: role === 'his' ? creatorHand : partnerHand, score: 0 },
                    hers: { hand: role === 'hers' ? creatorHand : partnerHand, score: 0 }
                },
                history: []
            });
            setWager('');
            setCurrentGameId(docRef.id);
        } catch (err) {
            console.error('Create Letter Link error:', err);
        }
    };

    const createBattleshipGame = async () => {
        if (!coupleCode || !db || !role) return;
        try {
            const gamesRef = collection(db, 'couples', coupleCode.toLowerCase(), 'active_games');
            const docRef = await addDoc(gamesRef, {
                type: 'battleship',
                wager: wager,
                createdBy: role,
                creatorName: role === 'his' ? husbandName : wifeName,
                createdAt: serverTimestamp(),
                phase: 'placing',
                currentTurn: role,
                players: {
                    his: { ready: false, shipsRemaining: 5 },
                    hers: { ready: false, shipsRemaining: 5 }
                }
            });
            setWager('');
            setCurrentGameId(docRef.id);
        } catch (err) {
            console.error('Create Battleship error:', err);
        }
    };

    const deleteActiveGame = async (gameId) => {
        if (!window.confirm('Delete this game?')) return;
        try {
            await deleteDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId));
            if (currentGameId === gameId) setCurrentGameId(null);
        } catch (err) {
            console.error('Delete game error:', err);
        }
    };

    const handleWordScrambleSubmit = async (gameId, answer) => {
        const game = activeGames.find(g => g.id === gameId);
        if (!game) return;
        const isCorrect = answer.toUpperCase().trim() === game.word;
        const scoreKey = role === 'his' ? 'hisScore' : 'hersScore';

        if (isCorrect) {
            const currentScore = (game[scoreKey] || 0) + 1;
            if (currentScore >= (game.targetScore || 10)) {
                // Win
                await deleteActiveGame(gameId);
                alert(`🏆 Victory! You won with ${currentScore} points!`);
            } else {
                // Next word
                const words = ['LOVE', 'KISS', 'HUG', 'HOME', 'TRUST', 'FOREVER'];
                const newWord = words[Math.floor(Math.random() * words.length)];
                await updateDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId), {
                    word: newWord,
                    scrambled: scrambleWord(newWord),
                    [scoreKey]: currentScore,
                    currentTurn: role === 'his' ? 'hers' : 'his'
                });
            }
        } else {
            // Wrong
            await updateDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', gameId), {
                currentTurn: role === 'his' ? 'hers' : 'his'
            });
            alert('❌ Wrong guess! Turn switches.');
        }
    };

    // --- Render ---
    const activeGame = activeGames.find(g => g.id === currentGameId);

    return (
        <div className={`p-2 space-y-2 animate-in slide-in-from-bottom-4 ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {!currentGameId && (
                <div className="text-center space-y-1 pt-1">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto border-2 border-white shadow-lg">
                        <Gamepad2 className="w-6 h-6 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-black tracking-tighter italic">Couple Games</h2>
                    <p className="text-[10px] text-slate-400">Play together, wager fun rewards!</p>
                </div>
            )}

            {activeGame ? (
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

                    {activeGame.type === 'word_scramble' && (
                        <WordScramble
                            game={activeGame}
                            role={role}
                            onSubmit={handleWordScrambleSubmit}
                            darkMode={darkMode}
                            husbandName={husbandName}
                            wifeName={wifeName}
                        />
                    )}

                    {activeGame.type === 'letter_link' && (
                        <LetterLink
                            game={activeGame}
                            gameRef={doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', activeGame.id)}
                            role={role}
                            db={db}
                            coupleCode={coupleCode}
                            darkMode={darkMode}
                            husbandName={husbandName}
                            wifeName={wifeName}
                            sendNotification={sendNotification}
                        />
                    )}

                    {activeGame.type === 'battleship' && (
                        <Battleship
                            game={activeGame}
                            gameRef={doc(db, 'couples', coupleCode.toLowerCase(), 'active_games', activeGame.id)}
                            role={role}
                            db={db}
                            coupleCode={coupleCode}
                            darkMode={darkMode}
                            husbandName={husbandName}
                            wifeName={wifeName}
                            sendNotification={sendNotification}
                        />
                    )}

                    {activeGame.wager && (
                        <div className="px-2 py-1 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg text-center mt-2">
                            <p className="text-[9px] font-bold text-purple-600 uppercase">💝 Wager</p>
                            <p className="text-xs font-bold text-slate-700">{activeGame.wager}</p>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Lobby / List */}
                    {activeGames.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Active Games</p>
                            {activeGames.map(game => (
                                <button
                                    key={game.id}
                                    onClick={() => setCurrentGameId(game.id)}
                                    className={`w-full p-4 rounded-2xl border text-left flex justify-between items-center transition-all bg-white hover:bg-purple-50 ${game.currentTurn === role ? 'border-purple-300 ring-2 ring-purple-100' : 'border-slate-100'
                                        }`}
                                >
                                    <div>
                                        <p className="text-[10px] font-bold text-purple-500 uppercase">{game.type.replace('_', ' ')}</p>
                                        <p className="text-xs font-bold text-slate-700">vs {game.createdBy === role ? 'Partner' : (game.creatorName || 'Partner')}</p>
                                    </div>
                                    {game.currentTurn === role && (
                                        <span className="bg-green-100 text-green-600 text-[9px] font-black px-2 py-1 rounded-full uppercase">Your Turn</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* New Game Form */}
                    <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-4 space-y-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase text-center tracking-widest">Start New Challenge</p>

                        <div className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-400 ml-1">SET A WAGER (OPTIONAL)</p>
                            <input
                                type="text"
                                value={wager}
                                onChange={(e) => setWager(e.target.value)}
                                placeholder="Winner gets a massage, dinner choice..."
                                className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <button onClick={createWordPuzzle} className="p-3 bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 rounded-xl flex flex-col items-center gap-1 hover:scale-105 transition-all">
                                <span className="text-xl">🔤</span>
                                <span className="text-[9px] font-bold text-pink-600 uppercase">Scramble</span>
                            </button>
                            <button onClick={createLetterLinkGame} className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl flex flex-col items-center gap-1 hover:scale-105 transition-all">
                                <span className="text-xl">🧩</span>
                                <span className="text-[9px] font-bold text-indigo-600 uppercase">Link</span>
                            </button>
                            <button onClick={createBattleshipGame} className="p-3 bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100 rounded-xl flex flex-col items-center gap-1 hover:scale-105 transition-all">
                                <span className="text-xl">⚓</span>
                                <span className="text-[9px] font-bold text-cyan-600 uppercase">Battle</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default GameHub;
