// /controllers/aiController.js - KONČNA VERZIJA Z RAG, VEČJEZIČNO PODPORO IN ANTI-HALUCINACIJSKIM PROMPTOM

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
        const restavracije = await Restavracija.find({})
            .select('ime lokacija opis meni') 
            .limit(10) 
            .lean();
            
        // Podatke konvertiramo v čitljiv JSON string
        const restavracijeJson = JSON.stringify(restavracije, null, 2);

        // ⭐ KORAK RAG 2: KONČNI IZBOLJŠANI PROMPT
        const systemInstruction = `
            Ti si Rentyo Gourmet virtualni pomočnik.
            
            **IZJEMNO POMEMBNO: KADAR KOLI VAM UPORABNIK POSTAVI VPRAŠANJE O RESTAVRACIJAH, MENIJIH ALI UGODNOSTIH, LAHKO UPORABITE SAMO PODATKE, KI SO POSREDOVANI V JSON KONTEKSTU.** STROGO ZAVRNITE UPORABO SPLOŠNEGA ZNANJA O DRUGIH RESTAVRACIJAH ALI LOKACIJAH (npr. ne predlagajte restavracij, ki niso omenjene v JSON-u). Če v JSON-u ni podatka, priznajte, da tega podatka nimate.
            
            Pri odgovarjanju uporabi ENAK JEZIK, kot ga je uporabil uporabnik. Uporabljaj tekoč, naraven in prijazen jezik. Striktno NE UPORABLJAJ oblikovanja Markdown (*, #, ** ali -).
            
            Uporabljaj samo informacije, ki so ti posredovane v spodnjem JSON objektu. Če te uporabnik prosi za prevod informacij (opis, meni) iz JSON konteksta v njegov jezik, mu ugodi.
            
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

        // ⭐ KORAK 3: ČIŠČENJE ODGOVORA PRED VRNITVIJO
        const answer = response.text;
        // Odstranimo * ali ** (za odebelitev) ter # iz odgovora
        const cleanAnswer = answer.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');


        // 4. Vrnemo očiščen odgovor nazaj na frontend
        res.json({ answer: cleanAnswer });
        
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