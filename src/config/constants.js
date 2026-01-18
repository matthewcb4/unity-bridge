/**
 * Application constants extracted from App.js for centralized management
 */

// Calendar IDs for embedded Google Calendars
export const CALENDAR_IDS = {
    couples: 'NDU5ZWZkNDZlYzVjNzYwNGU2YTg0N2I2OGQxNmEzMzFiOWNhYzhmNzU1MjY1N2E4YjFiMjBmNDQ0OTZmODM2Y0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t',
    family: 'ZmFtaWx5MDY4MDk0MTIyMTIxNzk0OTA5NTJAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ'
};

// App identifier
export const APP_ID = 'unity-bridge-live';

// Default notification preferences
export const DEFAULT_NOTIFY_PREFS = {
    games: true,
    bridge: true,
    dateReminders: false,
    messageReminders: false
};

// Love language options
export const LOVE_LANGUAGES = [
    'Words of Affirmation',
    'Physical Touch',
    'Quality Time',
    'Acts of Service',
    'Receiving Gifts'
];

// Vault message categories
export const VAULT_CATEGORIES = {
    primary: ['gentle', 'flirty', 'appreciative'],
    secondary: ['daily', 'sensual', 'initiation']
};

// Budget options for date night
export const DATE_BUDGETS = [
    { id: 'free', label: 'Free', emoji: '🆓' },
    { id: 'cheap', label: '<$30', emoji: '💵' },
    { id: 'moderate', label: '$30-75', emoji: '💳' },
    { id: 'splurge', label: '$75+', emoji: '✨' }
];

// Milestone definitions
export const MILESTONES = [
    { id: 'first_share', label: 'First Share', emoji: '🌱', threshold: 1 },
    { id: 'week_streak', label: 'Week Streak', emoji: '🔥', threshold: 7 },
    { id: 'communicator', label: 'Communicator', emoji: '💬', threshold: 10 },
    { id: 'devoted', label: 'Devoted', emoji: '💕', threshold: 50 },
    { id: 'soulmate', label: 'Soulmate', emoji: '💎', threshold: 100 }
];

// Feeling options for conflict resolution
export const RESOLVE_FEELINGS = [
    { id: 'frustrated', emoji: '😤', label: 'Frustrated' },
    { id: 'hurt', emoji: '😔', label: 'Hurt/Sad' },
    { id: 'overwhelmed', emoji: '😰', label: 'Overwhelmed' },
    { id: 'confused', emoji: '🤔', label: 'Need Clarity' },
    { id: 'disconnected', emoji: '💔', label: 'Disconnected' },
    { id: 'fine', emoji: '🙂', label: "I'm okay" }
];

// Need options for conflict resolution
export const RESOLVE_NEEDS = [
    { id: 'vent', emoji: '📝', label: 'I need to vent/process my feelings', desc: 'Private journaling' },
    { id: 'communicate', emoji: '💬', label: 'I need help saying something', desc: 'AI-assisted messaging' },
    { id: 'resolve', emoji: '⚓', label: 'We need to work through something together', desc: 'Guided conflict resolution' },
    { id: 'encourage', emoji: '🤗', label: 'I just need some encouragement', desc: 'AI-generated support' }
];

// Communication intention options
export const TALK_INTENTIONS = [
    { id: 'compliment', label: 'Compliment', emoji: '🌸' },
    { id: 'concern', label: 'Concern', emoji: '🗣️' },
    { id: 'question', label: 'Question', emoji: '❓' },
    { id: 'update', label: 'Update', emoji: '📢' }
];

// Analysis time filter options
export const ANALYSIS_FILTERS = [
    { id: '7days', label: '7 Days' },
    { id: '14days', label: '14 Days' },
    { id: 'workweek', label: 'Work Week' },
    { id: 'weekend', label: 'Weekend' },
    { id: 'all', label: 'All Time' }
];
