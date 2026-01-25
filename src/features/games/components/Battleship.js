import React, { useState, useEffect } from 'react';
import { updateDoc, serverTimestamp, addDoc, collection, getDoc } from 'firebase/firestore';
import {
    SHIPS,
    createEmptyGrid,
    isValidPlacement,
    placeShipOnGrid,
    processAttack,
    checkAllShipsSunk,
    countRemainingShips,
    hasPlacedAllShips,
    getAttackDisplay
} from '../../../battleshipLogic';
import BattleshipGrid from './BattleshipGrid';
import { useToast } from '../../../components/Toast/ToastContext';

/**
 * Battleship Game Component
 */
const Battleship = ({
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
    const toast = useToast();
    // Local state for placement phase
    const [localPlacementGrid, setLocalPlacementGrid] = useState(createEmptyGrid());
    const [selectedShip, setSelectedShip] = useState(null);
    const [orientation, setOrientation] = useState('horizontal');
    const [viewMode, setViewMode] = useState('attack'); // 'attack' or 'fleet' during battle

    const isFamilyGame = !!game.creatorAvatar;
    const myId = role;
    const phase = game.phase || 'placing';
    const isMyTurn = game.currentTurn === myId;
    const myData = game.players?.[myId] || {};
    const opponentId = Object.keys(game.players || {}).find(id => id !== myId);
    const opponentData = game.players?.[opponentId] || {};

    // --- Handlers ---
    const handlePlacementClick = (row, col) => {
        if (phase !== 'placing' || myData.ready || !selectedShip) return;

        if (!isValidPlacement(localPlacementGrid, selectedShip, row, col, orientation)) {
            alert('Invalid placement! Ships cannot overlap or go out of bounds.');
            return;
        }

        const newGrid = placeShipOnGrid(localPlacementGrid, selectedShip, row, col, orientation);
        setLocalPlacementGrid(newGrid);
        setSelectedShip(null);
    };

    const confirmPlacement = async () => {
        if (!hasPlacedAllShips(localPlacementGrid)) {
            alert('Place all 5 ships before confirming!');
            return;
        }

        try {
            const updatedPlayers = { ...game.players };
            updatedPlayers[myId] = {
                ...myData,
                grid: JSON.stringify(localPlacementGrid),
                attackGrid: JSON.stringify(createEmptyGrid()),
                ready: true,
                shipsRemaining: 5
            };

            const bothReady = updatedPlayers[opponentId]?.ready && updatedPlayers[myId].ready;

            await updateDoc(gameRef, {
                players: updatedPlayers,
                phase: bothReady ? 'battle' : 'placing',
                currentTurn: bothReady ? (game.createdBy || myId) : game.currentTurn
            });

            if (bothReady) {
                alert('Both players ready! Battle begins!');
            } else {
                alert('Ships placed! Waiting for opponent...');
            }
        } catch (err) {
            console.error('Confirm placement error:', err);
            alert('Failed to confirm placement.');
        }
    };

    const handleAttack = async (row, col) => {
        if (phase !== 'battle' || !isMyTurn) return;

        // Parse opponent grid with validation
        const opponentGrid = (() => {
            try {
                const parsed = JSON.parse(opponentData.grid || '[]');
                if (!Array.isArray(parsed) || parsed.length !== 10) {
                    console.error('Invalid opponent grid, expected 10x10:', parsed?.length);
                    return createEmptyGrid();
                }
                return parsed;
            } catch (e) {
                console.error('Failed to parse opponent grid:', e);
                return createEmptyGrid();
            }
        })();

        // Parse my attack grid with validation
        const myAttackGrid = (() => {
            try {
                const parsed = JSON.parse(myData.attackGrid || '[]');
                if (!Array.isArray(parsed) || parsed.length !== 10) {
                    console.log('Invalid attack grid, initializing empty:', parsed?.length);
                    return createEmptyGrid();
                }
                return parsed;
            } catch (e) {
                console.error('Failed to parse attack grid:', e);
                return createEmptyGrid();
            }
        })();

        if (myAttackGrid[row][col] !== null) {
            alert('Already attacked this cell!');
            return;
        }

        const { result, shipType, newGrid } = processAttack(opponentGrid, row, col);
        myAttackGrid[row][col] = (result === 'hit' || result === 'sunk') ? { hit: true } : 'miss';

        const opponentAllSunk = checkAllShipsSunk(newGrid);

        let alertMsg = result === 'miss' ? '💨 Miss!' : result === 'sunk' ? `💥 You sunk their ${SHIPS[shipType].name}!` : '💥 Hit!';

        const updates = {
            [`players.${opponentId}.grid`]: JSON.stringify(newGrid),
            [`players.${myId}.attackGrid`]: JSON.stringify(myAttackGrid),
            [`players.${opponentId}.shipsRemaining`]: countRemainingShips(newGrid)
        };

        try {
            if (opponentAllSunk) {
                updates.phase = 'ended';
                updates.winner = myId;
                updates.currentTurn = null;

                await updateDoc(gameRef, updates);

                // Add to history
                // Add to history
                const historyRef = collection(db, isFamilyGame ? 'families' : 'couples', coupleCode.toLowerCase(), isFamilyGame ? 'family_game_history' : 'game_history');
                await addDoc(historyRef, {
                    type: 'battleship',
                    winner: myId,
                    winnerName: myData.name || (myId === 'his' ? husbandName : wifeName),
                    loser: opponentId,
                    loserName: opponentData.name || (opponentId === 'his' ? husbandName : wifeName),
                    result: 'victory',
                    wager: game.wager || '',
                    hisScore: myId === 'his' ? (10 - countRemainingShips(newGrid)) : (10 - myData.shipsRemaining), // Hit count approximates score
                    hersScore: myId === 'hers' ? (10 - countRemainingShips(newGrid)) : (10 - myData.shipsRemaining),
                    completedAt: serverTimestamp()
                });

                alert('🎉 You won! All enemy ships destroyed!');
            } else {
                updates.currentTurn = opponentId;
                await updateDoc(gameRef, updates);
                alert(alertMsg);
            }

            if (sendNotification) {
                sendNotification(
                    opponentAllSunk ? 'Game Over!' : "Your turn!",
                    opponentAllSunk ? 'You lost the Battleship game!' : `Your opponent ${result === 'sunk' ? 'sunk your ship!' : result === 'hit' ? 'hit your ship!' : 'missed!'}`,
                    'games'
                );
            }
        } catch (err) {
            console.error('Attack error:', err);
            alert('Failed to attack.');
        }
    };

    // --- UI Helpers ---
    // Grid rendering moved to BattleshipGrid component

    if (phase === 'placing') {
        if (myData.ready) {
            return (
                <div className="p-4 text-center space-y-4 animate-in fade-in">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                        <span className="text-3xl">📡</span>
                    </div>
                    <p className="font-black text-slate-700 text-lg">Fleet Deployed!</p>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Waiting for {opponentData.name || 'opponent'}...</p>
                    <div className="opacity-75 scale-95 origin-top">
                        <BattleshipGrid grid={localPlacementGrid} showShips={true} isInteractive={false} />
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4 animate-in slide-in-from-bottom-4">
                <div className="text-center">
                    <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Phase 1: Deployment</p>
                    <h3 className="text-xl font-black text-slate-800">Place Your Fleet</h3>
                    <p className="text-[10px] text-slate-400">Select a ship and tap the grid</p>
                </div>

                <BattleshipGrid grid={localPlacementGrid} onClick={handlePlacementClick} showShips={true} isInteractive={true} />

                <div className="flex flex-wrap gap-2 justify-center p-2 bg-slate-50 rounded-2xl border border-slate-100">
                    {Object.entries(SHIPS).map(([type, ship]) => {
                        const isPlaced = localPlacementGrid.flat().some(c => c?.ship === type);
                        return (
                            <button
                                key={type}
                                onClick={() => !isPlaced && setSelectedShip(type)}
                                disabled={isPlaced}
                                className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-2
                                    ${selectedShip === type ? 'bg-blue-600 text-white border-blue-500 shadow-lg scale-105' : 'bg-white text-slate-600 border-slate-200'}
                                    ${isPlaced ? 'opacity-40 bg-slate-100 grayscale' : ''}
                                `}
                            >
                                <span className="text-base">{ship.emoji}</span>
                                {ship.name}
                            </button>
                        );
                    })}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')}
                        className="flex-1 py-3 bg-blue-50 text-blue-600 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                    >
                        🔄 Rotate: {orientation}
                    </button>
                    <button
                        onClick={confirmPlacement}
                        className="flex-1 py-3 bg-green-500 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        ✓ Ready for Battle
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'battle') {
        // Safely parse grids with validation
        const myAttackGrid = (() => {
            try {
                const parsed = JSON.parse(myData.attackGrid || '[]');
                if (!Array.isArray(parsed) || parsed.length !== 10) {
                    console.log('Battle view: Invalid attack grid, using empty');
                    return createEmptyGrid();
                }
                return parsed;
            } catch (e) {
                console.error('Battle view: Failed to parse attack grid:', e);
                return createEmptyGrid();
            }
        })();

        const myGrid = (() => {
            try {
                const parsed = JSON.parse(myData.grid || '[]');
                if (!Array.isArray(parsed) || parsed.length !== 10) {
                    console.log('Battle view: Invalid my grid, using empty');
                    return createEmptyGrid();
                }
                // Debug: Log hit count on my grid
                const hitCount = parsed.flat().filter(c => c && c.hit).length;
                console.log('My Fleet hit count:', hitCount);
                return parsed;
            } catch (e) {
                console.error('Battle view: Failed to parse my grid:', e);
                return createEmptyGrid();
            }
        })();

        return (
            <div className="space-y-4 animate-in fade-in">
                {/* Scoreboard */}
                <div className="grid grid-cols-2 gap-4">
                    <div className={`p-3 rounded-2xl text-center border-2 transition-all ${isMyTurn ? 'bg-green-50 border-green-200 scale-105 shadow-md' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                        <p className="text-[9px] font-black text-slate-400 uppercase">MY FLEET</p>
                        <p className={`text-2xl font-black ${myData.shipsRemaining < 3 ? 'text-red-500' : 'text-slate-700'}`}>{myData.shipsRemaining}</p>
                    </div>
                    <div className={`p-3 rounded-2xl text-center border-2 transition-all ${!isMyTurn ? 'bg-red-50 border-red-200 scale-105 shadow-md' : 'bg-slate-50 border-slate-100 opacity-70'}`}>
                        <p className="text-[9px] font-black text-red-400 uppercase">ENEMY FLEET</p>
                        <p className="text-2xl font-black text-red-700">{opponentData.shipsRemaining}</p>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex p-1 bg-slate-100 rounded-xl">
                    <button
                        onClick={() => setViewMode('attack')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'attack' ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        🎯 Attack Radar
                    </button>
                    <button
                        onClick={() => setViewMode('fleet')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'fleet' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        🛡️ My Fleet
                    </button>
                </div>

                {/* Main Battle View */}
                <div className="relative">
                    {/* Turn Indicator Overlay */}
                    {isMyTurn && viewMode === 'attack' && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg z-20 animate-bounce">
                            YOUR TURN TO FIRE!
                        </div>
                    )}

                    {viewMode === 'attack' ? (
                        <div className="space-y-2 animate-in slide-in-from-left-4 duration-300">
                            <div className="text-center space-y-1">
                                <p className="text-xs font-black text-red-500 uppercase tracking-widest">Enemy Waters</p>
                                <p className="text-[9px] text-slate-400">Tap a blue square to fire torpedo</p>
                            </div>
                            <BattleshipGrid grid={myAttackGrid} onClick={handleAttack} showShips={false} isInteractive={isMyTurn} />
                        </div>
                    ) : (
                        <div className="space-y-2 animate-in slide-in-from-right-4 duration-300">
                            <div className="text-center space-y-1">
                                <p className="text-xs font-black text-blue-500 uppercase tracking-widest">My Fleet Status</p>
                                <p className="text-[9px] text-slate-400">Review damage report</p>
                            </div>
                            <BattleshipGrid grid={myGrid} showShips={true} isInteractive={false} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="text-center py-12 space-y-6 animate-in zoom-in-50">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl shadow-inner">
                {game.winner === myId ? '🏆' : '🏳️'}
            </div>
            <div>
                <h2 className="text-3xl font-black text-slate-800 italic uppercase">{game.winner === myId ? 'VICTORY!' : 'DEFEAT'}</h2>
                <p className="text-sm text-slate-500 font-bold mt-2">
                    {game.winner === myId ? 'You ruled the high seas!' : 'Your fleet has been sunk.'}
                </p>
            </div>
            <button onClick={() => updateDoc(gameRef, { phase: 'active' })} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:scale-105 transition-all">
                Return to Lobby
            </button>
        </div>
    );
};

export default Battleship;
