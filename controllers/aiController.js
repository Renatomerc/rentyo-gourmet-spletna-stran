// /controllers/aiController.js

const { GoogleGenAI } = require('@google/genai');

// ⭐ POMEMBNO: Koda bere ključ iz okoljske spremenljivke
const AI_API_KEY = process.env.GEMINI_API_KEY; 

// Inicializacija AI modela
// Ključ je podan tukaj, kar omogoči avtentikacijo pri Googlu
const ai = new GoogleGenAI(AI_API_KEY);

/**
 * Obdeluje POST zahtevo, ki vsebuje vprašanje (prompt),
 * pošlje ga modelu Gemini in vrne odgovor.
 */
exports.askAssistant = async (req, res) => {
    // 1. Pridobitev vprašanja iz telesa zahteve (JSON body)
    const { prompt } = req.body;

    // Varnostna preverba
    if (!prompt) {
        return res.status(400).json({ 
            error: 'Vprašanje (prompt) manjka v telesu zahteve.' 
        });
    }

    try {
        // 2. Definiranje sistemskega konteksta (System Instruction)
        // Ta navodila modelu določijo vlogo. Lahko jih razširite!
        const systemInstruction = `Ti si Rentyo Gourmet virtualni pomočnik. Tvoja naloga je odgovarjanje na vprašanja o restavracijah, rezervacijah in splošnih informacijah, povezanih z aplikacijo. Odgovarjaj v slovenskem jeziku in bodi prijazen.`;

        // 3. Pošiljanje vprašanja modelu Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Hiter in brezplačen model
            
            // Kontekst/navodila za model
            config: {
                systemInstruction: systemInstruction,
            },
            
            // Dejansko vprašanje uporabnika
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const answer = response.text;

        // 4. Vrnemo odgovor nazaj na frontend
        res.json({ answer: answer });
        
    } catch (error) {
        // Če je napaka v API ključu ali omrežju
        if (error.message.includes('API key or project is invalid')) {
            console.error('❌ KRITIČNA NAPAKA: Gemini API ključ je napačen ali manjka!');
        } else {
            console.error('❌ NAPAKA pri klicu Gemini API-ja:', error);
        }
        
        res.status(500).json({ error: 'Napaka strežnika pri generiranju odgovora AI. Preverite API ključ.' });
    }
};