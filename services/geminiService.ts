import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GeminiAnalysisResult, Severity } from "../types";

interface FileData {
  base64: string;
  mimeType: string;
}

// Helper to convert file to base64
export const fileToData = (file: File): Promise<FileData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || file.type;

      resolve({ base64, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    wasteType: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of waste types identified (e.g., Plastic, Metal, Wood, Fishing Net).",
    },
    severity: {
      type: Type.STRING,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      description: "The severity level of the pollution.",
    },
    description: {
      type: Type.STRING,
      description: "A short analytical description of the scene.",
    },
    estimatedWeightKg: {
      type: Type.NUMBER,
      description: "Estimated weight of the visible waste in Kilograms.",
    },
    cleanupPriority: {
      type: Type.STRING,
      enum: ["Low", "Medium", "High", "Immediate"],
      description: "Recommended priority for cleanup operations.",
    },
    boundingBoxes: {
      type: Type.ARRAY,
      description: "Bounding boxes for identified waste items. Coordinates must be normalized 0-1000.",
      items: {
        type: Type.OBJECT,
        properties: {
          ymin: { type: Type.NUMBER, description: "Y-min coordinate (0-1000)" },
          xmin: { type: Type.NUMBER, description: "X-min coordinate (0-1000)" },
          ymax: { type: Type.NUMBER, description: "Y-max coordinate (0-1000)" },
          xmax: { type: Type.NUMBER, description: "X-max coordinate (0-1000)" },
          label: { type: Type.STRING, description: "The type of waste in this box (e.g. 'Bottle', 'Net')" }
        },
        required: ["ymin", "xmin", "ymax", "xmax", "label"]
      }
    }
  },
  required: ["wasteType", "severity", "description", "estimatedWeightKg", "cleanupPriority", "boundingBoxes"],
};

export const analyzeWasteMedia = async (fileData: FileData, language: string): Promise<GeminiAnalysisResult> => {
  try {
    /*
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });

    // Prompt customization
    const langPrompt = language === 'ZH'
      ? "請用繁體中文回答。"
      : "Please respond in English.";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: fileData.mimeType, data: fileData.base64 } },
          { text: `${langPrompt} Analyze this coastal waste media. Identify waste types, severity, and cleanup needs. IMPORTANT: Return bounding boxes for specific waste items found in the image. Coordinates must be 0-1000 scale.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.4,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as GeminiAnalysisResult;
    */

    // Convert base64 to blob
    const byteCharacters = atob(fileData.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: fileData.mimeType });

    // Create FormData
    const formData = new FormData();
    formData.append('file', blob, 'waste_image.jpg');
    formData.append('language', language);

    // Call your backend
    const response = await fetch('http://localhost:8000/api/detect', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const result = await response.json();

    // Map backend fields to frontend expected format
    return {
      wasteType: result.wasteType || [result.category],
      category: result.category,
      subCategory: result.subCategory || '',
      severity: result.severity,
      description: result.description,
      estimatedWeightKg: result.estimatedWeightKg,
      cleanupPriority: result.cleanupPriority,
      boundingBoxes: result.boundingBoxes,
      timestamp: result.timestamp
    } as GeminiAnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};