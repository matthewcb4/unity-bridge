// Battleship Game Logic for Unity Bridge
// Classic 10x10 grid with 5 ships

export const SHIPS = {
    carrier: { name: 'Carrier', size: 5, emoji: '🚢' },
    battleship: { name: 'Battleship', size: 4, emoji: '⛴️' },
    cruiser: { name: 'Cruiser', size: 3, emoji: '🛥️' },
    submarine: { name: 'Submarine', size: 3, emoji: '🤿' },
    destroyer: { name: 'Destroyer', size: 2, emoji: '🚤' }
};

export const GRID_SIZE = 10;

// Create empty 10x10 grid
export const createEmptyGrid = () => {
    return Array(GRID_SIZE).fill(null).map(() => 
        Array(GRID_SIZE).fill(null)
    );
};

// Check if ship placement is valid
export const isValidPlacement = (grid, shipType, startRow, startCol, orientation) => {
    const ship = SHIPS[shipType];
    if (!ship) return false;

    for (let i = 0; i < ship.size; i++) {
        const row = orientation === 'vertical' ? startRow + i : startRow;
        const col = orientation === 'horizontal' ? startCol + i : startCol;

        // Check bounds
        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
            return false;
        }

        // Check if cell is already occupied
        if (grid[row][col] !== null) {
            return false;
        }
    }

    return true;
};

// Place ship on grid (returns new grid)
export const placeShipOnGrid = (grid, shipType, startRow, startCol, orientation) => {
    const ship = SHIPS[shipType];
    if (!ship) return grid;

    const newGrid = grid.map(row => [...row]);

    for (let i = 0; i < ship.size; i++) {
        const row = orientation === 'vertical' ? startRow + i : startRow;
        const col = orientation === 'horizontal' ? startCol + i : startCol;
        newGrid[row][col] = { ship: shipType, hit: false };
    }

    return newGrid;
};

// Process an attack, returns { result: 'hit'|'miss'|'sunk', shipType?, newGrid }
export const processAttack = (grid, row, col) => {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return { result: 'invalid', newGrid: grid };
    }

    const cell = grid[row][col];
    const newGrid = grid.map(r => r.map(c => c ? { ...c } : c));

    // Already attacked this cell
    if (cell && cell.hit) {
        return { result: 'already_hit', newGrid: grid };
    }
    if (cell === 'miss') {
        return { result: 'already_hit', newGrid: grid };
    }

    // Miss - empty cell
    if (cell === null) {
        newGrid[row][col] = 'miss';
        return { result: 'miss', newGrid };
    }

    // Hit - ship cell
    newGrid[row][col] = { ...cell, hit: true };

    // Check if ship is sunk
    const shipType = cell.ship;
    let isSunk = true;
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const checkCell = newGrid[r][c];
            if (checkCell && checkCell.ship === shipType && !checkCell.hit) {
                isSunk = false;
                break;
            }
        }
        if (!isSunk) break;
    }

    return {
        result: isSunk ? 'sunk' : 'hit',
        shipType: shipType,
        newGrid
    };
};

// Check if all ships are sunk (game over)
export const checkAllShipsSunk = (grid) => {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = grid[r][c];
            if (cell && cell.ship && !cell.hit) {
                return false;
            }
        }
    }
    return true;
};

// Count remaining ships
export const countRemainingShips = (grid) => {
    const shipStatus = {};
    Object.keys(SHIPS).forEach(type => {
        shipStatus[type] = { total: 0, hits: 0 };
    });

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = grid[r][c];
            if (cell && cell.ship) {
                shipStatus[cell.ship].total++;
                if (cell.hit) shipStatus[cell.ship].hits++;
            }
        }
    }

    let remaining = 0;
    Object.keys(shipStatus).forEach(type => {
        const s = shipStatus[type];
        if (s.total > 0 && s.hits < s.total) {
            remaining++;
        }
    });

    return remaining;
};

// Get attack display for a cell (for opponent's view)
export const getAttackDisplay = (cell) => {
    if (cell === null) return null; // Not attacked
    if (cell === 'miss') return '⚪'; // Miss
    if (cell && cell.hit) return '💥'; // Hit
    return null; // Ship not yet attacked (hidden)
};

// Check if player has placed all ships
export const hasPlacedAllShips = (grid) => {
    const placedCells = {};
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = grid[r][c];
            if (cell && cell.ship) {
                placedCells[cell.ship] = (placedCells[cell.ship] || 0) + 1;
            }
        }
    }

    // Check all ships are placed with correct sizes
    for (const [type, ship] of Object.entries(SHIPS)) {
        if ((placedCells[type] || 0) !== ship.size) {
            return false;
        }
    }

    return true;
};
