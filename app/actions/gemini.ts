'use server';

import { GoogleGenerativeAI, Part as GooglePart } from '@google/generative-ai';
import { VertexAI, GenerativeModel, Part as VertexPart } from '@google-cloud/vertexai';

export type GeminiProvider = 'google' | 'vertex';

export interface GeminiConfig {
    provider: GeminiProvider;
    apiKey?: string; // For Google AI Studio
    projectId?: string; // For Vertex AI
    location?: string; // For Vertex AI
}

// Shared Interface for MangaPage (same as lib/gemini.ts)
export interface MangaPage {
    pageNumber: number;
    panels: {
        panelNumber: number;
        description: string;
        dialogue: string;
        cameraAngle?: string;
        characters?: string[];
        imageUrl?: string;
    }[];
}

// Helper to convert base64 to parts
function base64ToPart(base64: string, mimeType: string): GooglePart | VertexPart {
    return {
        inlineData: {
            data: base64,
            mimeType: mimeType
        }
    };
}

export async function generateImageAction(
    config: GeminiConfig,
    prompt: string,
    referenceImages: { base64: string; type: string }[] = [],
    options: { aspectRatio?: string } = {}
): Promise<string> {

    // --- Prompt Enhancement (Shared) ---
    let enhancedPrompt = prompt;
    if (options.aspectRatio) {
        enhancedPrompt += `\n\nAspect Ratio: ${options.aspectRatio}`;
        if (options.aspectRatio === '2:3') {
            enhancedPrompt += `\nTarget Dimensions: 1696x2528 pixels`;
        } else if (options.aspectRatio === '3:2') {
            enhancedPrompt += `\nTarget Dimensions: 2528x1696 pixels`;
        }
    }
    enhancedPrompt += `\nOutput Resolution: 2K`;
    enhancedPrompt += `\nImage Quality: HD, High Definition`;
    enhancedPrompt += `\nStyle: Manga style, anime style, high quality.`;
    enhancedPrompt += `\nQuality: Masterpiece, best quality, highly detailed.`;

    // --- Google AI Studio Implementation ---
    if (config.provider === 'google') {
        if (!config.apiKey) throw new Error("Gemini API Key is required for Google AI Studio provider.");

        // Note: 'gemini-3-pro-image-preview' might need specific endpoint handling if standard SDK doesn't support it yet,
        // but existing client code used REST. The Node SDK should handle it if 'model' arg is correct, 
        // OR we might need to fallback to fetch if the SDK doesn't support the image preview model yet.
        // Assuming SDK v0.24+ supports it or we use generic generateContent.

        // However, the previous client-side implementation used `fetch` to `...:generateContent`.
        // The SDK `getGenerativeModel` -> `generateContent` does roughly the same.

        const genAI = new GoogleGenerativeAI(config.apiKey);
        // Warning: gemini-3-pro-image-preview might not be fully supported in the typed SDK enum, passing string is fine.
        const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

        const parts: GooglePart[] = [{ text: enhancedPrompt }];
        referenceImages.forEach(img => {
            parts.push(base64ToPart(img.base64, img.type) as GooglePart);
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts }]
        });

        const response = await result.response;
        // The SDK might not automatically parse the inline image data from the response structure of this specific preview model
        // if it differs largely from standard. But usually `text()` is what we access. 
        // For Image Generation models returning base64, we need to access candidates.

        // Note: The experimental image generation model returns valid base64 in the parts.
        // We need to access the raw candidates if possible or inspect the response object.
        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                    return part.inlineData.data;
                }
            }
        }
        throw new Error("No image data found in Google AI response");
    }

    // --- Vertex AI Implementation ---
    if (config.provider === 'vertex') {
        if (!config.projectId || !config.location) {
            throw new Error("Project ID and Location are required for Vertex AI provider.");
        }

        const vertexAI = new VertexAI({
            project: config.projectId,
            location: config.location,
        });

        // Use the same model name or the Vertex equivalent (often 'imagegeneration@006' or similar for Imagen, 
        // but for Gemini 3 preview it might be 'gemini-3-pro-preview' etc if available on Vertex).
        // Since Gemini 3 is very new experimental, it might NOT be on Vertex yet or under a different name.
        // However, user asked to enable Vertex AI. If Gemini 3 isn't there, we might fallback to 'gemini-1.5-pro-preview-0514' (text) 
        // or 'imagen-3.0-generate-001' for images.
        // 
        // *CRITICAL CHECK*: Does Vertex AI have `gemini-3-pro-image-preview`? 
        // Likely not yet. The user might expect standard Gemini functionality or Imagen.
        // Given the code uses `gemini-3-pro-image-preview`, I will attempt to use it, but if it fails, 
        // the user might need to change models. 
        // For now, I will use `gemini-experimental` or attempt the same model name.
        // 
        // Actually, for "Manga", Imagen 3 is often better. 
        // Let's stick to the requested model name `gemini-3-pro-image-preview` as the primary attempt, 
        // assuming the user has access or it will become available. 

        const modelName = 'gemini-3-pro-image-preview';

        const generativeModel = vertexAI.getGenerativeModel({ model: modelName });

        const parts: VertexPart[] = [{ text: enhancedPrompt }];
        referenceImages.forEach(img => {
            parts.push(base64ToPart(img.base64, img.type) as VertexPart);
        });

        const req = {
            contents: [{ role: 'user', parts }],
        };

        const result = await generativeModel.generateContent(req);
        const response = await result.response;

        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
                    return part.inlineData.data;
                }
            }
        }
        throw new Error("No image data found in Vertex AI response");
    }

    throw new Error("Invalid provider");
}

export async function generateMangaPromptsAction(
    config: GeminiConfig,
    prompt: string,
    pageCount: number = 1,
    referenceImages: { base64: string; type: string }[] = [],
    isScriptMode: boolean = false
): Promise<string[]> {

    // --- Model Selection ---
    const modelName = 'gemini-3-flash-preview'; // Or gemini-1.5-flash

    // --- System Prompts (Shared) ---
    const styleInstruction = "Manga page. High quality, detailed, anime style.";
    let systemPrompt = "";
    let userContent = "";

    if (isScriptMode) {
        systemPrompt = `
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
        userContent = "\n\nInput Script:\n" + prompt;
    } else {
        // Idea Mode
        systemPrompt = `
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
        4. CRITICAL: If reference images are provided, you MUST EXPLICITLY DESCRIBE their visual appearance in EVERY prompt.
        5. The art style should be consistent: "${styleInstruction}, professional layout".
        6. Output ONLY valid JSON.
      `;
        userContent = "\n\nUser Story Idea:\n" + prompt;
    }

    // --- Google AI Studio ---
    if (config.provider === 'google') {
        if (!config.apiKey) throw new Error("Gemini API Key is required.");

        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const parts: GooglePart[] = [
            { text: systemPrompt },
            { text: userContent }
        ];
        referenceImages.forEach(img => {
            parts.push(base64ToPart(img.base64, img.type) as GooglePart);
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts }]
        });
        const text = result.response.text();
        return parseJsonResult(text);
    }

    // --- Vertex AI ---
    if (config.provider === 'vertex') {
        if (!config.projectId || !config.location) throw new Error("Project ID and Location required for Vertex AI.");

        const vertexAI = new VertexAI({
            project: config.projectId,
            location: config.location,
        });
        const model = vertexAI.getGenerativeModel({ model: modelName });

        const parts: VertexPart[] = [
            { text: systemPrompt },
            { text: userContent }
        ];
        referenceImages.forEach(img => {
            parts.push(base64ToPart(img.base64, img.type) as VertexPart);
        });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts }]
        });
        // Vertex AI SDK response structure is similar but async accessor might differ slightly
        const response = await result.response;
        // Vertex AI response text accessor
        // Often we need to inspect candidates manually effectively
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return parseJsonResult(text);
    }

    throw new Error("Invalid provider");
}


// Helper for JSON parsing
function parseJsonResult(text: string): string[] {
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed) && parsed.every(i => typeof i === 'string')) {
            return parsed;
        }
        throw new Error("Invalid format: Not an array of strings");
    } catch (e) {
        console.error("Failed to parse JSON", text);
        throw new Error("Failed to generate valid prompt structure");
    }
}
