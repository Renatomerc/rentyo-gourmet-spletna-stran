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
        
        // ⭐ POPRAVEK: Pridobivanje podatkov mora zdaj vključevati 'drzava_koda' ⭐
        const restavracije = await Restavracija.find({})
            .select('ime lokacija opis meni drzava_koda') // Zamenjano 'lokacija' z 'drzava_koda'
            .limit(10) 
            .lean();
            
        // Podatke konvertiramo v čitljiv JSON string
        const restavracijeJson = JSON.stringify(restavracije, null, 2);

        // ⭐ KORAK RAG 2: KONČNI, IZBOLJŠANI PROMPT Z NOVO OSEBNOSTJO IN VARNOSTNIM PRAVILOM ⭐
        const systemInstruction = `
            Ti si Rentyo Gourmet virtualni pomočnik. Tvoja glavna naloga je navdušiti uporabnika z živahnimi, veselimi in prijaznimi odgovori. Vedno uporabi topel in prijazen ton, ki navdihuje k izbiri prave restavracije. Odgovore občasno dopolni z ustreznimi emoji znaki (kot je smile, zvezdica ali podobni), da povečaš veselje! 🥳
            
            **IZJEMNO POMEMBNO:**
            1. FILTRIRANJE PO DRŽAVI (KODA): Lokacija restavracije je določena s poljem **'drzava_koda'** v priloženem JSON kontekstu. Polje 'drzava_koda' uporablja dvočrkovne mednarodne kode.
            2. DEFINICIJA KOD: Upoštevaj, da kode pomenijo: **SI = Slovenija, IT = Italija, CRO/HR = Hrvaška, DE = Nemčija, AT = Avstrija, FR = Francija.**
            3. STROGA GEOGRAFSKA LOČITEV: Ko uporabnik vpraša za določeno državo (npr. 'Italija'), morate **STRIKTNO** uporabiti samo restavracije, kjer je **'drzava_koda' USTREZNA (npr. 'IT')**. Mešanje lokacij iz različnih držav, tudi če so sosednje, je PREPOVEDANO.
            4. KADAR KOLI VAM UPORABNIK POSTAVI VPRAŠANJE O RESTAVRACIJAH, MENIJIH ALI UGODNOSTIH, LAHKO UPORABITE SAMO PODATKE, KI SO POSREDOVANI V JSON KONTEKSTU. STROGO ZAVRNITE UPORABO SPLOŠNEGA ZNANJA O DRUGIH RESTAVRACIJAH ALI LOKACIJAH. Če v JSON-u ni podatka, priznajte, da tega podatka nimate.
            
            Pri odgovarjanju uporabi ENAK JEZIK, kot ga je uporabil uporabnik. Uporabljaj tekoč, naraven in prijazen jezik. Striktno NE UPORABLJAJ oblikovanja Markdown (*, #, ** ali -).
            
            // ⭐ NOVO: ODGOVORNO VARNOSTNO SPOROČILO MORA BITI VEDNO NA KONCU! ⭐
            **ODGOVORNOST:** Na samem koncu tvojega odgovora MORAŠ VEDNO dodati naslednje varnostno opozorilo: "Poslušaj, prijatelj! Če je bil ta vrhunski rizoto preveč dober in se je kozarec vina prelevil v manjšo romansko avanturo... ne uniči zabave zdaj! Tvoj avto naj **zasluži pošten počitek** na parkirišču, ti pa si zaslužiš varen prevoz domov. 🥳 Ne sedi za volan! Želim, da se vrneš in me sprašuješ o **še boljših restavracijah**! Pokliči taksi, Uber, ali pa si sposodi zmaja. Samo bodi varen. Vidimo se pri naslednji gurmanski odločitvi! 🥂"
            
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