const fs = require("fs");
const path = require("path");
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function checkModelsAndVision() {
    console.log("Checking available models and vision support from NewAPI...");

    // Priority: NEWAPI_BASE_URL -> Hardcoded known NewAPI -> OPENAI_BASE_URL (if compatible)
    let baseURL = process.env.NEWAPI_BASE_URL;
    let apiKey = process.env.NEWAPI_API_KEY;

    // Fallback to known working NewAPI credentials if not explicitly set in env
    if (!baseURL) {
        baseURL = "https://sdwfger.edu.kg";
    }

    // If still no key, try OPENAI_API_KEY but be careful about URL
    if (!apiKey) {
        apiKey = "sk-6T9XdUUKQZliNajzQcO8i57LfdqQd9V2DfVtAlqho8gB3AfE";
    }

    // Ensure baseURL does not end with /v1 if we are appending /api/models
    let rootURL = baseURL;
    if (rootURL.endsWith("/v1")) {
        rootURL = rootURL.slice(0, -3);
    }
    if (rootURL.endsWith("/")) {
        rootURL = rootURL.slice(0, -1);
    }

    // 1. Fetch Models
    const modelsUrl = `${baseURL}/v1/models`;
    console.log(`Fetching models from: ${modelsUrl}`);

    let availableModels = [];

    try {
        const response = await fetch(modelsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.object === 'list' && Array.isArray(data.data)) {
            availableModels = data.data.map(m => m.id).sort();
            console.log(`✅ Found ${availableModels.length} models.`);
        } else if (data.success && data.data) {
            // Handle NewAPI specific format if /v1/models returns it (unlikely but possible)
            const allModels = new Set();
            for (const [channelId, models] of Object.entries(data.data)) {
                models.forEach(m => allModels.add(m));
            }
            availableModels = Array.from(allModels).sort();
            console.log(`✅ Found ${availableModels.length} models (NewAPI format).`);
        } else {
            console.error("❌ Unexpected response format for model list.");
            return;
        }

    } catch (error) {
        console.error("❌ Failed to fetch models:", error.message);
        return;
    }

    // 2. Prepare Image for Vision Test
    const imagePath = path.join(__dirname, "1.png");
    let base64Image = "";

    if (fs.existsSync(imagePath)) {
        base64Image = fs.readFileSync(imagePath).toString("base64");
    } else {
        // Fallback to the artifact image if 1.png doesn't exist
        const artifactImage = "/home/wttwins/.gemini/antigravity/brain/7857ca65-80c3-41fe-a5d2-21f3802af3f8/eng.jpg";
        if (fs.existsSync(artifactImage)) {
            base64Image = fs.readFileSync(artifactImage).toString("base64");
            console.log("Using fallback image: eng.jpg");
        } else {
            console.error("❌ No test image found (checked scripts/1.png and artifact eng.jpg). Skipping vision test.");
            return;
        }
    }

    const mimeType = "image/jpeg"; // Assuming jpeg/png is fine

    // 3. Test Vision Support
    console.log("\n--- Testing Vision Support (Sampling 5 models + known vision models) ---");

    // Filter for likely vision models to prioritize testing, plus some random ones
    const visionKeywords = ["vision", "4v", "4o", "gemini", "claude-3", "llava"];
    const likelyVisionModels = availableModels.filter(m => visionKeywords.some(k => m.toLowerCase().includes(k)));

    // Let's test specific models of interest + likely vision ones
    // De-duplicate
    const modelsToTest = [...new Set([...likelyVisionModels])];

    console.log(`Testing ${modelsToTest.length} potential vision models...`);

    const supportedModels = [];
    const unsupportedModels = [];

    for (const model of modelsToTest) {
        process.stdout.write(`Testing ${model}... `);

        const chatUrl = `${baseURL}/v1/chat/completions`;
        const payload = {
            model: model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Describe this image in 3 words." },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 10
        };

        try {
            const startTime = Date.now();
            const res = await fetch(chatUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            const resData = await res.json();
            const endTime = Date.now();
            const duration = endTime - startTime;

            if (res.ok) {
                // Check if it actually processed the image or ignored it (some text models might just ignore the image part)
                // But usually if they don't support it, they error out or complain.
                // Or if they return a description, it's supported.
                if (resData.choices && resData.choices.length > 0) {
                    console.log(`✅ Supported (${duration}ms)`);
                    supportedModels.push({ name: model, duration: duration });
                } else {
                    console.log(`❓ Empty response (${duration}ms)`);
                }
            } else {
                // Common errors: 400 (invalid request, likely image not supported), 422
                const msg = resData.error ? resData.error.message : "Unknown error";
                if (msg.includes("vision") || msg.includes("image") || msg.includes("multimodal") || res.status === 400) {
                    console.log(`❌ Not Supported (${res.status})`);
                } else {
                    console.log(`❌ Error: ${res.status} - ${msg.substring(0, 50)}...`);
                }
                unsupportedModels.push(model);
            }

        } catch (e) {
            console.log(`❌ Network/Script Error: ${e.message}`);
        }
    }

    console.log("\n--- Vision Support Summary (Sorted by Speed) ---");
    console.log("✅ Models with Vision Support:");
    supportedModels.sort((a, b) => a.duration - b.duration).forEach(m => console.log(`  - ${m.name}: ${m.duration}ms`));
}

checkModelsAndVision();
