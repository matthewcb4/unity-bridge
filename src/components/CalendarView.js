import React, { useState } from 'react';
import { Calendar, ExternalLink } from 'lucide-react';

const CalendarView = ({ calendarId, title, darkMode, mode: initialMode = 'AGENDA' }) => {
    const [mode, setMode] = useState(initialMode);
    const bgColor = darkMode ? '0f172a' : 'ffffff';
    // Google Calendar embed URL with basic customizations
    // mode can be MONTH, WEEK, or AGENDA
    const embedUrl = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=America%2FChicago&showTitle=0&showNav=1&showPrint=0&showTabs=0&showCalendars=0&showTz=0&mode=${mode}&wkst=1&bgcolor=%23${bgColor}`;

    return (
        <div className={`space-y-3 animate-in fade-in slide-in-from-bottom-4`}>
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-rose-500" />
                    <h3 className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{title}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        className={`text-[9px] font-black uppercase border rounded-lg px-2 py-1 outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                        <option value="MONTH">Month</option>
                        <option value="WEEK">Week</option>
                        <option value="AGENDA">Agenda</option>
                    </select>
                    <a
                        href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(calendarId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-1.5 rounded-lg border transition-all ${darkMode ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                        title="Open in Google Calendar"
                    >
                        <ExternalLink className="w-3 h-3 text-rose-500" />
                    </a>
                </div>
            </div>
            <div className={`rounded-3xl overflow-hidden border shadow-inner ${darkMode ? 'border-slate-700 bg-slate-900' : 'border-rose-100 bg-rose-50/30'} h-[500px] w-full relative`}>
                <iframe
                    src={embedUrl}
                    style={{ border: 0 }}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    title={title}
                    className={darkMode ? 'opacity-80' : ''}
                ></iframe>
            </div>
        </div>
    );
};

export default CalendarView;
