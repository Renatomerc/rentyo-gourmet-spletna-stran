// /controllers/aiController.js - KONČNA VERZIJA Z RAG, VEČJEZIČNO PODPORO IN GEOLOKACIJO

const { GoogleGenAI } = require('@google/genai');
// ⭐ Uvoz Mongoose modela za dostop do kolekcije 'restavracijas'
const Restavracija = require('../models/Restavracija'); 

// 🛑 Odstranjena inicializacija 'ai' in 'AI_API_KEY' na najvišji ravni modula, 
// da se prepreči napaka 'undefined' ob zagonu strežnika.

/**
 * Obdeluje POST zahtevo, ki vsebuje vprašanje (prompt) in (opcijsko) lokacijo.
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

    // 1. Pridobitev vprašanja, Latitude in Longitude iz telesa zahteve (JSON body)
    const { prompt, userLat, userLon } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ 
            error: 'Vprašanje (prompt) manjka v telesu zahteve.' 
        });
    }

    try {
        
        let restavracije;
        const searchRadiusKm = 50; // Iskanje restavracij v radiju 50 km

        // ⭐ KORAK GEOLOKACIJA: Preverimo, ali sta lokacija in koordinate prisotne
        if (userLat !== undefined && userLon !== undefined) {
             
             // GeoJSON standard: [Longitude, Latitude]
             const centerCoords = [userLon, userLat]; 
             
             // 🔴 KORAK 1: Izvedi Geo search glede na uporabnikovo lokacijo
             restavracije = await Restavracija.aggregate([
                 {
                     $geoNear: {
                         near: { type: 'Point', coordinates: centerCoords },
                         distanceField: 'razdalja_m', // Razdalja v metrih
                         maxDistance: searchRadiusKm * 1000, 
                         spherical: true,
                         key: 'lokacija' // Uporablja vaše polje 'lokacija'
                     }
                 },
                 {
                     $project: {
                         _id: 1, ime: 1, opis: 1, meni: 1, drzava_koda: 1, mesto: 1
                         // 'razdalja_m' je sedaj vključena
                     }
                 },
                 { $limit: 10 }
             ]);
             
             console.log(`✅ MongoDB Geo Search uspešno izveden okoli uporabnikove lokacije.`);
             
        } else {
            // ⚪ KORAK 2: Standardni search (če lokacija ni poslana ali je nedovoljena)
            
            // ⭐ KRITIČNO: Izberemo 'mesto' in 'drzava_koda', izpustimo 'lokacija' (koordinate)
            restavracije = await Restavracija.find({})
                .select('ime opis meni drzava_koda mesto')
                .limit(10) 
                .lean();
        }
            
        // Podatke konvertiramo v čitljiv JSON string
        const restavracijeJson = JSON.stringify(restavracije, null, 2);

        // ⭐ KORAK RAG 2: KONČNI, IZBOLJŠANI PROMPT S FOKUSOM NA NARAVEN POGOVOR ⭐
        const systemInstruction = `
            Ti si Leo virtualni pomočnik. Tvoja glavna naloga je pomagati uporabniku pri izbiri restavracij kot **izjemno naraven, pogovoren in informiran človeški strokovnjak.**
            
            // ⭐ KLJUČNO VEČJEZIČNO PRAVILO ⭐
            **Jezik odgovora mora biti STRIKTNO enak jeziku in slovnični obliki (spol, vljudnost) kot ju je uporabil uporabnik v svojem vprašanju (promptu).**

            **Pravila za ton in dolžino:**
            1.  Bodi kratk, jedrnat in neposreden. Izogibaj se nepotrebni vljudnosti.
            2.  Nikoli ne zveni kot robot ali sistem, ki prebira navodila. **Odgovarjaj tekoče, kot da bi se pogovarjal v živo.**
            3.  **NE UPORABLJAJ nobenih emoji znakov.**
            4.  Striktno NE UPORABLJAJ oblikovanja Markdown (*, #, ** ali -).

            **IZJEMNO POMEMBNO FILTRIRANJE (Vir znanja):**
            1. LOKALNO FILTRIRANJE PO MESTU: Restavracije so določene s poljem **'mesto'** (npr. 'Maribor', 'Koper'). Ker so restavracije sedaj že **filtrirane po geografski bližini (če je lokacija uporabnika znana)**, lahko predlagaš tudi restavracije iz drugih mest/držav, če so v filtru (npr. Trst blizu Kopra).
            2. FILTRIRANJE PO DRŽAVI: Restavracija ima polje **'drzava_koda'** (SI, IT, CRO/HR). Uporabite to polje za splošno državno filtriranje, če mesto ni omenjeno.
            3. DEFINICIJA KOD: Upoštevaj, da kode pomenijo: **SI = Slovenija, IT = Italija, CRO/HR = Hrvaška, DE = Nemčija, AT = Avstrija, FR = Francija.**
            4. KADAR KOLI VAM UPORABNIK POSTAVI VPRAŠANJE O RESTAVRACIJAH, MENIJIH ALI UGODNOSTIH, LAHKO UPORABITE SAMO PODATKE, KI SO POSREDOVANI V JSON KONTEKSTU. STROGO ZAVRNITE UPORABO SPLOŠNEGA ZNANJA O DRUGIH RESTAVRACIJAH ALI LOKACIJAH. Če v JSON-u ni podatka, priznajte, da tega podatka nimate.
            
            
            // ⭐ ZAKLJUČEK POGOVORA (naraven tok) ⭐
            
            **POTRDITEV:** Takoj po tem, ko podaš odgovor, moraš na naraven in pogovoren način vprašati uporabnika, ali ti lahko še kaj pomagaš (npr. "Je to to, kar ste iskali?", "Potrebujete še kakšno informacijo?"). **To potrditev prevedi v jezik uporabnikovega vprašanja.**
            
            **KONČNI NAGOVOR Z OPOZORILOM (KLJUČNO PRAVILO):** To varnostno opozorilo je namenjeno le zaključku celotne interakcije. To opozorilo dodaj kot zadnji stavek SAMO in izključno, če:
            a) Je uporabnikov vnos zelo kratek in kaže na zaključek ali potrditev (npr. 'Hvala', 'To je to', 'V redu').
            ALI
            b) Če je tvoj odgovor dolg in vseobsegajoč, in je verjetnost, da je to konec pogovora, visoka.
            
            V primeru, da uporabnik postavi novo, nadaljnje vprašanje o restavracijah, opozorila NE DODAJ.
            
            // ⭐ KLJUČNO POPRAVILO: OPOZORILO MORA BITI VEČJEZIČNO ⭐
            **VSEBINA OPOZORILA (PREVOD):** Če je vključen, model mora izbrati ustrezen nagovor (Prijatelj/Prijateljica/Friend) in slovnično usklajenost glede na uporabnika. Uporabi točno to vsebino, prevedeno v jezik uporabnikovega vprašanja: 
            
            * **SLOVENSKO:** "Prijatelj/Prijateljica, če se bo tvoje kosilo ali večerja v **[imenuj predlagane restavracije]** izkazala za predobro in bo kozarec vina vodil v romantično avanturo, se za volan ne usedi. Pokliči prevoz. Želim, da se vrneš in me sprašuješ o še boljših restavracijah! Samo bodi varen. Vidimo se pri naslednji gurmanski odločitvi!"
            
            * **ANGLEŠKO:** "Friend, if your lunch or dinner at **[name suggested restaurants]** turns out to be too good and a glass of wine leads to a romantic adventure, do not drive. Call a ride. I want you to come back and ask me about even better restaurants! Just be safe. See you at the next gourmet decision!"
            
            --- ZNANJE IZ BAZE (RESTAVRACIJ/MENIJEV) ---
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
            // Preverjanje za geoNear napako
            if (error.message.includes('$geoNear')) {
                 console.error('❌ NAPAKA: Geolokacijska poizvedba je propadla. Je na polju "lokacija" v MongoDB nastavljen 2dsphere indeks?', error);
            } else {
                 console.error('❌ NAPAKA PRI klicu Gemini API-ja z RAG poizvedbo:', error);
            }
        }
        
        res.status(500).json({ error: 'Napaka strežnika pri generiranju odgovora AI. Preverite API ključ in MongoDB indeks.' });
    }
};