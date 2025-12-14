// /controllers/aiController.js - KONČNA VERZIJA Z RAG, VEČJEZIČNO PODPORO IN GEOLOKACIJO

const { GoogleGenAI } = require('@google/genai');
// ⭐ Uvoz Mongoose modela za dostop do kolekcije 'restavracijas'
const Restavracija = require('../models/Restavracija'); 
// 🔥 Potrebujemo Mongoose za delo z ID-ji in agregacijo
const mongoose = require('mongoose'); 

// 🛑 Odstranjena inicializacija 'ai' in 'AI_API_KEY' na najvišji ravni modula, 
// da se prepreči napaka 'undefined' ob zagonu strežnika.

/**
 * Obdeluje POST zahtevo, ki vsebuje vprašanje (prompt), jezik (languageCode) in (opcijsko) lokacijo.
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

    // 1. Pridobitev vprašanja, Latitude, Longitude IN JEZIKA iz telesa zahteve (JSON body)
    const { prompt, userLat, userLon, languageCode } = req.body; // ⭐ DODANO: languageCode
    
    // Privzeti jezik, če koda manjka (čeprav bi jo moral poslati frontend)
    const lang = languageCode || 'sl';
    // 🔥 Določitev današnjega datuma za preverjanje obremenjenosti
    const defaultDatum = new Date().toISOString().substring(0, 10); 

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
                         _id: 1, ime: 1, opis: 1, meni: 1, drzava_koda: 1, mesto: 1, delovniCasStart: 1, delovniCasEnd: 1
                         // 'razdalja_m' je sedaj vključena
                     }
                 },
                 { $limit: 10 }
             ]);
             
             console.log(`✅ MongoDB Geo Search uspešno izveden okoli uporabnikove lokacije.`);
             
        } else {
            // ⚪ KORAK 2: Standardni search (če lokacija ni poslana ali je nedovoljena)
            
            // ⭐ KRITIČNO: Izberemo delovni čas
            restavracije = await Restavracija.find({})
                .select('ime opis meni drzava_koda mesto delovniCasStart delovniCasEnd')
                .limit(10) 
                .lean();
        }
            
        // --------------------------------------------------------------------------------
        // 🔥🔥🔥 KORAK 3: AGREGACIJA ZA ŠTETJE AKTIVNIH REZERVACIJ DANES 🔥🔥🔥
        // --------------------------------------------------------------------------------
        const restavracijeIds = restavracije.map(r => r._id);
        let obremenjenostPodatki = [];
        
        if (restavracijeIds.length > 0) {
            
             obremenjenostPodatki = await Restavracija.aggregate([
                 { 
                     // Filtriramo restavracije, ki so bile že najdene z zgornjim iskanjem
                     $match: { _id: { $in: restavracijeIds } } 
                 },
                 {
                     // Odvijemo mize in rezervacije, da lahko filtriramo in štejemo
                     $unwind: { path: "$mize", preserveNullAndEmptyArrays: true }
                 },
                 {
                     $unwind: { path: "$mize.rezervacije", preserveNullAndEmptyArrays: true }
                 },
                 {
                     // Filtriramo samo AKTIVNE rezervacije za današnji datum
                     $match: { 
                         $or: [
                             // Vključi dokument, če rezervacije.casStart sploh ni (torej ni rezervacij)
                             { "mize.rezervacije.casStart": { $exists: false } }, 
                             // ALI, če je rezervacija DANES in ni PREKLICANA/ZAKLJUČENA
                             { 
                                 "mize.rezervacije.datum": defaultDatum,
                                 "mize.rezervacije.status": { $nin: ['PREKLICANO', 'ZAKLJUČENO'] } 
                             }
                         ]
                     }
                 },
                 {
                     // Združevanje po _id restavracije in štetje AKTIVNIH rezervacij danes
                     $group: {
                         _id: "$_id",
                         // Shranimo le ključne informacije, ki jih potrebujemo (ID, število)
                         st_aktivnih_rezervacij_danes: { 
                             $sum: { $cond: [ 
                                 { $eq: ["$mize.rezervacije.datum", defaultDatum] }, 
                                 1, // Povečaj števec, če se datum ujema (aktivna rezervacija)
                                 0 
                             ]} 
                         }
                     }
                 }
             ]);

             console.log(`✅ MongoDB Agregacija obremenjenosti uspešno izvedena.`);
        }

        // 🔥 LOGIKA ZA IZRAČUN IN OCENO ZASEDENOSTI 🔥
        const povprecnoTrajanjeRezervacije = 1.5; // Predpostavka: 1.5 ure na rezervacijo
        const steviloSkupnihMiz = 5; // Privzeta predpostavka o številu miz v restavraciji
        
        // Združitev in obdelava podatkov za RAG
        const restavracijeZaRAG = restavracije.map(rest => {
            const obremenitev = obremenjenostPodatki.find(o => o._id.toString() === rest._id.toString());
            
            // 1. Pridobitev podatkov
            const delovniCasStart = rest.delovniCasStart || 10;
            const delovniCasEnd = rest.delovniCasEnd || 24;
            const stAktivnihRezervacij = obremenitev ? obremenitev.st_aktivnih_rezervacij_danes : 0;
            
            // 2. Izračun potencialne kapacitete (maks. rezervacij)
            const delovneUre = delovniCasEnd - delovniCasStart;
            
            // Maksimalno število rezervacij na VSE mize za cel dan (teoretično)
            const maxRezervacijNaVseMize = Math.floor((delovneUre / povprecnoTrajanjeRezervacije) * steviloSkupnihMiz); 
            
            // 3. Izračun obremenjenosti (%)
            const odstotekZasedenosti = maxRezervacijNaVseMize > 0 
                ? Math.round((stAktivnihRezervacij / maxRezervacijNaVseMize) * 100) 
                : 0;

            let ocenaZasedenostiTekst;
            if (stAktivnihRezervacij === 0) {
                ocenaZasedenostiTekst = "Popolnoma prosto (0 rezervacij).";
            } else if (odstotekZasedenosti < 30) {
                ocenaZasedenostiTekst = `Nizka obremenjenost (cca ${odstotekZasedenosti}% teoretične kapacitete).`;
            } else if (odstotekZasedenosti < 70) {
                ocenaZasedenostiTekst = `Zmerna obremenjenost (cca ${odstotekZasedenosti}% teoretične kapacitete).`;
            } else {
                ocenaZasedenostiTekst = `Visoka obremenjenost (cca ${odstotekZasedenosti}% teoretične kapacitete). Zelo zasedeno!`;
            }

            return {
                ime: rest.ime,
                opis: rest.opis,
                meni: rest.meni,
                mesto: rest.mesto,
                drzava_koda: rest.drzava_koda,
                // ⭐ NOVO: Združeno polje za delovni čas (za lažjo uporabo v RAG)
                delovniCas: `${delovniCasStart}h do ${delovniCasEnd}h`, 
                // ⭐ NOVO: Tekstualna ocena obremenjenosti
                ocenaZasedenostiDanes: ocenaZasedenostiTekst,          
                // Odstranimo 'delovniCasStart' in 'delovniCasEnd' iz končnega JSON-a, da je bolj čist
            };
        });
        
        const finalRestavracijeJson = JSON.stringify(restavracijeZaRAG, null, 2);
        
        // --------------------------------------------------------------------------------
        // 🔥🔥🔥 KONEC KORAKA ZA OBREMENJENOST IN OCENO 🔥🔥🔥
        // --------------------------------------------------------------------------------

        // ⭐ Določitev vsebine opozorila glede na prejeto kodo jezika (lang) ⭐
        let finalWarningText;
        if (lang.startsWith('en')) { // 'en' ali 'en-US'
            finalWarningText = `Friend, if your lunch or dinner at **[name suggested restaurants]** turns out to be too good and a glass of wine leads to a romantic adventure, do not drive. Call a ride. I want you to come back and ask me about even better restaurants! Just be safe. See you at the next gourmet decision!`;
        } else {
            // Slovenski ali privzeti jezik ('sl', 'de' ipd. naj se prevedejo sami, 
            // vendar za slovensko damo eksplicitno navodilo)
            finalWarningText = `Prijatelj/Prijateljica, če se bo tvoje kosilo ali večerja v **[imenuj predlagane restavracije]** izkazala za predobro in bo kozarec vina vodil v romantično avanturo, se za volan ne usedi. Pokliči prevoz. Želim, da se vrneš in me sprašuješ o še boljših restavracijah! Samo bodi varen. Vidimo se pri naslednji gurmanski odločitvi!`;
        }


        // ⭐ KORAK RAG 2: KONČNI, IZBOLJŠANI PROMPT S FOKUSOM NA NARAVEN POGOVOR ⭐
        const systemInstruction = `
            Ti si Leo virtualni pomočnik. Tvoja glavna naloga je pomagati uporabniku pri izbiri restavracij kot **izjemno naraven, pogovoren in informiran človeški strokovnjak.**
            
            // ⭐ KLJUČNO VEČJEZIČNO PRAVILO - OKREPLJENO ⭐
            **STRIKTNO in IZKLJUČNO odgovarjaj v jeziku s kodo: ${lang} (npr. 'sl' za slovenščino, 'en' za angleščino).**
            
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
            
            // 🔥 NOVO: PRAVILA ZA RAZPOLOŽLJIVOST (OBREMENJENOST)
            **PRAVILA ZA RAZPOLOŽLJIVOST (Obremenjenost):**
            1.  Delovni čas je določen z **delovniCas** (npr. "10h do 24h").
            2.  Oceno zasedenosti poišči v polju **ocenaZasedenostiDanes**. Ta ocena temelji na številu rezervacij za danes.
            3.  Če uporabnik sprašuje o razpoložljivosti:
                a) Uporabi **ocenaZasedenostiDanes** za opis, kako je v restavraciji zasedeno.
                b) **STRIKTNO OPOZORI UPORABNIKA**, da je ta ocena zgolj informativna in da mora **vedno in izključno** preveriti *točno* prosto mizo in čas v sekciji 'Rezervacije' v aplikaciji pod izbrano restavracijo, saj samo tam lahko vidi realno prekrivanje ur.
            4.  Vedno omenite delovni čas.

            
            // ⭐ NOVO: KONTEKSTUALNO ZNANJE O APLIKACIJI (FAQ) ⭐
            // Tvoja primarna baza znanja za pravila platforme... (ostane enako)
            // -------------------------------------------------------------
            // ZNANJE O PLATFORMI RENTYO GOURMET & EXPERIENCE (FAQ):
            // - NO-SHOW POLITIKA: Uporabnika, ki dvakrat rezervira in se ne prikaže/ne potrdi prihoda z QR kodo, lahko platforma odstrani. Odstranitev pomeni izgubo vseh zbranih točk, ki jih ni možno povrniti. Platforma lahko zahteva tudi vpis veljavne kreditne kartice kot zavarovanje pri naslednjih rezervacijah.
            // - TOČKE: Točke služijo kot nagrada za rezervacijo in dejanski prihod. Omogočajo sodelovanja v nagradnih igrah, posebnih povabilih v izbrane restavracije in dogodke. Točke niso zamenljive za denar.
            // - PREKLIC REZERVACIJE: Preklic je možen preko linka v potrditvenem mailu ali v sekciji 'Moje rezervacije'.
            // - KONTAKT ZA POMOČ: Za tehnično podporo in vprašanja se lahko uporabniki obrnejo na podporo preko e-pošte support@rentyo.eu.
            // -------------------------------------------------------------
            
            
            // ⭐ ZAKLJUČEK POGOVORA (naraven tok) ⭐
            
            **POTRDITEV:** Takoj po tem, ko podaš odgovor, moraš na naraven in pogovoren način vprašati uporabnika, ali ti lahko še kaj pomagaš. **To vprašanje prevedi v jezik s kodo: ${lang}.**
            
            **KONČNI NAGOVOR Z OPOZORILOM (KLJUČNO PRAVILO):** To varnostno opozorilo je namenjeno le zaključku celotne interakcije. To opozorilo dodaj kot zadnji stavek SAMO in izključno, če:
            a) Je uporabnikov vnos zelo kratek in kaže na zaključek ali potrditev (npr. 'Hvala', 'To je to', 'V redu').
            ALI
            b) Če je tvoj odgovor dolg in vseobsegajoč, in je verjetnost, da je to konec pogovora, visoka.
            
            V primeru, da uporabnik postavi novo, nadaljnje vprašanje o restavracijah, opozorila NE DODAJ.
            
            // ⭐ VSEBINA OPOZORILA: Uporabite vnaprej pripravljen tekst ⭐
            // Model mora izbrati ustrezen nagovor (Prijatelj/Prijateljica/Friend) in slovnično usklajenost glede na uporabnika. Uporabi TOČNO to vsebino, ki je že prevedena:
            **VSEBINA OPOZORILA:** ${finalWarningText}
            
            --- ZNANJE IZ BAZE (RESTAVRACIJ/MENIJEV Z OCENO ZASEDENOSTI) ---
            ${finalRestavracijeJson}
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