
export async function generateImageFal(
    apiKey: string,
    prompt: string,
    options: {
        aspectRatio?: string;
        width?: number;
        height?: number;
        model?: string;
    } = {}
): Promise<string> {
    const model = options.model || "fal-ai/flux/dev";

    // Enhance prompt
    let enhancedPrompt = prompt;

    // Default Style
    enhancedPrompt += " \nStyle: Manga style, anime style, high quality.";

    // Resolve resolution from options or aspect ratio
    // Defaults
    let imageSize = { width: 1024, height: 1024 };

    if (options.width && options.height) {
        imageSize = { width: options.width, height: options.height };
    } else if (options.aspectRatio) {
        switch (options.aspectRatio) {
            case "2:3": imageSize = { width: 832, height: 1216 }; break; // FLUX recommended ~1MP
            case "3:2": imageSize = { width: 1216, height: 832 }; break;
            case "16:9": imageSize = { width: 1360, height: 768 }; break;
            case "9:16": imageSize = { width: 768, height: 1360 }; break;
            case "1:1": default: imageSize = { width: 1024, height: 1024 }; break;
        }

        // FLUX Pro/Dev/Schnell support flexible resolutions.
        // User specifically asked for ~2K (1696x2528) for 2:3.
        // Let's support high res if requested.
        if (options.aspectRatio === "2:3" && prompt.includes("Resolution: 2K")) {
            imageSize = { width: 1696, height: 2528 };
        }
    }

    const response = await fetch(`https://fal.run/${model}`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: prompt,
            image_size: {
                width: imageSize.width,
                height: imageSize.height
            },
            num_inference_steps: 4, // Schnell defaults
            enable_safety_checker: false
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fal.ai Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // Fal returns { images: [ { url: "...", width: ..., height: ... } ] }
    if (data.images && data.images.length > 0) {
        // Need to fetch the image and convert to base64 to match our app's flow (storing base64)
        // OR update app to handle URLs.
        // Current app expects `data:image/png;base64,` prefix in `generatedImages` state? 
        // app/page.tsx: `const imageUrl = data:image/png;base64,${base64Image};`
        // So checking generateImage return type... it returns Promise<string> (base64 data body).

        const imageUrl = data.images[0].url;
        const imgRes = await fetch(imageUrl);
        const blob = await imgRes.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    throw new Error("No image returned from Fal.ai");
}
