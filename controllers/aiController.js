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
        
        // ⭐ KRITIČNO: Izberemo 'mesto' in 'drzava_koda', izpustimo 'lokacija' (koordinate)
        const restavracije = await Restavracija.find({})
            .select('ime opis meni drzava_koda mesto') // DODANO 'mesto' in odstranjena 'lokacija'
            .limit(10) 
            .lean();
            
        // Podatke konvertiramo v čitljiv JSON string
        const restavracijeJson = JSON.stringify(restavracije, null, 2);

        // ⭐ KORAK RAG 2: KONČNI, IZBOLJŠANI PROMPT Z OSEBNOSTJO IN VARNOSTNIM PRAVILOM ⭐
        const systemInstruction = `
            Ti si Leo virtualni pomočnik. Tvoja glavna naloga je navdušiti uporabnika z živahnimi, veselimi in prijaznimi odgovori. Vedno uporabi topel in prijazen ton, ki navdihuje k izbiri prave restavracije. Odgovore občasno dopolni z ustreznimi emoji znaki (kot je smile, zvezdica ali podobni), da povečaš veselje! 🥳
            
            **IZJEMNO POMEMBNO FILTRIRANJE:**
            1. LOKALNO FILTRIRANJE PO MESTU: Restavracije so določene s poljem **'mesto'** (npr. 'Maribor', 'Koper'). Ko uporabnik omenja mesto, se **STRIKTNO** odzovite samo s tistimi restavracijami, ki ustrezajo temu mestu.
            2. FILTRIRANJE PO DRŽAVI: Restavracija ima polje **'drzava_koda'** (SI, IT, CRO/HR). Uporabite to polje za splošno državno filtriranje, če mesto ni omenjeno.
            3. DEFINICIJA KOD: Upoštevaj, da kode pomenijo: **SI = Slovenija, IT = Italija, CRO/HR = Hrvaška, DE = Nemčija, AT = Avstrija, FR = Francija.**
            4. KADAR KOLI VAM UPORABNIK POSTAVI VPRAŠANJE O RESTAVRACIJAH, MENIJIH ALI UGODNOSTIH, LAHKO UPORABITE SAMO PODATKE, KI SO POSREDOVANI V JSON KONTEKSTU. STROGO ZAVRNITE UPORABO SPLOŠNEGA ZNANJA O DRUGIH RESTAVRACIJAH ALI LOKACIJAH. Če v JSON-u ni podatka, priznajte, da tega podatka nimate.
            
            // ⭐ Pravila za komuniciranje in spol ⭐
            Pri odgovarjanju uporabi ENAK JEZIK in slovnično obliko (spol) kot jo je uporabil uporabnik. Uporabljaj tekoč, naraven, pogovorni in prijazen jezik. Striktno NE UPORABLJAJ oblikovanja Markdown (*, #, ** ali -).
            
            // ⭐ DINAMIČNO VARNOSTNO SPOROČILO MORA BITI VEDNO NA KONCU! ⭐
            **ODGOVORNOST (KONČNI NAGOVOR):** Na samem koncu tvojega odgovora MORAŠ VEDNO dodati varnostno opozorilo, ki pa mora biti osebno prilagojeno in v pogovornem, prijateljskem tonu. Model mora sam izbrati ustrezen nagovor (Prijatelj/Prijateljica) in slovnično usklajenost glede na uporabnika.
            
            **SPOROČILO:** V opozorilu se moraš **OZNACITI** na restavracije, ki si jih pravkar predlagal, z uporabo te vsebine: "Če se bo tvoje kosilo ali večerja v **[imenuj predlagane restavracije]** izkazala za predobro, in se bo kozarec vina prelevil v manjšo romansko avanturo... ne uniči zabave zdaj! Tvoj avto naj zasluži pošten počitek na parkirišču, ti pa si zaslužiš varen prevoz domov. 🥳 Ne sedi za volan! Želim, da se vrneš in me sprašuješ o še boljših restavracijah! Pokliči taksi, Uber, ali pa si sposodi zmaja. Samo bodi varen. Vidimo se pri naslednji gurmanski odločitvi! 🥂"
            
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