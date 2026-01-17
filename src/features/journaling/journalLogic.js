import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Heart, Zap, Sparkles, PenTool } from 'lucide-react';

export const JOURNAL_TYPES = {
    feeling: { label: 'Feeling', color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200', icon: Heart },
    ai_log: { label: 'AI Log', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200', icon: Zap },
    win: { label: 'Win', color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200', icon: Sparkles },
    thought: { label: 'Thought', color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200', icon: PenTool }
};

export const saveToJournal = async ({ db, user, coupleCode, role, content, meta = {} }) => {
    if (!user || !coupleCode || !role || !content) {
        throw new Error('Missing required information to save journal entry.');
    }

    const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
    return await addDoc(collection(db, sharedNamespace, 'journals', role, 'entries'), {
        content,
        timestamp: serverTimestamp(),
        ...meta
    });
};

export const deleteFromJournal = async ({ db, coupleCode, role, itemId }) => {
    if (!coupleCode || !role || !itemId) {
        throw new Error('Missing required information to delete journal entry.');
    }

    const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
    return await deleteDoc(doc(db, sharedNamespace, 'journals', role, 'entries', itemId));
};

export const updateJournalEntry = async ({ db, coupleCode, role, itemId, newContent }) => {
    if (!coupleCode || !role || !itemId || !newContent) {
        throw new Error('Missing required information to update journal entry.');
    }

    const sharedNamespace = `couples/${coupleCode.toLowerCase()}`;
    return await updateDoc(doc(db, sharedNamespace, 'journals', role, 'entries', itemId), {
        content: newContent,
        lastEdited: serverTimestamp()
    });
};

export const exportJournalData = (journalItems) => {
    if (!journalItems || journalItems.length === 0) return;

    const data = journalItems.map(item => ({
        date: item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : new Date(item.timestamp).toLocaleString(),
        type: item.type || 'standard',
        content: item.content
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
