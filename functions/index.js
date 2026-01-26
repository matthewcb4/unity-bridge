const functions = require("firebase-functions");
const admin = require("firebase-admin");
const https = require("https");

admin.initializeApp();

// API key stored securely in Firebase environment config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || functions.config().gemini?.key;

exports.callGemini = functions.https.onRequest((req, res) => {
    // Enable CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }

    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    const { prompt, image } = req.body;
    if (!prompt) {
        res.status(400).json({ error: "Missing prompt" });
        return;
    }

    if (!GEMINI_API_KEY) {
        res.status(500).json({ error: "API key not configured" });
        return;
    }

    const parts = [{ text: prompt }];
    if (image) {
        // Expecting base64 string without data:image/png;base64, prefix if possible, 
        // or cleaner to handle both. For now assuming sanitized base64.
        // Google API expects raw base64.
        parts.push({
            inlineData: {
                mimeType: "image/jpeg", // or "image/png" - Gemini is flexible usually, but best to be specific if known. 
                // For simplicity assuming jpeg or making it client's responsibility? 
                // Let's assume the client sends the data part.
                data: image
            }
        });
    }

    const postData = JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: "application/json" }
    });

    const options = {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData)
        }
    };

    const apiReq = https.request(options, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => { data += chunk; });
        apiRes.on("end", () => {
            try {
                const result = JSON.parse(data);
                if (result.error) {
                    res.status(apiRes.statusCode).json({ error: result.error.message });
                } else if (result.candidates && result.candidates[0]) {
                    let text = result.candidates[0].content.parts[0].text;
                    // Sanitize Markdown code blocks if present
                    text = text.replace(/```json\n?|```/g, '').trim();
                    res.json({ result: JSON.parse(text) });
                } else {
                    res.status(500).json({ error: "No response from AI" });
                }
            } catch (e) {
                res.status(500).json({ error: "Failed to parse response", details: e.message });
            }
        });
    });

    apiReq.on("error", (e) => {
        res.status(500).json({ error: "Request failed", details: e.message });
    });

    apiReq.write(postData);
    apiReq.end();
});

// Trigger for Game Moves
exports.onGameUpdate = functions.firestore
    .document("couples/{coupleCode}/active_games/{gameId}")
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();
        const { coupleCode } = context.params;

        // Only notify if the turn has changed
        if (newData.currentTurn === oldData.currentTurn) return null;

        const recipientRole = newData.currentTurn; // 'his' or 'hers'
        const senderRole = recipientRole === 'his' ? 'hers' : 'his';

        // Get recipient token
        const tokenDoc = await admin.firestore().doc(`couples/${coupleCode}/fcm_tokens/${recipientRole}`).get();
        if (!tokenDoc.exists) return null;

        const token = tokenDoc.data().token;
        const gameType = newData.type === 'letter_link' ? 'Letter Link' : 'Word Scramble';

        const message = {
            notification: {
                title: "Your Turn!",
                body: `Your partner made a move in ${gameType}. It's your turn now!`
            },
            token: token
        };

        try {
            await admin.messaging().send(message);
            console.log(`Notification sent for game ${context.params.gameId}`);
        } catch (error) {
            console.error("Error sending notification:", error);
        }
        return null;
    });

// Trigger for Bridge Messages
exports.onBridgeMessage = functions.firestore
    .document("couples/{coupleCode}/bridge_items/{itemId}")
    .onCreate(async (snapshot, context) => {
        const data = snapshot.data();
        const { coupleCode } = context.params;

        const senderRole = data.fromRole; // Assuming we add this to the bridge item
        const recipientRole = senderRole === 'his' ? 'hers' : 'his';

        // Get recipient token
        const tokenDoc = await admin.firestore().doc(`couples/${coupleCode}/fcm_tokens/${recipientRole}`).get();
        if (!tokenDoc.exists) return null;

        const token = tokenDoc.data().token;

        const message = {
            notification: {
                title: "New Bridge Message",
                body: data.content.length > 50 ? data.content.substring(0, 47) + "..." : data.content
            },
            token: token
        };

        try {
            await admin.messaging().send(message);
            console.log(`Notification sent for bridge message ${context.params.itemId}`);
        } catch (error) {
            console.error("Error sending notification:", error);
        }
        return null;
    });
