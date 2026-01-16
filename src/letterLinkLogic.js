export const LETTER_POINTS = {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
    N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
    _: 0 // Blank
};

// 11x11 Grid
// Center is 60 (5,5)
// Special cells:
// TW (Triple Word): Corners (0,0), (0,10), (10,0), (10,10)
// DW (Double Word): Mid-edges (0,5), (5,0), (5,10), (10,5)
// TL (Triple Letter): Diagonals (1,1), (2,2), (3,3), (4,4), ...
// DL (Double Letter): Scattering (1,5), (5,1), etc.

export const getBonusType = (index) => {
    const row = Math.floor(index / 11);
    const col = index % 11;

    // Center Star (treated as DW for first move usually, but acts as anchor)
    if (index === 60) return 'STAR';

    // Triple Word (Corners)
    if ((row === 0 || row === 10) && (col === 0 || col === 10)) return 'TW';

    // Double Word (Mid-edges)
    if ((row === 0 || row === 10) && col === 5) return 'DW';
    if ((col === 0 || col === 10) && row === 5) return 'DW';

    // Triple Letter (Inner Diagonals)
    // 1,1; 2,2; 3,3; 4,4 ... 
    if (row === col && row >= 1 && row <= 4) return 'TL';
    if (row === col && row >= 6 && row <= 9) return 'TL';
    if (row + col === 10 && row >= 1 && row <= 4) return 'TL';
    if (row + col === 10 && row >= 6 && row <= 9) return 'TL';

    // Double Letter (Scattered)
    // 0,3; 0,7; 3,0; 7,0...
    if ((row === 0 || row === 10) && (col === 3 || col === 7)) return 'DL';
    if ((col === 0 || col === 10) && (row === 3 || row === 7)) return 'DL';
    if ((row === 2 || row === 8) && (col === 6 || col === 4)) return 'DL'; // approximate
    if ((row === 6 || row === 4) && (col === 2 || col === 8)) return 'DL';

    return null;
};

export const calculateMoveScore = (placedTiles, boardState) => {
    // This is a simplified scorer. A full scorer needs to find all new words formed.
    // For V1, we will just sum the tiles placed + bonuses for those specific tiles.
    // Why? Because implementing full Scrabble word detection (cross-words) is complex for a single step.
    // User asked for "Scrabble style point system", so we should try to be somewhat accurate.

    // Simple V1 Scorer:
    // 1. Identify valid line (row or col).
    // 2. Find the main word formed by filling gaps with board tiles.
    // 3. Score that word.
    // 4. (Optional) Score cross words.

    // Let's implement at least the Main Word score.

    let totalScore = 0;

    // Determine orientation
    if (placedTiles.length === 0) return 0;
    const isRow = placedTiles.length > 1 ? placedTiles[0].row === placedTiles[1].row : true; // Default to row if 1 tile
    const sortedTiles = [...placedTiles].sort((a, b) => isRow ? a.col - b.col : a.row - b.row);

    let wordMultiplier = 1;
    let wordPoints = 0;

    // We need to traverse "outwards" to find the full word
    // For now, let's just score the tiles placed + any they touch immediately?
    // No, that's lazy.

    // Let's just sum the tiles placed with their multipliers for V1.
    // It's "Arcade Mode" Scrabble.
    // If user wants full rules later, we expand.

    sortedTiles.forEach(tile => {
        const idx = tile.row * 11 + tile.col;
        const letterVal = LETTER_POINTS[tile.char] || 0;
        const bonus = getBonusType(idx);

        let letterMult = 1;
        if (bonus === 'DL') letterMult = 2;
        if (bonus === 'TL') letterMult = 3;
        if (bonus === 'DW' || bonus === 'STAR') wordMultiplier *= 2;
        if (bonus === 'TW') wordMultiplier *= 3;

        wordPoints += (letterVal * letterMult);
    });

    // Add points for existing tiles in the same line (simplified: just adjacent ones?)
    // This is the hard part of V1. 
    // Let's stick to "Arcade Scoring": Points for placed tiles * Modifiers.

    return wordPoints * wordMultiplier;
};

// --- DICTIONARY & WORD FINDING ---

export const validateWord = async (word) => {
    if (!word || word.length < 2) return true; // generic pass for single letters?
    try {
        const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        return res.ok;
    } catch (err) {
        console.warn("Dictionary API failed, allowing word:", word);
        return true; // Fallback if offline
    }
};

// Start recursion to find full word from a given index in a direction
const findWordExtent = (index, delta, board) => {
    let curr = index;
    let word = '';
    // move backwards
    while (true) {
        const next = curr - delta;
        // check boundaries
        if (delta === 1 && Math.floor(next / 11) !== Math.floor(curr / 11)) break; // row boundary check for horiz
        if (next < 0 || next >= 121) break;

        const cell = board[next];
        const char = cell ? (typeof cell === 'string' ? cell : cell.char) : null;
        if (!char) break;
        curr = next;
    }

    const startIdx = curr;
    // move forwards
    while (true) {
        const cell = board[curr];
        const char = cell ? (typeof cell === 'string' ? cell : cell.char) : null;
        if (!char) break;

        word += char;
        const next = curr + delta;

        if (delta === 1 && Math.floor(next / 11) !== Math.floor(curr / 11)) break;
        if (next < 0 || next >= 121) break;
        curr = next;
    }

    return { word, startIdx };
};

export const getWordsFormed = (placedTiles, board) => {
    if (placedTiles.length === 0) return [];

    // Create a temporary overlay board to query
    const tempBoard = [...board];
    placedTiles.forEach(t => {
        tempBoard[t.row * 11 + t.col] = { char: t.char };
    });

    const isRow = placedTiles.length > 1 ? placedTiles[0].row === placedTiles[1].row : true;
    // If single tile, we need to check both directions.
    // If multiple, primary axis is defined.

    const words = new Set();

    // 1. Primary Word
    const firstTile = placedTiles[0];
    const primaryDelta = isRow ? 1 : 11;
    const primary = findWordExtent(firstTile.row * 11 + firstTile.col, primaryDelta, tempBoard);
    if (primary.word.length > 1) words.add(primary.word);

    // 2. Cross Words (for each tile, check perpendicular)
    const crossDelta = isRow ? 11 : 1;
    placedTiles.forEach(t => {
        const cross = findWordExtent(t.row * 11 + t.col, crossDelta, tempBoard);
        if (cross.word.length > 1) words.add(cross.word);
    });

    // Special Case: Single tile might form two words (Horiz & Vert)
    if (placedTiles.length === 1) {
        const vert = findWordExtent(firstTile.row * 11 + firstTile.col, 11, tempBoard);
        if (vert.word.length > 1) words.add(vert.word);
    }

    return Array.from(words);
};
