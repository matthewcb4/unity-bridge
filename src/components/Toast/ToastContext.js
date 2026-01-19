import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const TOAST_CONFIGS = {
    success: { emoji: '✓', bg: 'bg-green-500', border: 'border-green-600' },
    error: { emoji: '✕', bg: 'bg-red-500', border: 'border-red-600' },
    warning: { emoji: '⚠', bg: 'bg-amber-500', border: 'border-amber-600' },
    info: { emoji: 'ℹ', bg: 'bg-blue-500', border: 'border-blue-600' }
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now() + Math.random();
        const newToast = { id, message, type, duration };

        setToasts(prev => [...prev, newToast]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }

        return id;
    }, []);

    const hideToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Convenience methods
    const toast = {
        success: (msg, duration) => showToast(msg, 'success', duration),
        error: (msg, duration) => showToast(msg, 'error', duration),
        warning: (msg, duration) => showToast(msg, 'warning', duration),
        info: (msg, duration) => showToast(msg, 'info', duration),
        show: showToast,
        hide: hideToast
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 left-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none sm:left-auto sm:right-4 sm:max-w-sm">
                {toasts.map((t) => {
                    const config = TOAST_CONFIGS[t.type] || TOAST_CONFIGS.info;
                    return (
                        <div
                            key={t.id}
                            className={`
                                pointer-events-auto
                                flex items-center gap-3 px-4 py-3
                                rounded-2xl shadow-2xl border-2
                                text-white font-bold text-sm
                                animate-in slide-in-from-bottom-4 fade-in duration-300
                                ${config.bg} ${config.border}
                            `}
                        >
                            <span className="text-lg">{config.emoji}</span>
                            <span className="flex-1">{t.message}</span>
                            <button
                                onClick={() => hideToast(t.id)}
                                className="opacity-70 hover:opacity-100 text-lg font-bold ml-2"
                            >
                                ×
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

export default ToastContext;
