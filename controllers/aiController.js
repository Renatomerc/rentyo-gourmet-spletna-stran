// /controllers/aiController.js - KONČNA VERZIJA Z RAG IN DOSTOPOM DO MENIJEV

const { GoogleGenAI } = require('@google/genai');
// ⭐ Uvoz Mongoose modela za dostop do kolekcije 'restavracijas'
const Restavracija = require('../models/Restavracija'); 

// 🛑 Odstranjena inicializacija 'ai' in 'AI_API_KEY' na najvišji ravni modula, 
// da se prepreči napaka 'undefined' ob zagonu strežnika.

/**
 * Obdeluje POST zahtevo, ki vsebuje vprašanje (prompt),
 * pošlje ga modelu Gemini in vrne odgovor, obogaten z MongoDB podatki.
 */
exports.askAssistant = async (req, res) => {
    
    // Ključ in Inicializacija se preverita/zgodita šele ZNOTRAJ funkcije
    const AI_API_KEY = process.env.GEMINI_API_KEY; 

    if (!AI_API_KEY) {
         // Če ključa ni, vrnemo napako strežnika takoj
         console.error('❌ KRITIČNA NAPAKA: Ključ GEMINI_API_KEY ni nastavljen.');
         return res.status(500).json({ error: 'Napaka strežnika: AI storitev ni pravilno konfigurirana.' });
    }
    
    // Inicializacija AI modela (zdaj varno znotraj funkcije)
    const ai = new GoogleGenAI(AI_API_KEY); 

    // 1. Pridobitev vprašanja iz telesa zahteve (JSON body)
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ 
            error: 'Vprašanje (prompt) manjka v telesu zahteve.' 
        });
    }

    try {
        
        // ⭐ KORAK RAG 1: Pridobivanje podatkov z MENIJI
        // Poizvedba uporablja model Restavracija, ki je vezan na kolekcijo 'restavracijas'.
        const restavracije = await Restavracija.find({})
            // ⭐ DODANO/POPRAVLJENO: Vključimo polje 'meni'
            .select('ime lokacija opis meni') 
            .limit(10) 
            .lean();
            
        // Podatke konvertiramo v čitljiv JSON string
        const restavracijeJson = JSON.stringify(restavracije, null, 2);

        // ⭐ KORAK RAG 2: Izdelava VODILNEGA PROMPTA (z opozorilom na meni)
        const systemInstruction = `
            Ti si Rentyo Gourmet virtualni pomočnik. 
            Odgovarjaj na vprašanja uporabnika v slovenskem jeziku, bodi prijazen in strokoven.
            
            **Uporabljaj samo informacije, ki so ti posredovane v spodnjem JSON objektu. Ta JSON vsebuje tudi podatke o jedeh v polju 'meni'.**
            
            Če te uporabnik vpraša po jedeh, ki jih ponujajo restavracije (npr. 'hamburger', 'pizza', 'vegetarijansko'), prebrskaj polje 'meni' in predlagaj ustrezne restavracije.
            
            --- ZNANJE IZ BAZE (RESTAVRACIJE & MENIJI) ---
            ${restavracijeJson}
            --- KONEC ZNANJA IZ BAZE ---
        `;

        // 3. Pošiljanje vprašanja modelu Gemini
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            
            config: {
                systemInstruction: systemInstruction,
            },
            
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const answer = response.text;

        // 4. Vrnemo odgovor nazaj na frontend
        res.json({ answer: answer });
        
    } catch (error) {
        // Če je napaka v API ključu ali omrežju
        if (error.message.includes('API key or project is invalid')) {
            console.error('❌ KRITIČNA NAPAKA: Gemini API ključ je napačen ali manjka! (Znotraj klica)');
        } else {
            console.error('❌ NAPAKA pri klicu Gemini API-ja z RAG poizvedbo:', error);
        }
        
        res.status(500).json({ error: 'Napaka strežnika pri generiranju odgovora AI. Preverite API ključ.' });
    }
};