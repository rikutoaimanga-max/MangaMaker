
export async function generateImageVertex(
    prompt: string,
    options: {
        aspectRatio?: string;
        colorMode?: string;
    } = {}
): Promise<string> {
    const response = await fetch('/api/vertex', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt,
            aspectRatio: options.aspectRatio || '2:3',
            colorMode: options.colorMode || 'monochrome',
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Vertex API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.base64; // API returns base64 string
}
