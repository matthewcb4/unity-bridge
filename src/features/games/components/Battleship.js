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
    // Local state for placement phase
    const [localPlacementGrid, setLocalPlacementGrid] = useState(createEmptyGrid());
    const [selectedShip, setSelectedShip] = useState(null);
    const [orientation, setOrientation] = useState('horizontal');

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

        try {
            const opponentGrid = JSON.parse(opponentData.grid);
            const myAttackGrid = JSON.parse(myData.attackGrid || '[]');

            if (myAttackGrid[row][col] !== null) {
                alert('Already attacked this cell!');
                return;
            }

            const { result, shipType, newGrid } = processAttack(opponentGrid, row, col);
            myAttackGrid[row][col] = (result === 'hit' || result === 'sunk') ? { hit: true } : 'miss';

            const updatedPlayers = { ...game.players };
            updatedPlayers[opponentId].grid = JSON.stringify(newGrid);
            updatedPlayers[myId].attackGrid = JSON.stringify(myAttackGrid);

            const opponentAllSunk = checkAllShipsSunk(newGrid);
            updatedPlayers[opponentId].shipsRemaining = countRemainingShips(newGrid);

            let alertMsg = result === 'miss' ? '💨 Miss!' : result === 'sunk' ? `💥 You sunk their ${SHIPS[shipType].name}!` : '💥 Hit!';

            if (opponentAllSunk) {
                await updateDoc(gameRef, {
                    players: updatedPlayers,
                    phase: 'ended',
                    winner: myId,
                    currentTurn: null
                });

                // Add to history
                const historyRef = collection(db, isFamilyGame ? 'families' : 'couples', coupleCode.toLowerCase(), isFamilyGame ? 'family_game_history' : 'games/history/items');
                await addDoc(historyRef, {
                    type: 'battleship',
                    word: 'Battleship Victory',
                    solvedBy: myId,
                    solverName: myData.name || (myId === 'his' ? husbandName : wifeName),
                    points: 50,
                    completedAt: serverTimestamp(),
                    wager: game.wager || ''
                });

                alert('🎉 You won! All enemy ships destroyed!');
            } else {
                await updateDoc(gameRef, {
                    players: updatedPlayers,
                    currentTurn: opponentId
                });
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
    const renderGrid = (grid, onClick, showShips = true) => (
        <div className="grid grid-cols-10 gap-0.5 bg-slate-800 p-1 rounded-lg">
            {grid.map((r, rowIdx) => r.map((cell, colIdx) => {
                const display = getAttackDisplay(cell);
                const isShip = cell && cell.ship && showShips;
                return (
                    <div
                        key={`${rowIdx}-${colIdx}`}
                        onClick={() => onClick && onClick(rowIdx, colIdx)}
                        className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs rounded-sm cursor-pointer transition-all
                            ${isShip ? 'bg-slate-600 border border-slate-500' : 'bg-slate-700'}
                            ${display === '⚪' ? 'bg-slate-800' : ''}
                            ${display === '💥' ? 'bg-red-900 animate-pulse' : ''}
                            hover:bg-slate-500
                        `}
                    >
                        {display || (isShip ? SHIPS[cell.ship].emoji : '')}
                    </div>
                );
            }))}
        </div>
    );

    if (phase === 'placing') {
        if (myData.ready) {
            return (
                <div className="p-4 text-center space-y-4">
                    <p className="font-bold text-slate-500">Ships placed! Waiting for {opponentData.name || 'opponent'}...</p>
                    {renderGrid(localPlacementGrid, null)}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="text-center">
                    <p className="text-xs font-bold text-purple-600">PLACE YOUR SHIPS</p>
                    <p className="text-[10px] text-slate-400">Select a ship and tap the grid</p>
                </div>

                {renderGrid(localPlacementGrid, handlePlacementClick)}

                <div className="flex flex-wrap gap-2 justify-center">
                    {Object.entries(SHIPS).map(([type, ship]) => {
                        const isPlaced = localPlacementGrid.flat().some(c => c?.ship === type);
                        return (
                            <button
                                key={type}
                                onClick={() => !isPlaced && setSelectedShip(type)}
                                disabled={isPlaced}
                                className={`px-3 py-2 rounded-xl text-[10px] font-bold border transition-all
                                    ${selectedShip === type ? 'bg-purple-600 text-white border-purple-500' : 'bg-white text-slate-600 border-slate-200'}
                                    ${isPlaced ? 'opacity-30 bg-slate-100' : ''}
                                `}
                            >
                                {ship.emoji} {ship.name} ({ship.size})
                            </button>
                        );
                    })}
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')}
                        className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs"
                    >
                        🔄 {orientation.toUpperCase()}
                    </button>
                    <button
                        onClick={confirmPlacement}
                        className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl text-xs shadow-lg"
                    >
                        ✓ Ready to Battle
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'battle') {
        const myAttackGrid = JSON.parse(myData.attackGrid || '[]');
        const myGrid = JSON.parse(myData.grid || '[]');

        return (
            <div className="space-y-6">
                <div className="space-y-2">
                    <p className="text-center text-[10px] font-black text-red-500 uppercase">Enemy Territory (Attack Here)</p>
                    {renderGrid(myAttackGrid, handleAttack, false)}
                </div>

                <div className="space-y-2">
                    <p className="text-center text-[10px] font-black text-slate-400 uppercase">My Fleet</p>
                    <div className="opacity-80 scale-90">
                        {renderGrid(myGrid, null)}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl text-center">
                        <p className="text-[9px] font-bold text-slate-400">MY SHIPS</p>
                        <p className="text-xl font-black text-slate-700">{myData.shipsRemaining || 0}</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-xl text-center">
                        <p className="text-[9px] font-bold text-red-400">ENEMY SHIPS</p>
                        <p className="text-xl font-black text-red-700">{opponentData.shipsRemaining || 0}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="text-center py-10">
            <p className="text-slate-400">Game Over: {game.winner === myId ? 'Victory!' : 'Defeat'}</p>
            <button onClick={() => updateDoc(gameRef, { phase: 'active' })} className="mt-4 text-xs font-bold text-purple-600 underline">Back</button>
        </div>
    );
};

export default Battleship;
