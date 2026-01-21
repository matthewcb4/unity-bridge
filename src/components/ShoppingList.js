import React, { useState, useEffect } from 'react';
import {
    ShoppingCart, Plus, Trash2, Check, Camera, Image as ImageIcon,
    Loader2, ExternalLink, ChevronDown, ChevronUp, Package, UtensilsCrossed, AlertCircle
} from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, serverTimestamp, query, orderBy, setDoc, getDoc } from 'firebase/firestore';

const ShoppingList = ({
    db,
    coupleCode,
    darkMode = false,
    userRole,
    userName
}) => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [manualItem, setManualItem] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    // Gemini API Key (you can move this to env or config)
    const apiKey = "AIzaSyBl1PGRTx8IO420pg04LVVv20Fqw7F2LNE";

    // Listen to shopping list from Firestore
    useEffect(() => {
        if (!db || !coupleCode) return;

        const docRef = doc(db, 'families', coupleCode.toLowerCase(), 'shopping', 'currentList');
        const unsub = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setGroups(data.groups || []);
            } else {
                setGroups([]);
            }
            setLoading(false);
        }, (err) => {
            console.error('Shopping list error:', err);
            setLoading(false);
        });

        return () => unsub();
    }, [db, coupleCode]);

    const saveGroups = async (updatedGroups) => {
        if (!db || !coupleCode) return;
        try {
            const docRef = doc(db, 'families', coupleCode.toLowerCase(), 'shopping', 'currentList');
            await setDoc(docRef, {
                groups: updatedGroups,
                lastUpdated: Date.now(),
                updatedBy: userName
            });
        } catch (err) {
            console.error('Save Error:', err);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            processImage(base64);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const processImage = async (base64Image) => {
        setIsProcessing(true);
        setError(null);

        const systemPrompt = `
            Extract items from the shopping list image. 
            1. Group items by meal if specified.
            2. If a meal name is found, suggest 4 essential ingredients.
            3. Put all other items into a group called "Uncategorized".
            
            Output ONLY valid JSON:
            {
                "groups": [
                    { "mealName": "Name", "ingredients": ["ing1", "ing2"] }
                ]
            }
        `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: systemPrompt },
                            { inlineData: { mimeType: "image/png", data: base64Image } }
                        ]
                    }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Could not read text");

            const result = JSON.parse(text);
            const newGroupsState = [...groups];

            result.groups.forEach(newGroup => {
                const existingGroup = newGroupsState.find(g => g.mealName.toLowerCase() === newGroup.mealName.toLowerCase());
                if (existingGroup) {
                    newGroup.ingredients.forEach(ingName => {
                        if (!existingGroup.ingredients.find(i => i.name.toLowerCase() === ingName.toLowerCase())) {
                            existingGroup.ingredients.push({ name: ingName, completed: false, addedBy: userName });
                        }
                    });
                } else {
                    newGroupsState.push({
                        mealName: newGroup.mealName,
                        expanded: true,
                        ingredients: newGroup.ingredients.map(ing => ({ name: ing, completed: false, addedBy: userName }))
                    });
                }
            });

            setGroups(newGroupsState);
            saveGroups(newGroupsState);
        } catch (err) {
            console.error('AI Error:', err);
            setError("AI failed to read image. Please ensure the text is clear.");
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleComplete = (gIdx, iIdx) => {
        const updated = [...groups];
        updated[gIdx].ingredients[iIdx].completed = !updated[gIdx].ingredients[iIdx].completed;
        if (updated[gIdx].ingredients[iIdx].completed) {
            updated[gIdx].ingredients[iIdx].completedBy = userName;
        }
        setGroups(updated);
        saveGroups(updated);
    };

    const toggleGroup = (idx) => {
        const updated = [...groups];
        updated[idx].expanded = !updated[idx].expanded;
        setGroups(updated);
    };

    const openWalmart = (query) => {
        window.open(`https://www.walmart.com/search?q=${encodeURIComponent(query)}`, '_blank');
    };

    const addManual = (e) => {
        e.preventDefault();
        if (!manualItem.trim()) return;

        const updated = [...groups];
        let uncat = updated.find(g => g.mealName === "Uncategorized");
        if (!uncat) {
            uncat = { mealName: "Uncategorized", expanded: true, ingredients: [] };
            updated.push(uncat);
        }
        uncat.ingredients.push({ name: manualItem.trim(), completed: false, addedBy: userName });
        setGroups(updated);
        saveGroups(updated);
        setManualItem("");
    };

    const deleteItem = (gIdx, iIdx) => {
        const updated = [...groups];
        updated[gIdx].ingredients.splice(iIdx, 1);
        // Remove empty groups
        if (updated[gIdx].ingredients.length === 0) {
            updated.splice(gIdx, 1);
        }
        setGroups(updated);
        saveGroups(updated);
    };

    const clearCompleted = () => {
        const updated = groups.map(g => ({
            ...g,
            ingredients: g.ingredients.filter(i => !i.completed)
        })).filter(g => g.ingredients.length > 0);
        setGroups(updated);
        saveGroups(updated);
    };

    const clearAll = () => {
        setGroups([]);
        saveGroups([]);
    };

    const totalItems = groups.reduce((acc, g) => acc + g.ingredients.length, 0);
    const completedCount = groups.reduce((acc, g) => acc + g.ingredients.filter(i => i.completed).length, 0);

    return (
        <div className={`rounded-3xl shadow-xl border overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            {/* Header */}
            <div className={`p-4 ${darkMode ? 'bg-slate-700' : 'bg-gradient-to-r from-green-500 to-emerald-600'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-black">Cart Mate</h3>
                            <p className="text-white/70 text-[10px]">{totalItems} items · {completedCount} done</p>
                        </div>
                    </div>
                    {totalItems > 0 && (
                        <button onClick={clearAll} className="text-white/60 hover:text-white text-xs font-bold">
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Processing State */}
                {isProcessing && (
                    <div className="bg-blue-500 text-white p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                        <Loader2 className="animate-spin w-5 h-5" />
                        <span className="font-bold text-xs uppercase tracking-wider">Analyzing list...</span>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 flex items-center gap-2 text-xs">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Empty State with Upload Options */}
                {!loading && groups.length === 0 && !isProcessing && (
                    <div className="py-6 flex flex-col items-center text-center space-y-4">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${darkMode ? 'bg-slate-700' : 'bg-green-50'}`}>
                            <ShoppingCart size={28} className={darkMode ? 'text-green-400' : 'text-green-600'} />
                        </div>
                        <div>
                            <p className={`text-sm font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>No items yet</p>
                            <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Snap a photo of your list or add items manually</p>
                        </div>
                    </div>
                )}

                {/* Upload Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all ${darkMode ? 'bg-slate-700 text-green-400' : 'bg-green-500 text-white'
                        }`}>
                        <Camera size={16} />
                        <span>📸 Camera</span>
                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" capture="environment" />
                    </label>
                    <label className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs cursor-pointer active:scale-95 transition-all border ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-white border-green-200 text-green-600'
                        }`}>
                        <ImageIcon size={16} />
                        <span>🖼️ Gallery</span>
                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" />
                    </label>
                </div>

                {/* Manual Add */}
                <form onSubmit={addManual} className="flex gap-2">
                    <input
                        type="text"
                        value={manualItem}
                        onChange={(e) => setManualItem(e.target.value)}
                        placeholder="Add item..."
                        className={`flex-1 p-3 rounded-xl text-sm border outline-none ${darkMode
                            ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400'
                            : 'bg-slate-50 border-slate-200 placeholder-slate-400'}`}
                    />
                    <button
                        type="submit"
                        disabled={!manualItem.trim()}
                        className={`px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 transition-all ${darkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                            }`}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </form>

                {/* Groups List */}
                {!loading && (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {groups.map((group, gIdx) => (
                            <div key={gIdx} className={`rounded-2xl border overflow-hidden ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                {/* Group Header */}
                                <button
                                    onClick={() => toggleGroup(gIdx)}
                                    className={`w-full p-3 flex items-center justify-between text-left ${group.mealName === 'Uncategorized'
                                            ? (darkMode ? 'bg-slate-600' : 'bg-slate-50')
                                            : (darkMode ? 'bg-orange-900/30' : 'bg-orange-50')
                                        }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${group.mealName === 'Uncategorized'
                                                ? (darkMode ? 'bg-slate-500 text-slate-300' : 'bg-white text-slate-400')
                                                : (darkMode ? 'bg-orange-700 text-orange-300' : 'bg-orange-100 text-orange-600')
                                            }`}>
                                            {group.mealName === 'Uncategorized' ? <Package size={14} /> : <UtensilsCrossed size={14} />}
                                        </div>
                                        <div>
                                            <p className={`font-black text-[10px] uppercase tracking-wider ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{group.mealName}</p>
                                            <p className={`text-[9px] ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>{group.ingredients.length} items</p>
                                        </div>
                                    </div>
                                    {group.expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </button>

                                {/* Ingredients */}
                                {group.expanded && (
                                    <div className="divide-y divide-slate-100">
                                        {group.ingredients.map((ing, iIdx) => (
                                            <div key={iIdx} className={`flex items-center gap-3 p-3 ${darkMode ? 'hover:bg-slate-600' : 'hover:bg-slate-50'} transition-colors`}>
                                                <button
                                                    onClick={() => toggleComplete(gIdx, iIdx)}
                                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${ing.completed
                                                            ? 'bg-green-500 border-green-500'
                                                            : (darkMode ? 'border-slate-500' : 'border-slate-200')
                                                        }`}
                                                >
                                                    {ing.completed && <Check size={12} className="text-white" />}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <span className={`text-sm font-medium truncate block ${ing.completed
                                                            ? (darkMode ? 'text-slate-500 line-through' : 'text-slate-300 line-through')
                                                            : (darkMode ? 'text-slate-200' : 'text-slate-700')
                                                        }`}>
                                                        {ing.name}
                                                    </span>
                                                    {ing.addedBy && <span className={`text-[9px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>by {ing.addedBy}</span>}
                                                </div>

                                                {!ing.completed && (
                                                    <button
                                                        onClick={() => openWalmart(ing.name)}
                                                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 ${darkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-50 text-blue-600'
                                                            }`}
                                                    >
                                                        Shop
                                                        <ExternalLink size={10} />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => deleteItem(gIdx, iIdx)}
                                                    className={`p-1 rounded ${darkMode ? 'text-slate-500 hover:text-red-400' : 'text-slate-300 hover:text-red-500'}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Clear Completed */}
                {completedCount > 0 && (
                    <button
                        onClick={clearCompleted}
                        className={`w-full py-3 rounded-xl text-xs font-bold ${darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                            }`}
                    >
                        Clear {completedCount} completed items
                    </button>
                )}

                {/* Walmart Cart Link */}
                {totalItems > 0 && (
                    <button
                        onClick={() => window.open('https://www.walmart.com/cart', '_blank')}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                        <ShoppingCart size={16} />
                        Open Walmart Cart
                    </button>
                )}
            </div>
        </div>
    );
};

export default ShoppingList;
