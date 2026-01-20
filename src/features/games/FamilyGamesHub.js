import React, { useState, useEffect } from 'react';
import {
    collection,
    query,
    onSnapshot,
    orderBy,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import { Gamepad2, Trash2 } from 'lucide-react';
import WordScramble from './components/WordScramble';
import LetterLink from './components/LetterLink';
import Battleship from './components/Battleship';
import DotsAndBoxes from './components/DotsAndBoxes';

// ... (existing imports)

const FamilyGamesHub = ({
    role,
    coupleCode,
    db,
    darkMode,
    husbandName,
    wifeName,
    kidProfiles,
    currentKid,
    sendNotification,
    onBack
}) => {
    const [familyActiveGames, setFamilyActiveGames] = useState([]);
    const [currentFamilyGameId, setCurrentFamilyGameId] = useState(null);
    const [familyGameTab, setFamilyGameTab] = useState('lobby');
    const [selectedOpponent, setSelectedOpponent] = useState(null);

    // Helpers
    const getMyId = () => currentKid ? currentKid.id : role;
    const getMyName = () => currentKid ? currentKid.name : (role === 'his' ? husbandName : wifeName);
    const getMyAvatar = () => currentKid ? currentKid.avatar : (role === 'his' ? '👨' : '👩');

    const getFamilyMembers = () => {
        const members = [
            { id: 'his', name: husbandName || 'Dad', avatar: '👨' },
            { id: 'hers', name: wifeName || 'Mom', avatar: '👩' },
            ...(kidProfiles || [])
        ];
        return members.filter(m => m.id !== getMyId());
    };

    const handleWordScrambleSubmit = async (gameId, answer) => {
        const game = familyActiveGames.find(g => g.id === gameId);
        if (!game) return;
        if (answer.toUpperCase().trim() === game.word) {
            const newScore = (game.players[getMyId()]?.score || 0) + 1;
            const words = ['FAMILY', 'TOGETHER', 'HAPPY', 'LOVE', 'GAMES', 'SMILE', 'FRIENDS'];
            const newWord = words[Math.floor(Math.random() * words.length)];

            await updateDoc(doc(db, 'families', coupleCode.toLowerCase(), 'family_games', gameId), {
                [`players.${getMyId()}.score`]: newScore,
                word: newWord,
                scrambled: newWord.split('').sort(() => Math.random() - 0.5).join(''),
                currentTurn: game.opponentId === getMyId() ? game.createdBy : game.opponentId
            });
        }
    };

    // Listen for games
    useEffect(() => {
        if (!coupleCode) return;
        const q = query(
            collection(db, 'families', coupleCode.toLowerCase(), 'family_games'),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFamilyActiveGames(games.filter(g => g.phase !== 'completed'));
        });
        return () => unsubscribe();
    }, [coupleCode, db]);

    // --- Creation Handler ---
    const createGame = async (opponent, gameType) => {
        const gamesRef = collection(db, 'families', coupleCode.toLowerCase(), 'family_games');
        const myId = getMyId();

        let gameData = {
            type: gameType,
            createdBy: myId,
            creatorName: getMyName(),
            creatorAvatar: getMyAvatar(),
            opponentId: opponent.id,
            opponentName: opponent.name,
            opponentAvatar: opponent.avatar || '👤',
            createdAt: serverTimestamp(),
            currentTurn: myId,
            phase: 'active'
        };

        if (gameType === 'word_scramble') {
            // ... (existing logic)
            const words = ['FAMILY', 'TOGETHER', 'HAPPY', 'LOVE', 'GAMES', 'SMILE', 'FRIENDS'];
            const word = words[Math.floor(Math.random() * words.length)];
            gameData.word = word;
            gameData.scrambled = word.split('').sort(() => Math.random() - 0.5).join('');
            gameData.hint = `${word.length} letters`;
            gameData.targetScore = 10;
            gameData.players = { [myId]: { score: 0 }, [opponent.id]: { score: 0 } };
        } else if (gameType === 'letter_link') {
            // ... (existing logic)
            let bag = 'EEEEEEEEEEEEAAAAAAAAAIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ'.split('');
            // Fisher-Yates Shuffle
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            gameData.board = JSON.stringify(Array(121).fill(null));
            gameData.bag = bag;
            gameData.players = { [myId]: { hand: bag.splice(0, 7), score: 0 }, [opponent.id]: { hand: bag.splice(0, 7), score: 0 } };
        } else if (gameType === 'battleship') {
            gameData.phase = 'placing';
            gameData.players = { [myId]: { ready: false, shipsRemaining: 5 }, [opponent.id]: { ready: false, shipsRemaining: 5 } };
        } else if (gameType === 'dots_and_boxes') {
            gameData.gridSize = 4; // 4x4 dots = 3x3 boxes
            gameData.lines = {};
            gameData.boxes = {};
            gameData.players = { [myId]: { score: 0 }, [opponent.id]: { score: 0 } };
        }

        try {
            const docRef = await addDoc(gamesRef, gameData);
            setCurrentFamilyGameId(docRef.id);
            setSelectedOpponent(null);
        } catch (err) {
            console.error('Create game error:', err);
        }
    };
    // --- Delete Handler ---
    const deleteGame = async (gameId, e) => {
        e.stopPropagation(); // Prevent opening the game
        if (!window.confirm('Are you sure you want to delete this game?')) return;
        try {
            await deleteDoc(doc(db, 'families', coupleCode.toLowerCase(), 'family_games', gameId));
        } catch (err) {
            console.error('Error deleting game:', err);
        }
    };

    // --- Render ---
    const myId = getMyId();
    const activeGame = familyActiveGames.find(g => g.id === currentFamilyGameId);

    if (activeGame) {
        return (
            <div className="p-2 space-y-3 animate-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <button
                        onClick={() => setCurrentFamilyGameId(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                    >
                        ← Exit Game
                    </button>
                    <p className="text-xs font-bold text-purple-500 uppercase bg-purple-50 px-3 py-1 rounded-full">{activeGame.type.replace(/_/g, ' ')}</p>
                </div>

                {activeGame.type === 'word_scramble' && (
                    <WordScramble
                        game={activeGame}
                        role={myId}
                        onSubmit={handleWordScrambleSubmit}
                        darkMode={darkMode}
                    />
                )}

                {activeGame.type === 'letter_link' && (
                    <LetterLink
                        game={activeGame}
                        gameRef={doc(db, 'families', coupleCode.toLowerCase(), 'family_games', activeGame.id)}
                        role={myId}
                        db={db}
                        coupleCode={coupleCode}
                        darkMode={darkMode}
                        sendNotification={sendNotification}
                    />
                )}

                {activeGame.type === 'battleship' && (
                    <Battleship
                        game={activeGame}
                        gameRef={doc(db, 'families', coupleCode.toLowerCase(), 'family_games', activeGame.id)}
                        role={myId}
                        db={db}
                        coupleCode={coupleCode}
                        darkMode={darkMode}
                        sendNotification={sendNotification}
                    />
                )}

                {activeGame.type === 'dots_and_boxes' && (
                    <DotsAndBoxes
                        game={activeGame}
                        gameRef={doc(db, 'families', coupleCode.toLowerCase(), 'family_games', activeGame.id)}
                        role={myId}
                        db={db}
                        coupleCode={coupleCode}
                        darkMode={darkMode}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="p-2 space-y-3 animate-in slide-in-from-bottom-4">
            {/* ... (existing header) */}
            <div className="text-center space-y-1">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto border-2 shadow-lg ${darkMode ? 'bg-purple-900 border-purple-700' : 'bg-purple-100 border-white'}`}>
                    <Gamepad2 className="w-7 h-7 text-purple-600" />
                </div>
                <h2 className={`text-xl font-black tracking-tighter ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>Family Games</h2>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setFamilyGameTab('lobby')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${familyGameTab === 'lobby' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>🎮 Lobby</button>
                <button onClick={() => setFamilyGameTab('scoreboard')} className={`flex-1 py-2 rounded-xl text-xs font-bold ${familyGameTab === 'scoreboard' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'}`}>🏆 Scoreboard</button>
            </div>

            {familyGameTab === 'lobby' ? (
                <>
                    {/* Active Games */}
                    <div className="space-y-2">
                        {familyActiveGames.filter(g => g.createdBy === myId || g.opponentId === myId).map(game => (
                            <button
                                key={game.id}
                                onClick={() => setCurrentFamilyGameId(game.id)}
                                className={`w-full p-3 rounded-xl border text-left flex justify-between items-center bg-white ${game.currentTurn === myId ? 'border-purple-300 ring-2 ring-purple-50' : 'border-slate-100'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{game.createdBy === myId ? game.opponentAvatar : game.creatorAvatar}</span>
                                    <div>
                                        <p className="text-[10px] font-bold text-purple-500 uppercase">{game.type.replace(/_/g, ' ')}</p>
                                        <p className="text-xs font-bold text-slate-700">vs {game.createdBy === myId ? game.opponentName : game.creatorName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {game.currentTurn === myId && <span className="text-[9px] font-black bg-green-100 text-green-600 px-2 py-0.5 rounded-full">YOUR TURN</span>}
                                    <button
                                        onClick={(e) => deleteGame(game.id, e)}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                {game.currentTurn === myId && <span className="text-[9px] font-black bg-green-100 text-green-600 px-2 py-0.5 rounded-full">YOUR TURN</span>}
                            </button>
                        ))}
                    </div>

                    {/* Challenge Someone */}
                    <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-4 space-y-3">
                        <p className="text-xs font-black text-purple-600 uppercase text-center">Challenge Someone!</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {getFamilyMembers().map(m => (
                                <button key={m.id} onClick={() => setSelectedOpponent(m)} className={`p-2 rounded-xl border flex flex-col items-center gap-1 min-w-[60px] ${selectedOpponent?.id === m.id ? 'bg-purple-100 border-purple-400' : 'bg-slate-50 border-slate-200'}`}>
                                    <span className="text-2xl">{m.avatar}</span>
                                    <span className="text-[10px] font-bold text-slate-600">{m.name}</span>
                                </button>
                            ))}
                        </div>

                        {selectedOpponent && (
                            <div className="grid grid-cols-4 gap-2 pt-2 border-t">
                                <button onClick={() => createGame(selectedOpponent, 'word_scramble')} className="p-3 bg-slate-50 rounded-xl flex flex-col items-center"><span className="text-xl">🔤</span></button>
                                <button onClick={() => createGame(selectedOpponent, 'letter_link')} className="p-3 bg-slate-50 rounded-xl flex flex-col items-center"><span className="text-xl">🧩</span></button>
                                <button onClick={() => createGame(selectedOpponent, 'battleship')} className="p-3 bg-slate-50 rounded-xl flex flex-col items-center"><span className="text-xl">⚓</span></button>
                                <button onClick={() => createGame(selectedOpponent, 'dots_and_boxes')} className="p-3 bg-slate-50 rounded-xl flex flex-col items-center border border-indigo-200"><span className="text-xl">🟦</span></button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-4 space-y-2">
                    <p className="text-sm font-black text-center text-purple-600 uppercase">Leaderboard</p>
                    {/* Scoreboard logic can be refined here */}
                    <p className="text-center text-slate-400 text-xs italic">Competing for family glory!</p>
                </div>
            )}
        </div>
    );
};

export default FamilyGamesHub;
