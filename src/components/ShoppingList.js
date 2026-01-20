import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, Check, X } from 'lucide-react';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';

const ShoppingList = ({
    db,
    coupleCode,
    darkMode = false,
    userRole, // 'his', 'hers', or kidId
    userName // Display name of current user
}) => {
    const [items, setItems] = useState([]);
    const [newItem, setNewItem] = useState('');
    const [loading, setLoading] = useState(true);

    // Listen to shopping list
    useEffect(() => {
        if (!db || !coupleCode) return;

        const listRef = collection(db, 'families', coupleCode.toLowerCase(), 'shopping_list');
        const q = query(listRef, orderBy('createdAt', 'desc'));

        const unsub = onSnapshot(q, (snap) => {
            const listItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setItems(listItems);
            setLoading(false);
        }, (err) => {
            console.error('Shopping list error:', err);
            setLoading(false);
        });

        return () => unsub();
    }, [db, coupleCode]);

    const addItem = async () => {
        if (!newItem.trim() || !db || !coupleCode) return;

        try {
            const listRef = collection(db, 'families', coupleCode.toLowerCase(), 'shopping_list');
            await addDoc(listRef, {
                name: newItem.trim(),
                completed: false,
                addedBy: userRole,
                addedByName: userName || userRole,
                createdAt: serverTimestamp()
            });
            setNewItem('');
        } catch (err) {
            console.error('Add item error:', err);
        }
    };

    const toggleItem = async (itemId, currentState) => {
        if (!db || !coupleCode) return;
        try {
            await updateDoc(doc(db, 'families', coupleCode.toLowerCase(), 'shopping_list', itemId), {
                completed: !currentState,
                completedBy: !currentState ? userName : null,
                completedAt: !currentState ? serverTimestamp() : null
            });
        } catch (err) {
            console.error('Toggle item error:', err);
        }
    };

    const deleteItem = async (itemId) => {
        if (!db || !coupleCode) return;
        try {
            await deleteDoc(doc(db, 'families', coupleCode.toLowerCase(), 'shopping_list', itemId));
        } catch (err) {
            console.error('Delete item error:', err);
        }
    };

    const clearCompleted = async () => {
        const completed = items.filter(i => i.completed);
        for (const item of completed) {
            await deleteItem(item.id);
        }
    };

    const pendingItems = items.filter(i => !i.completed);
    const completedItems = items.filter(i => i.completed);

    return (
        <div className={`rounded-3xl shadow-xl border p-4 space-y-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${darkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                        <ShoppingCart className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                        <h3 className={`text-sm font-black ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Shopping List</h3>
                        <p className="text-[9px] text-slate-400">{pendingItems.length} items to get</p>
                    </div>
                </div>
                {completedItems.length > 0 && (
                    <button
                        onClick={clearCompleted}
                        className="text-[9px] font-bold text-red-400 hover:text-red-500"
                    >
                        Clear Done
                    </button>
                )}
            </div>

            {/* Add Item Form */}
            <form
                onSubmit={(e) => { e.preventDefault(); addItem(); }}
                className="flex gap-2"
            >
                <input
                    type="text"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Add item..."
                    className={`flex-1 p-3 rounded-xl text-sm border outline-none ${darkMode
                        ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400'
                        : 'bg-slate-50 border-slate-200 placeholder-slate-400'}`}
                />
                <button
                    type="submit"
                    disabled={!newItem.trim()}
                    className="px-4 py-3 bg-green-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-green-700 active:scale-95 transition-all"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </form>

            {/* Items List */}
            {loading ? (
                <div className="text-center py-4">
                    <p className="text-xs text-slate-400">Loading...</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {pendingItems.length === 0 && completedItems.length === 0 && (
                        <div className="text-center py-6">
                            <p className="text-3xl mb-2">🛒</p>
                            <p className="text-xs text-slate-400">No items yet. Add something!</p>
                        </div>
                    )}

                    {/* Pending Items */}
                    {pendingItems.map(item => (
                        <div
                            key={item.id}
                            className={`flex items-center gap-3 p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-slate-50'}`}
                        >
                            <button
                                onClick={() => toggleItem(item.id, item.completed)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${darkMode
                                    ? 'border-slate-500 hover:border-green-400'
                                    : 'border-slate-300 hover:border-green-500'}`}
                            />
                            <div className="flex-1">
                                <p className={`text-sm font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{item.name}</p>
                                <p className="text-[9px] text-slate-400">by {item.addedByName}</p>
                            </div>
                            <button
                                onClick={() => deleteItem(item.id)}
                                className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    {/* Completed Items */}
                    {completedItems.length > 0 && (
                        <>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-4">Completed</p>
                            {completedItems.map(item => (
                                <div
                                    key={item.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl opacity-60 ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}
                                >
                                    <button
                                        onClick={() => toggleItem(item.id, item.completed)}
                                        className="w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center"
                                    >
                                        <Check className="w-3 h-3 text-white" />
                                    </button>
                                    <p className={`flex-1 text-sm line-through ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{item.name}</p>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ShoppingList;
