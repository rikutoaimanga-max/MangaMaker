
import { NextResponse } from 'next/server';
import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';

// Disable static optimization since we use env vars and dynamic requests
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { prompt, aspectRatio, colorMode } = await req.json();

        const projectId = process.env.GOOGLE_CLOUD_PROJECT;
        const location = 'us-central1'; // Imagen models are often in us-central1
        const endpointId = 'imagen-3.0-generate-002'; // Publisher model

        if (!projectId) {
            return NextResponse.json({ error: 'Missing GOOGLE_CLOUD_PROJECT' }, { status: 500 });
        }

        // Configure the client
        // Auth is handled automatically by GOOGLE_APPLICATION_CREDENTIALS
        const clientOptions = {
            apiEndpoint: `${location}-aiplatform.googleapis.com`,
        };

        // NOTE: For Imagen 3, we often use the 'predict' method on the Publisher Model endpoint
        // specifically: `projects/${project}/locations/${location}/publishers/google/models/${model}`
        const predictionServiceClient = new PredictionServiceClient(clientOptions);

        const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${endpointId}`;

        // Map aspectRatio to supported values
        // Supported: "1:1", "9:16", "16:9", "3:4", "4:3"
        let targetAspectRatio = "3:4"; // Default

        if (aspectRatio === "1:1") targetAspectRatio = "1:1";
        else if (aspectRatio === "9:16") targetAspectRatio = "9:16";
        else if (aspectRatio === "16:9") targetAspectRatio = "16:9";
        else if (aspectRatio === "3:4") targetAspectRatio = "3:4";
        else if (aspectRatio === "4:3") targetAspectRatio = "4:3";
        else if (aspectRatio === "2:3") targetAspectRatio = "3:4"; // Map 2:3 to 3:4
        else if (aspectRatio === "3:2") targetAspectRatio = "4:3"; // Map 3:2 to 4:3

        console.log(`[Vertex] Mapping aspect ratio: ${aspectRatio} -> ${targetAspectRatio}`);

        // Construct request parameters
        // Ref: https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images
        const parameters = helpers.toValue({
            sampleCount: 1,
            aspectRatio: targetAspectRatio,
            addWatermark: false,
        });

        // Modify prompt for strict monochrome if needed
        let finalPrompt = prompt;
        if (colorMode === 'monochrome') {
            finalPrompt = `[STRICT: BLACK AND WHITE ONLY. NO COLORS.] ` + prompt + ` \nStyle: Black and White Manga, greyscale, monochrome, no color, high contrast ink drawing, screen tones.`;
        } else if (colorMode === 'color') {
            finalPrompt += ` \nStyle: Full Color Manga, vibrant, anime style.`;
        }

        // Also append 2K quality hint if not already present
        finalPrompt += ` \nQuality: Masterpiece, High Definition, 2K resolution.`;

        const instance = helpers.toValue({
            prompt: finalPrompt,
        });

        const request = {
            endpoint,
            instances: [instance],
            parameters,
        };

        const [response] = await predictionServiceClient.predict(request);

        if (!response.predictions || response.predictions.length === 0) {
            throw new Error('No predictions returned');
        }

        // Extract base64 image
        const prediction = response.predictions[0];
        if (!prediction) {
            throw new Error('Empty prediction');
        }

        // Helper to unwrap value
        // The response structure for Imagen is usually { bytesBase64Encoded: string } or similar inside the struct value
        // But `helpers.fromValue` can help, or we verify the structure.
        // Usually prediction is a Protobuf Value.

        // Let's assume prediction comes as structValue.fields
        // For Imagen: { bytesBase64Encoded: "..." }
        // Using `helpers.fromValue(prediction)` returns the plain JS object.
        const predictionObj = helpers.fromValue(prediction) as any;
        const base64Image = predictionObj.bytesBase64Encoded;

        if (!base64Image) {
            throw new Error('No image bytes in response');
        }

        return NextResponse.json({ base64: base64Image });

    } catch (error) {
        console.error('Vertex AI API Error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
