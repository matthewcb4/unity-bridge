import React, { useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';

const DotsAndBoxes = ({ game, gameRef, role, db, coupleCode, darkMode }) => {
    // Game properties via 'game' prop:
    // game.gridSize (e.g. 4 for 4x4 dots = 3x3 boxes)
    // game.lines: { "h-0-0": "p1", "v-0-0": "p2" } 
    //   h-row-col (horizontal line to right of dot row,col)
    //   v-row-col (vertical line below dot row,col)
    // game.boxes: { "0-0": "p1" } // owner of box at row,col
    // game.scores: { p1: 0, p2: 0 }

    // role is 'his', 'hers', or 'kid_ID'. game.currentTurn is same format.
    const myId = role;
    const isMyTurn = game.currentTurn === myId;
    const size = game.gridSize || 4;

    // Helper to check if a move completes any boxes
    const checkForCompletedBoxes = (lines, r, c, type) => {
        const newBoxes = {};
        let madeBox = false;

        // If placed horizontal line at r,c (connects r,c to r,c+1)
        if (type === 'h') {
            // Check box BELOW (r, c) -> needs h-r-c, v-r-c, v-r-c+1, h-r+1-c
            if (r < size - 1) {
                if (lines[`v-${r}-${c}`] && lines[`v-${r}-${c + 1}`] && lines[`h-${r + 1}-${c}`]) {
                    newBoxes[`${r}-${c}`] = myId;
                    madeBox = true;
                }
            }
            // Check box ABOVE (r-1, c) -> needs h-r-1-c, v-r-1-c, v-r-1-c+1, h-r-c
            if (r > 0) {
                if (lines[`h-${r - 1}-${c}`] && lines[`v-${r - 1}-${c}`] && lines[`v-${r - 1}-${c + 1}`]) {
                    newBoxes[`${r - 1}-${c}`] = myId;
                    madeBox = true;
                }
            }
        }
        // If placed vertical line at r,c (connects r,c to r+1,c)
        else {
            // Check box RIGHT (r, c) -> needs v-r-c, h-r-c, h-r+1-c, v-r-c+1
            if (c < size - 1) {
                if (lines[`h-${r}-${c}`] && lines[`h-${r + 1}-${c}`] && lines[`v-${r}-${c + 1}`]) {
                    newBoxes[`${r}-${c}`] = myId;
                    madeBox = true;
                }
            }
            // Check box LEFT (r, c-1) -> needs v-r-c-1, h-r-c-1, h-r+1-c-1, v-r-c
            if (c > 0) {
                if (lines[`v-${r}-${c - 1}`] && lines[`h-${r}-${c - 1}`] && lines[`h-${r + 1}-${c - 1}`]) {
                    newBoxes[`${r}-${c - 1}`] = myId;
                    madeBox = true;
                }
            }
        }
        return { madeBox, newBoxes };
    };

    const handleLineClick = async (r, c, type) => {
        if (!isMyTurn) return;
        const lineKey = `${type}-${r}-${c}`;
        if (game.lines && game.lines[lineKey]) return; // Already taken

        // Optimistic update logic
        const newLines = { ...(game.lines || {}), [lineKey]: myId };
        const { madeBox, newBoxes } = checkForCompletedBoxes(newLines, r, c, type);

        const updates = {
            lines: newLines
        };

        if (madeBox) {
            // Updated boxes and scores
            const finalBoxes = { ...(game.boxes || {}), ...newBoxes };
            const p1Score = Object.values(finalBoxes).filter(id => id === game.createdBy).length;
            const p2Score = Object.values(finalBoxes).filter(id => id === game.opponentId).length;

            updates.boxes = finalBoxes;
            updates[`players.${game.createdBy}.score`] = p1Score;
            updates[`players.${game.opponentId}.score`] = p2Score;
            // Turn does NOT change if you make a box

            // Check for game over
            const totalBoxes = (size - 1) * (size - 1);
            if (p1Score + p2Score >= totalBoxes) {
                // Game Over
                const winnerId = p1Score > p2Score ? game.createdBy : (p2Score > p1Score ? game.opponentId : 'tie');
                // You would handle game over logic (deleting/archiving) in parent or here
                // For now just update scores and maybe a 'winner' field if your schema supports it
            }

        } else {
            // No box made, switch turn
            updates.currentTurn = myId === game.createdBy ? game.opponentId : game.createdBy;
        }

        await updateDoc(gameRef, updates);
    };

    // Render Grid
    // We need a grid of DOTS (size x size)
    // Between dots horizontally are H-lines (size x size-1)
    // Between dots vertically are V-lines (size-1 x size)
    // Inside are Boxes (size-1 x size-1)

    const renderGrid = () => {
        const grid = [];
        const boxSize = 40; // px

        for (let r = 0; r < size; r++) {
            const rowItems = [];
            // Row of dots and h-lines
            for (let c = 0; c < size; c++) {
                // DOT
                rowItems.push(
                    <div key={`dot-${r}-${c}`} className="w-3 h-3 bg-slate-800 rounded-full z-10" />
                );

                // H-LINE (if not last col)
                if (c < size - 1) {
                    const hKey = `h-${r}-${c}`;
                    const owner = game.lines?.[hKey];
                    rowItems.push(
                        <div
                            key={hKey}
                            onClick={() => handleLineClick(r, c, 'h')}
                            className={`w-[40px] h-3 cursor-pointer transition-colors ${owner
                                    ? (owner === myId ? 'bg-blue-500' : 'bg-purple-500')
                                    : 'bg-slate-100 hover:bg-slate-300'
                                }`}
                        />
                    );
                }
            }
            grid.push(<div key={`row-${r}`} className="flex items-center justify-center">{rowItems}</div>);

            // Row of v-lines and boxes (if not last row)
            if (r < size - 1) {
                const rowItemsLinks = [];
                for (let c = 0; c < size; c++) {
                    // V-LINE
                    const vKey = `v-${r}-${c}`;
                    const owner = game.lines?.[vKey];
                    rowItemsLinks.push(
                        <div
                            key={vKey}
                            onClick={() => handleLineClick(r, c, 'v')}
                            className={`w-3 h-[40px] cursor-pointer transition-colors ${owner
                                    ? (owner === myId ? 'bg-blue-500' : 'bg-purple-500')
                                    : 'bg-slate-100 hover:bg-slate-300'
                                }`}
                        />
                    );

                    // BOX (if not last col)
                    if (c < size - 1) {
                        const boxKey = `${r}-${c}`;
                        const boxOwner = game.boxes?.[boxKey];
                        rowItemsLinks.push(
                            <div
                                key={`box-${boxKey}`}
                                className={`w-[40px] h-[40px] flex items-center justify-center text-xl font-bold transition-all duration-500 ${boxOwner ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                                    }`}
                            >
                                {boxOwner === game.createdBy ? '🔵' : (boxOwner ? '🟣' : '')}
                            </div>
                        );
                    }
                }
                grid.push(<div key={`row-links-${r}`} className="flex items-center justify-center">{rowItemsLinks}</div>);
            }
        }
        return grid;
    };

    return (
        <div className="flex flex-col items-center gap-4 py-4 select-none">
            {/* Scoreboard */}
            <div className="flex justify-between w-full px-4 text-sm font-bold">
                <div className={`flex flex-col items-center ${game.currentTurn === game.createdBy ? 'scale-110 text-blue-600' : 'text-slate-400'}`}>
                    <span className="text-2xl">{game.creatorAvatar}</span>
                    <span>{game.players[game.createdBy]?.score || 0}</span>
                </div>
                <div className="text-xl font-black text-slate-300 tracking-widest">VS</div>
                <div className={`flex flex-col items-center ${game.currentTurn === game.opponentId ? 'scale-110 text-purple-600' : 'text-slate-400'}`}>
                    <span className="text-2xl">{game.opponentAvatar}</span>
                    <span>{game.players[game.opponentId]?.score || 0}</span>
                </div>
            </div>

            {/* Turn Indicator */}
            <div className={`px-4 py-1 rounded-full text-xs font-bold text-white ${isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}>
                {isMyTurn ? "Your Turn!" : "Thinking..."}
            </div>

            {/* Game Grid */}
            <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-slate-100">
                {renderGrid()}
            </div>
        </div>
    );
};

export default DotsAndBoxes;
