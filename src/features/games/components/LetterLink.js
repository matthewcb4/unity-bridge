import React, { useState, useEffect } from 'react';
import { updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import {
    LETTER_POINTS,
    getBonusType,
    calculateMoveScore,
    validateWord,
    getWordsFormed
} from '../../../letterLinkLogic';

/**
 * LetterLink Game Component
 */
const LetterLink = ({
    game,
    gameRef,
    role,
    db,
    coupleCode,
    darkMode,
    husbandName = 'Him',
    wifeName = 'Her',
    sendNotification
}) => {
    // Internal state for the current turn's unsaved moves
    const [placedTiles, setPlacedTiles] = useState([]);
    const [selectedTileIndex, setSelectedTileIndex] = useState(null);
    const [selectedTileChar, setSelectedTileChar] = useState(null);

    const isFamilyGame = !!game.creatorAvatar; // Simple check for family game structure
    const myId = role;
    const isMyTurn = game.currentTurn === myId;
    const myData = game.players?.[myId] || { hand: [], score: 0 };
    const myHand = myData.hand || [];

    // Reset temporary state when game changes or turn changes
    useEffect(() => {
        setPlacedTiles([]);
        setSelectedTileIndex(null);
        setSelectedTileChar(null);
    }, [game.id, game.currentTurn]);

    // --- Handlers ---
    const handleTileClick = (index, char) => {
        if (!isMyTurn) return;
        if (selectedTileIndex === index) {
            setSelectedTileIndex(null);
            setSelectedTileChar(null);
        } else {
            setSelectedTileIndex(index);
            setSelectedTileChar(char);
        }
    };

    const handleBoardClick = (index) => {
        if (!isMyTurn || selectedTileIndex === null) return;

        const row = Math.floor(index / 11);
        const col = index % 11;

        // Check if cell is occupied on permanent board or temporary
        const board = JSON.parse(game.board || '[]');
        if (board[index] || placedTiles.some(t => t.row === row && t.col === col)) {
            return;
        }

        // Place tile
        setPlacedTiles([...placedTiles, {
            row,
            col,
            char: selectedTileChar,
            fromHandIndex: selectedTileIndex
        }]);
        setSelectedTileIndex(null);
        setSelectedTileChar(null);
    };

    const recallAllTiles = () => {
        setPlacedTiles([]);
        setSelectedTileIndex(null);
        setSelectedTileChar(null);
    };

    const shuffleHand = async () => {
        if (!isMyTurn) return;
        const newHand = [...myHand].sort(() => Math.random() - 0.5);
        const updatedPlayers = { ...game.players };
        updatedPlayers[myId] = { ...myData, hand: newHand };
        await updateDoc(gameRef, { players: updatedPlayers });
    };

    const submitMove = async () => {
        if (!isMyTurn || placedTiles.length === 0) return;

        const board = JSON.parse(game.board || '[]');

        // 1. Validate connectivity and line (simplified for now as per logic.js)
        const words = getWordsFormed(placedTiles, board);
        if (words.length === 0) {
            alert("Your move must connect to existing tiles!");
            return;
        }

        // 2. Validate words via Dictionary API
        for (const word of words) {
            const isValid = await validateWord(word);
            if (!isValid) {
                alert(`"${word}" is not a valid word!`);
                return;
            }
        }

        // 3. Calculate score
        const points = calculateMoveScore(placedTiles, board);

        // 4. Update Board
        const newBoard = [...board];
        placedTiles.forEach(t => {
            newBoard[t.row * 11 + t.col] = { char: t.char, player: myId };
        });

        // 5. Replenish Hand
        let bag = [...(game.bag || [])];
        const newHand = [...myHand];
        // Remove indices in descending order to avoid shift issues
        const sortedIndices = placedTiles.map(t => t.fromHandIndex).sort((a, b) => b - a);
        sortedIndices.forEach(idx => newHand.splice(idx, 1));

        const tilesNeeded = 7 - newHand.length;
        const drawn = bag.splice(0, tilesNeeded);
        const updatedHand = [...newHand, ...drawn];

        // 6. Update Players & Logic
        const updatedPlayers = { ...game.players };
        updatedPlayers[myId] = {
            ...myData,
            hand: updatedHand,
            score: (myData.score || 0) + points
        };

        const opponentId = Object.keys(game.players).find(id => id !== myId);

        // 7. Update History
        const history = [...(game.history || [])];
        history.push({
            player: myId,
            points,
            word: words.join(', '),
            timestamp: Date.now()
        });

        await updateDoc(gameRef, {
            board: JSON.stringify(newBoard),
            bag,
            players: updatedPlayers,
            currentTurn: opponentId,
            history,
            lastMoveAt: serverTimestamp()
        });

        if (sendNotification) {
            sendNotification("It's your turn!", `${game.creatorName || (myId === 'his' ? husbandName : wifeName)} scored ${points} points with ${words[0]}!`, 'games');
        }

        recallAllTiles();
    };

    const passTurn = async () => {
        if (!isMyTurn) return;
        if (!window.confirm("Are you sure you want to pass? You will trade your tiles for new ones from the bag.")) return;

        let bag = [...(game.bag || [])];
        const currentHand = [...myHand];
        const newHand = bag.splice(0, currentHand.length);
        const updatedBag = [...bag, ...currentHand].sort(() => Math.random() - 0.5);

        const updatedPlayers = { ...game.players };
        updatedPlayers[myId] = { ...myData, hand: newHand };

        const opponentId = Object.keys(game.players).find(id => id !== myId);

        await updateDoc(gameRef, {
            bag: updatedBag,
            players: updatedPlayers,
            currentTurn: opponentId,
            lastMoveAt: serverTimestamp()
        });
    };

    // --- UI Prep ---
    const board = JSON.parse(game.board || '[]');
    const displayBoard = [...board];
    placedTiles.forEach(t => {
        displayBoard[t.row * 11 + t.col] = { char: t.char, temporary: true };
    });

    const handDisplay = myHand.map((char, originalIndex) => {
        const isSelected = selectedTileIndex === originalIndex;
        const isPlaced = placedTiles.some(t => t.fromHandIndex === originalIndex);
        return { char, originalIndex, isSelected, isPlaced };
    });

    return (
        <div className="flex flex-col items-center gap-2">
            {/* 11x11 BOARD */}
            <div className={`grid grid-cols-11 gap-[1px] p-0.5 rounded-lg border shadow-inner select-none touch-none ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-indigo-900 border-indigo-950'}`}>
                {displayBoard.map((cell, i) => {
                    const isTemporary = cell?.temporary;
                    const bonus = getBonusType(i);
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

            {/* SCORES */}
            <div className={`w-full flex justify-between items-center px-1.5 py-1.5 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100'}`}>
                {Object.entries(game.players || {}).map(([id, data], i) => (
                    <div key={id} className="text-center">
                        <p className={`text-[8px] font-bold uppercase ${i === 0 ? 'text-indigo-400' : 'text-purple-400'}`}>
                            {id === 'his' ? husbandName : id === 'hers' ? wifeName : (game.creatorId === id ? game.creatorName : game.opponentName)}
                        </p>
                        <p className={`text-base font-black ${i === 0 ? 'text-indigo-700' : 'text-purple-700'}`}>{data.score || 0}</p>
                    </div>
                ))}
                <div className="text-center px-2">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Bag</p>
                    <p className="text-xs font-bold text-slate-600">{game.bag?.length || 0}</p>
                </div>
            </div>

            {/* CONTROLS */}
            <div className="flex flex-col items-center gap-2 w-full">
                <div className="w-full bg-amber-800 p-2 rounded-xl shadow-lg flex justify-center gap-1.5">
                    {handDisplay.map((tile, i) => (
                        <div
                            key={i}
                            onClick={() => !tile.isPlaced && handleTileClick(tile.originalIndex, tile.char)}
                            className={`w-9 h-11 rounded flex flex-col items-center justify-center font-black shadow transition-all
                                ${tile.isPlaced
                                    ? 'bg-amber-900/50 text-amber-900/50 border-none'
                                    : (tile.isSelected
                                        ? 'bg-amber-300 text-amber-950 border-b-4 border-amber-500 -translate-y-1'
                                        : 'bg-amber-100 text-amber-900 border-b-4 border-amber-300 hover:bg-amber-50')
                                }
                            `}
                        >
                            <span className="text-base leading-none">{tile.char}</span>
                            {!tile.isPlaced && <span className="text-[7px] font-bold opacity-60 leading-none">{LETTER_POINTS[tile.char] || 0}</span>}
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 w-full">
                    <button
                        onClick={recallAllTiles}
                        disabled={placedTiles.length === 0}
                        className="flex-1 py-2.5 bg-red-100 text-red-600 font-bold text-[10px] rounded-xl disabled:opacity-50"
                    >
                        Recall
                    </button>
                    <button
                        onClick={shuffleHand}
                        disabled={!isMyTurn}
                        className="flex-1 py-2.5 bg-blue-100 text-blue-600 font-bold text-[10px] rounded-xl disabled:opacity-50"
                    >
                        🔀 Shuffle
                    </button>
                    <button
                        onClick={submitMove}
                        disabled={!isMyTurn || placedTiles.length === 0}
                        className="flex-2 w-full py-2.5 bg-green-500 text-white font-black text-[10px] rounded-xl disabled:bg-slate-300 disabled:text-slate-500 shadow-lg"
                    >
                        {isMyTurn ? '✓ Submit' : 'Waiting...'}
                    </button>
                </div>

                {isMyTurn && (
                    <button
                        onClick={passTurn}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline"
                    >
                        Skip Turn / Swap Tiles
                    </button>
                )}
            </div>
        </div>
    );
};

export default LetterLink;
