import { getMessaging, getToken } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// VAPID key for Web Push - get from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = 'BAnTJrbcZ8fz0bvM08VSvGy5RHBnTs97n6Rh8SZtrXxAPqEY4npG42RimQ8ROnRaPlXikWcbdX_LdcaUJcGDGnM';

/**
 * Send push notification - Note: This is handled by Cloud Functions (functions/index.js)
 * This function is kept for backwards compatibility but just logs the intent.
 * The actual push is triggered when Firestore data changes (game turns, bridge messages)
 */
export const sendPushNotification = async (toToken, title, body) => {
    // Cloud Functions handle FCM push when Firestore documents change
    // This is just a no-op for backwards compatibility
    console.log('Push notification intent:', { title, body, hasToken: !!toToken });
};

/**
 * Request notification permission and register FCM token
 * @returns {Object} { success: boolean, token?: string, error?: string }
 */
export const requestNotificationPermission = async (db, role, coupleCode) => {
    try {
        if (!('Notification' in window)) {
            return { success: false, error: 'Notifications not supported in this browser' };
        }

        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            return { success: false, error: 'Permission denied by user', permission };
        }

        // Register service worker if needed
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            } catch (swError) {
                console.warn('Service worker registration failed:', swError);
            }
        }

        const messaging = getMessaging();
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });

        if (token) {
            // Save token to the path expected by Cloud Functions
            // functions/index.js expects: couples/{coupleCode}/fcm_tokens/{role}
            await setDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'fcm_tokens', role), {
                token: token,
                updatedAt: serverTimestamp()
            });

            console.log('FCM Token saved for', role, ':', token.substring(0, 20) + '...');
            return { success: true, token };
        } else {
            return { success: false, error: 'Could not get FCM token' };
        }
    } catch (error) {
        console.error('Notification permission error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Show a local notification (works when app is in foreground)
 * For background notifications, the Cloud Functions handle FCM push
 */
export const showLocalNotification = async (title, body) => {
    if (Notification.permission !== 'granted') {
        console.log('Notification permission not granted');
        return false;
    }

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(title, {
                body,
                icon: '/logo192.png',
                badge: '/logo192.png',
                vibrate: [200, 100, 200],
                tag: 'unity-bridge-notification'
            });
            return true;
        }

        // Fallback to regular notification
        new Notification(title, { body, icon: '/logo192.png' });
        return true;
    } catch (error) {
        console.error('Show notification error:', error);
        return false;
    }
};

/**
 * Re-register FCM token (useful for "Resync" button)
 */
export const resyncNotifications = async (db, role, coupleCode) => {
    // First check if notifications are supported and permitted
    if (!('Notification' in window)) {
        return { success: false, error: 'Notifications not supported' };
    }

    if (Notification.permission !== 'granted') {
        // Try to request permission again
        return await requestNotificationPermission(db, role, coupleCode);
    }

    try {
        const messaging = getMessaging();

        // Delete old token and get new one
        const token = await getToken(messaging, { vapidKey: VAPID_KEY });

        if (token) {
            await setDoc(doc(db, 'couples', coupleCode.toLowerCase(), 'fcm_tokens', role), {
                token: token,
                updatedAt: serverTimestamp()
            });

            return { success: true, message: 'Notifications re-synced successfully!' };
        }

        return { success: false, error: 'Could not refresh token' };
    } catch (error) {
        console.error('Resync error:', error);
        return { success: false, error: error.message };
    }
};
