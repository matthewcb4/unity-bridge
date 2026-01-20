import React from 'react';
import Lottie from 'lottie-react';

// Simple heart beat animation data (inline JSON for bundle size)
const heartBeatData = {
    "v": "5.7.4",
    "fr": 30,
    "ip": 0,
    "op": 30,
    "w": 100,
    "h": 100,
    "layers": [{
        "ty": 4,
        "nm": "Heart",
        "sr": 1,
        "ks": {
            "o": { "a": 0, "k": 100 },
            "s": {
                "a": 1,
                "k": [
                    { "t": 0, "s": [100, 100, 100], "e": [115, 115, 100] },
                    { "t": 7, "s": [115, 115, 100], "e": [100, 100, 100] },
                    { "t": 15, "s": [100, 100, 100], "e": [110, 110, 100] },
                    { "t": 22, "s": [110, 110, 100], "e": [100, 100, 100] },
                    { "t": 30, "s": [100, 100, 100] }
                ]
            },
            "p": { "a": 0, "k": [50, 50, 0] },
            "a": { "a": 0, "k": [0, 0, 0] },
            "r": { "a": 0, "k": 0 }
        },
        "shapes": [{
            "ty": "gr",
            "it": [{
                "ty": "sh",
                "d": 1,
                "ks": {
                    "a": 0,
                    "k": {
                        "c": true,
                        "v": [[0, -15], [-25, -35], [-40, -15], [-40, 5], [0, 40], [40, 5], [40, -15], [25, -35]],
                        "i": [[0, 0], [-15, 0], [0, -20], [0, 15], [-20, 20], [0, 0], [0, -20], [15, 0]],
                        "o": [[-15, 0], [0, -20], [0, 15], [-20, 20], [0, 0], [20, 20], [0, 15], [0, 0]]
                    }
                }
            }, {
                "ty": "fl",
                "c": { "a": 0, "k": [0.95, 0.3, 0.4, 1] },
                "o": { "a": 0, "k": 100 }
            }, {
                "ty": "tr",
                "p": { "a": 0, "k": [0, 0] },
                "a": { "a": 0, "k": [0, 0] },
                "s": { "a": 0, "k": [100, 100] },
                "r": { "a": 0, "k": 0 },
                "o": { "a": 0, "k": 100 }
            }]
        }]
    }]
};

// Confetti/celebration animation data
const celebrationData = {
    "v": "5.7.4",
    "fr": 60,
    "ip": 0,
    "op": 60,
    "w": 200,
    "h": 200,
    "layers": Array.from({ length: 12 }, (_, i) => ({
        "ty": 4,
        "nm": `Particle${i}`,
        "sr": 1,
        "ks": {
            "o": {
                "a": 1,
                "k": [
                    { "t": 0, "s": [0], "e": [100] },
                    { "t": 10, "s": [100], "e": [100] },
                    { "t": 50, "s": [100], "e": [0] },
                    { "t": 60, "s": [0] }
                ]
            },
            "s": { "a": 0, "k": [100, 100, 100] },
            "p": {
                "a": 1,
                "k": [
                    { "t": 0, "s": [100, 100, 0], "e": [100 + (Math.random() - 0.5) * 160, 100 + (Math.random() - 0.5) * 160, 0] },
                    { "t": 60, "s": [100 + (Math.random() - 0.5) * 160, 100 + (Math.random() - 0.5) * 160, 0] }
                ]
            },
            "a": { "a": 0, "k": [0, 0, 0] },
            "r": {
                "a": 1,
                "k": [
                    { "t": 0, "s": [0], "e": [360 * (Math.random() > 0.5 ? 1 : -1)] },
                    { "t": 60, "s": [360 * (Math.random() > 0.5 ? 1 : -1)] }
                ]
            }
        },
        "shapes": [{
            "ty": "gr",
            "it": [{
                "ty": "rc",
                "d": 1,
                "s": { "a": 0, "k": [8, 8] },
                "p": { "a": 0, "k": [0, 0] },
                "r": { "a": 0, "k": 2 }
            }, {
                "ty": "fl",
                "c": {
                    "a": 0, "k": [
                        [0.95, 0.3, 0.4, 1],
                        [0.4, 0.6, 0.95, 1],
                        [0.95, 0.8, 0.3, 1],
                        [0.4, 0.9, 0.6, 1],
                        [0.9, 0.4, 0.8, 1]
                    ][i % 5]
                },
                "o": { "a": 0, "k": 100 }
            }, {
                "ty": "tr",
                "p": { "a": 0, "k": [0, 0] },
                "a": { "a": 0, "k": [0, 0] },
                "s": { "a": 0, "k": [100, 100] },
                "r": { "a": 0, "k": 0 },
                "o": { "a": 0, "k": 100 }
            }]
        }]
    }))
};

// Loading spinner with gradient
const loadingData = {
    "v": "5.7.4",
    "fr": 60,
    "ip": 0,
    "op": 60,
    "w": 100,
    "h": 100,
    "layers": [{
        "ty": 4,
        "nm": "Spinner",
        "sr": 1,
        "ks": {
            "o": { "a": 0, "k": 100 },
            "s": { "a": 0, "k": [100, 100, 100] },
            "p": { "a": 0, "k": [50, 50, 0] },
            "a": { "a": 0, "k": [0, 0, 0] },
            "r": {
                "a": 1,
                "k": [
                    { "t": 0, "s": [0], "e": [360] },
                    { "t": 60, "s": [360] }
                ]
            }
        },
        "shapes": [{
            "ty": "gr",
            "it": [{
                "ty": "el",
                "d": 1,
                "s": { "a": 0, "k": [60, 60] },
                "p": { "a": 0, "k": [0, 0] }
            }, {
                "ty": "st",
                "c": { "a": 0, "k": [0.95, 0.3, 0.4, 1] },
                "o": { "a": 0, "k": 100 },
                "w": { "a": 0, "k": 6 },
                "lc": 2,
                "lj": 1,
                "d": [{ "n": "d", "v": { "a": 0, "k": 40 } }, { "n": "g", "v": { "a": 0, "k": 100 } }]
            }, {
                "ty": "tr",
                "p": { "a": 0, "k": [0, 0] },
                "a": { "a": 0, "k": [0, 0] },
                "s": { "a": 0, "k": [100, 100] },
                "r": { "a": 0, "k": 0 },
                "o": { "a": 0, "k": 100 }
            }]
        }]
    }]
};

export const HeartBeat = ({ size = 60, className = '' }) => (
    <div className={className} style={{ width: size, height: size }}>
        <Lottie animationData={heartBeatData} loop autoplay />
    </div>
);

export const Celebration = ({ size = 120, className = '' }) => (
    <div className={className} style={{ width: size, height: size }}>
        <Lottie animationData={celebrationData} loop={false} autoplay />
    </div>
);

export const LoadingSpinner = ({ size = 40, className = '' }) => (
    <div className={className} style={{ width: size, height: size }}>
        <Lottie animationData={loadingData} loop autoplay />
    </div>
);

// Simple CSS-based pulse animation as fallback
export const PulseHeart = ({ size = 40, className = '' }) => (
    <div
        className={`inline-flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
    >
        <div className="animate-pulse text-rose-500" style={{ fontSize: size * 0.7 }}>
            💕
        </div>
    </div>
);

export default {
    HeartBeat,
    Celebration,
    LoadingSpinner,
    PulseHeart
};
