const functions = require("firebase-functions");
const https = require("https");

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

    const { prompt } = req.body;
    if (!prompt) {
        res.status(400).json({ error: "Missing prompt" });
        return;
    }

    if (!GEMINI_API_KEY) {
        res.status(500).json({ error: "API key not configured" });
        return;
    }

    const postData = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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
                    const text = result.candidates[0].content.parts[0].text;
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
