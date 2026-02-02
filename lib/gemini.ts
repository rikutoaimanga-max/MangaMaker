import { GoogleGenerativeAI, Part } from '@google/generative-ai';

export interface MangaPage {
    pageNumber: number;
    panels: {
        panelNumber: number;
        description: string;
        dialogue: string;
        cameraAngle?: string;
        characters?: string[];
        imageUrl?: string; // Generated image URL (base64)
    }[];
}

export async function generateImage(
    apiKey: string,
    prompt: string,
    referenceImages: { data: Blob; type: string }[] = [],
    options: { aspectRatio?: string } = {}
): Promise<string> {
    // gemini-3-pro-image-preview uses the generateContent endpoint, not predict.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

    const imageParts: Part[] = await Promise.all(
        referenceImages.map(async (img) => ({
            inlineData: {
                data: await blobToBase64(img.data),
                mimeType: img.type,
            },
        }))
    );

    // Enhance prompt with quality and aspect settings
    let enhancedPrompt = prompt;
    if (options.aspectRatio) {
        enhancedPrompt += `\n\nAspect Ratio: ${options.aspectRatio}`;
        // Specific pixel hints for known ratios to guide the model towards "2K" equivalent
        if (options.aspectRatio === '2:3') {
            enhancedPrompt += `\nTarget Dimensions: 1696x2528 pixels`; // ~2K portrait
        } else if (options.aspectRatio === '3:2') {
            enhancedPrompt += `\nTarget Dimensions: 2528x1696 pixels`; // ~2K landscape
        }
    }

    // Enforce 2K/HD quality via prompting as per user request (and fallback for lack of config support)
    enhancedPrompt += `\nOutput Resolution: 2K`;
    enhancedPrompt += `\nImage Quality: HD, High Definition`;

    // Default Style
    enhancedPrompt += `\nStyle: Manga style, anime style, high quality.`;

    // General quality boosters
    enhancedPrompt += `\nQuality: Masterpiece, best quality, highly detailed.`;



    const parts = [{ text: enhancedPrompt }];
    // Append image parts if any
    if (imageParts.length > 0) {
        parts.push(...imageParts);
    }

    // Note: aspectRatio in generationConfig is supported by some Imagen models via Vertex AI but 
    // inconsistent in the generic Gemini generateContent API.
    // We rely on the Prompt for now.

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: parts
            }],
            generationConfig: {
                candidateCount: 1
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Image Gen Error Body:", errorText);
        throw new Error(`Image Generation Failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // Check for inline data (common for Gemini image generation)
    if (data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts) {

        for (const part of data.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                return part.inlineData.data;
            }
        }
    }

    console.error("Unknown image response structure:", data);
    throw new Error("Received an unknown response format from Image API");
}


// Replaced generateMangaScript with generateMangaPrompts
export async function generateMangaPrompts(
    apiKey: string,
    prompt: string,
    pageCount: number = 1,
    referenceImages: { data: Blob; type: string }[] = []
): Promise<string[]> {
    if (!apiKey) throw new Error("API Key is missing");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const imageParts: Part[] = await Promise.all(
        referenceImages.map(async (img) => ({
            inlineData: {
                data: await blobToBase64(img.data),
                mimeType: img.type,
            },
        }))
    );

    const styleInstruction = "Manga page. High quality, detailed, anime style.";

    const systemPrompt = `
    Your task is to create detailed image generation prompts for a manga based on the user's story idea.
    You need to generate ${pageCount} prompt(s).
    
    Each prompt will be used to generate a SINGLE IMAGE that looks like a complete ${styleInstruction} with multiple panels.
    
    IMPORTANT: The user wants ${pageCount} DIFFERENT VARIATIONS of the same story.
    Do NOT split the story across multiple pages.
    Each of the ${pageCount} prompts must represent the COMPLETION of the user's entire prompt within a single page.
    Make each variation slightly different in composition, camera angles, or panel layout.
    
    Output Format: JSON Array of strings.
    Example:
    [
      "A high-quality ${styleInstruction} with 4 panels. Panel 1 (top): Close up of a young man with spiky black hair... Panel 2 (middle): Wide shot of..."
    ]

    STRICT constraints:
    1. Output EXACTLY ${pageCount} strings in a JSON array.
    2. Each string must be a highly detailed visual description of one full manga page.
    3. Include instructions for 'panels', 'layout', 'characters', and 'speech bubbles'.
    4. CRITICAL: If reference images are provided, you MUST EXPLICITLY DESCRIBE their visual appearance in EVERY prompt (e.g., "Young man with spiky black hair, yellow eyes, wearing a techwear jacket"). Do NOT just say "similar to Reference Image 1" because the image generator CANNOT see the reference images. You must translate the image into words.
    5. The art style should be consistent: "${styleInstruction}, professional layout".
    6. Output ONLY valid JSON.
    7. For speech bubbles, prioritize clear, empty bubble shapes. English or Japanese text inside bubbles may be distorted, so focus on the visual placement of bubbles.
  `;

    const result = await model.generateContent([
        systemPrompt,
        "\n\nUser Story Idea:\n" + prompt,
        ...imageParts
    ]);

    const text = result.response.text();

    // Clean up potential markdown formatting
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.every(i => typeof i === 'string')) {
            return parsed;
        }
        throw new Error("Invalid format");
    } catch (e) {
        console.error("Failed to parse JSON", text);
        throw new Error("Failed to generate valid prompt structure");
    }
}

export async function generatePromptsFromScript(
    apiKey: string,
    script: string,
    pageCount: number = 4
): Promise<string[]> {
    if (!apiKey) throw new Error("API Key is missing");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const styleInstruction = "Manga page. High quality, detailed, anime style.";

    const systemPrompt = `
    Your task is to act as a professional manga editor and storyboarder.
    You have been provided with a script/story text.
    Your goal is to split this script into EXACTLY ${pageCount} sequential manga pages.

    Instructions:
    1. Divide the story/script logically into ${pageCount} parts (pages).
    2. For EACH page, write a highly detailed image generation prompt.
    3. The prompt should describe the layout, panels, characters, and action for that specific part of the story.
    4. Ensure flow and continuity from Page 1 to Page ${pageCount}.

    Output Format: JSON Array of strings (size ${pageCount}).
    Example:
    [
      "Page 1: ${styleInstruction}, 5 panels. Panel 1: Intro shot of city... Panel 2: Protagonist enters...",
      "Page 2: ${styleInstruction}, 4 panels. Panel 1: Dialogue scene...",
      ...
    ]

    Constraints:
    - Output ONLY valid JSON.
    - The array length must be EXACTLY ${pageCount}.
    - Style: ${styleInstruction}
    `;

    const result = await model.generateContent([
        systemPrompt,
        "\n\nInput Script:\n" + script
    ]);
    const text = result.response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.every(i => typeof i === 'string')) {
            return parsed;
        }
        throw new Error("Invalid format");
    } catch (e) {
        console.error("Failed to parse JSON", text);
        throw new Error("Failed to generate valid prompt structure");
    }
}

export async function analyzeCharacterFeatures(
    apiKey: string,
    imageBlob: Blob,
    mimeType: string
): Promise<string> {
    if (!apiKey) throw new Error("API Key is missing for analysis");

    // Use a fast vision model
    const genAI = new GoogleGenerativeAI(apiKey);
    const base64 = await blobToBase64(imageBlob);

    const prompt = `
      Analyze this character image and provide a highly detailed visual description suitable for an image generation AI.
      Focus strictly on visual traits:
      - Hair (style, color)
      - Eyes (shape, color)
      - Clothing (specific items, colors, style)
      - Accessories
      - Art style (e.g. thick lines, sketch, anime)
      
      Output format: A dense string of descriptive keywords and phrases.
      Example: "young man, spiky silver hair, sharp red eyes, wearing a black trench coat with high collar, futuristic cyberpunk aesthetic, cel shaded"
    `;

    const candidateModels = ["gemini-1.5-flash", "gemini-1.5-flash-001", "gemini-1.5-pro", "gemini-pro-vision"];
    let lastError;

    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([
                prompt,
                { inlineData: { data: base64, mimeType } }
            ]);
            return result.response.text().trim();
        } catch (e) {
            console.warn(`Analysis model ${modelName} failed. Trying next...`);
            lastError = e;
        }
    }

    throw lastError || new Error("All analysis models failed");
}


export async function getAvailableModels(apiKey: string): Promise<{ name: string; displayName: string; description: string; supportedGenerationMethods: string[] }[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.models || [];
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove data URL prefix (e.g. "data:image/jpeg;base64,")
            resolve(base64String.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

