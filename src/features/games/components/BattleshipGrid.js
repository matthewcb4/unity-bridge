import React from 'react';
import { SHIPS, getAttackDisplay } from '../../../battleshipLogic';

/**
 * BattleshipGrid - Reusable grid component for Battleship game
 * 
 * @param {Array} grid - 10x10 grid array with cell data
 * @param {Function} onClick - Click handler for cells (row, col)
 * @param {boolean} showShips - Whether to display ships on the grid
 * @param {boolean} isInteractive - Whether cells are clickable
 * @param {string} title - Optional title for the grid
 * @param {boolean} darkMode - Dark mode styling
 */
const BattleshipGrid = ({
    grid,
    onClick = null,
    showShips = true,
    isInteractive = true,
    title = null,
    darkMode = false
}) => {
    if (!grid || !Array.isArray(grid)) {
        return (
            <div className="p-4 text-center text-slate-500">
                <p>No grid data</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {title && (
                <h3 className={`text-xs font-black uppercase tracking-widest text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                    {title}
                </h3>
            )}

            <div className="grid grid-cols-10 gap-0.5 bg-blue-500 p-1 rounded-xl shadow-inner border-4 border-blue-600 relative overflow-hidden">
                {/* Water Effect Overlay */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />

                {grid.map((row, rowIdx) =>
                    row.map((cell, colIdx) => {
                        const display = getAttackDisplay(cell);
                        const isShip = cell && cell.ship && showShips;

                        // Determine cell content:
                        // - Attack Grid: Show hits (💥) and misses (🌊)
                        // - Defense Grid: Show ships (emoji) + hits (💥) + misses (🌊)
                        let cellContent = '';
                        if (display === '💥' || (cell && cell.hit)) {
                            cellContent = '💥';
                        } else if (display === '⚪' || display === 'miss') {
                            cellContent = '🌊';
                        } else if (isShip) {
                            cellContent = SHIPS[cell.ship]?.emoji || '🚢';
                        }

                        return (
                            <div
                                key={`${rowIdx}-${colIdx}`}
                                onClick={() => isInteractive && onClick && onClick(rowIdx, colIdx)}
                                className={`
                                    w-7 h-7 sm:w-8 sm:h-8 
                                    flex items-center justify-center 
                                    text-sm rounded-[2px] 
                                    transition-all duration-300 relative
                                    ${isShip && !display
                                        ? 'bg-slate-600 border border-slate-500'
                                        : 'bg-blue-400/80 border border-blue-300/50'
                                    }
                                    ${display === '⚪' || display === 'miss' ? 'bg-blue-300/50' : ''}
                                    ${display === '💥' || (cell && cell.hit) ? 'bg-red-900/80 animate-pulse' : ''}
                                    ${isInteractive
                                        ? 'cursor-pointer hover:bg-blue-300 hover:scale-105 hover:z-10'
                                        : 'cursor-default'
                                    }
                                `}
                            >
                                {cellContent}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default BattleshipGrid;
