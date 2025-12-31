import { openai } from "../replit_integrations/image/client";

const TRAVEL_GRADIENTS = [
  "#667eea,#764ba2",
  "#f093fb,#f5576c",
  "#4facfe,#00f2fe",
  "#43e97b,#38f9d7",
  "#fa709a,#fee140",
  "#a8edea,#fed6e3",
  "#ff9a9e,#fecfef",
  "#ffecd2,#fcb69f",
  "#48c6ef,#6f86d6",
  "#FF385C,#FF6B8A",
];

function getRandomGradient(): string {
  return TRAVEL_GRADIENTS[Math.floor(Math.random() * TRAVEL_GRADIENTS.length)];
}

export async function generateCollectionThumbnail(
  collectionName: string
): Promise<{ coverImage: string | null; coverGradient: string | null }> {
  console.log(`[Thumbnail] Starting generation for: "${collectionName}"`);
  try {
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You analyze collection names to determine if they represent a meaningful travel destination or theme.
Respond with JSON only: { "isMeaningful": boolean, "imagePrompt": string | null }
- isMeaningful: true if the name represents a real place, country, city, travel theme, or identifiable concept
- imagePrompt: if meaningful, provide a short prompt for generating a beautiful travel thumbnail image (landscape style, scenic, travel photography aesthetic)
- Examples of meaningful: "Japan Trip 2024", "Paris Adventures", "Beach Vacations", "Italian Food Tour", "Mountain Hiking"
- Examples of NOT meaningful: "asdf", "test123", "Collection 1", "untitled", random characters`,
        },
        {
          role: "user",
          content: `Analyze this collection name: "${collectionName}"`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 200,
    });

    const analysis = JSON.parse(
      analysisResponse.choices[0]?.message?.content || "{}"
    );
    console.log(`[Thumbnail] Analysis result:`, analysis);

    if (!analysis.isMeaningful || !analysis.imagePrompt) {
      const gradient = getRandomGradient();
      console.log(`[Thumbnail] Using gradient fallback: ${gradient}`);
      return {
        coverImage: null,
        coverGradient: gradient,
      };
    }
    
    console.log(`[Thumbnail] Generating image for prompt: "${analysis.imagePrompt}"`)

    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `${analysis.imagePrompt}. Beautiful travel photography style, scenic landscape, vibrant colors, professional quality, 16:9 aspect ratio composition`,
      size: "1024x1024",
    });

    const base64 = imageResponse.data[0]?.b64_json;
    if (base64) {
      console.log(`[Thumbnail] Image generated successfully (${base64.length} chars)`);
      return {
        coverImage: `data:image/png;base64,${base64}`,
        coverGradient: null,
      };
    }

    console.log(`[Thumbnail] No image data received, using gradient fallback`);
    return {
      coverImage: null,
      coverGradient: getRandomGradient(),
    };
  } catch (error) {
    console.error("[Thumbnail] Error generating thumbnail:", error);
    return {
      coverImage: null,
      coverGradient: getRandomGradient(),
    };
  }
}
