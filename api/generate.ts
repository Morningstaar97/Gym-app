import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { prompt } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "Clé API non configurée sur le serveur." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("L'IA n'a pas renvoyé de texte.");
    }
    
    // Nettoyage robuste du JSON
    let cleanJson = text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '');
    }
    
    // Sécurité supplémentaire : extraire uniquement ce qui est entre { et }
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
    }
    
    try {
      const parsedData = JSON.parse(cleanJson);
      res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("JSON Parse Error. Content:", cleanJson);
      res.status(500).json({ error: "L'IA a généré une réponse malformée. Veuillez réessayer." });
    }
  } catch (error) {
    console.error("Erreur API Gemini:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    res.status(500).json({ error: `Erreur serveur: ${message}` });
  }
}
