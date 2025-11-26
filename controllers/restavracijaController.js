// ===============================================
// 🟢 RESTAVRACIJA CONTROLLER
// Vsebuje vso poslovno logiko za restavracije, rezervacije in Geo iskanje.
// ===============================================

// ⚠️ OPOMBA: Če se strežnik zatakne, je najverjetnejša težava pri uvozu ali definiciji modela.
const Restavracija = require('../models/Restavracija'); 
const mongoose = require('mongoose');

// 🟢 DODANO: Uvozimo model Uporabnik iz sekundarne povezave
const UporabnikShema = require('../models/Uporabnik'); 
const dbUsers = require('../dbUsers');
const Uporabnik = dbUsers.model('Uporabnik', UporabnikShema);


// Pomožna funkcija: Preveri, ali se dve rezervaciji prekrivata
const seRezervacijiPrekrivata = (novaCasStart, novaTrajanje, obstojeceCasStart, obstojeceTrajanje) => {
    // Pretvori vse v števila
    novaCasStart = parseFloat(novaCasStart);
    novaTrajanje = parseFloat(novaTrajanje);
    obstojeceCasStart = parseFloat(obstojeceCasStart);
    obstojeceTrajanje = parseFloat(obstojeceTrajanje);
    
    const novaCasKonec = novaCasStart + novaTrajanje;
    const obstojeceCasKonec = obstojeceCasStart + obstojeceTrajanje;
    
    // Logika prekrivanja: A.Start < B.End AND B.Start < A.End
    return novaCasStart < obstojeceCasKonec && obstojeceCasStart < novaCasKonec;
};

// =================================================================
// 1. CRUD operacije (Osnovni)
// =================================================================

/**
 * 🚀 **FUNKCIJA ZA FRONTEND (KONČNA POPRAVLJENA AGGREGATION)**
 * Vključuje nalaganje imena, opisa, menija, slik in ostalih podatkov za kartice.
 */
exports.getPrivzetoRestavracije = async (req, res) => {
    console.log("===> API klic za /privzeto prejet. Vrnjeni bodo agregirani podatki z opisom in menijem.");

    try {
        const restavracije = await Restavracija.aggregate([
            // 🔥 POPRAVLJENO: ODSTRANJENA OMEJITEV $limit: 10
            { $project: {
                _id: 1, 
                // Ključni podatki kartice
                imeRestavracije: { $ifNull: ["$ime", "$naziv", "Ime manjka v bazi (Controller)"] }, 
                urlSlike: { 
                    $ifNull: [
                        "$mainImageUrl", 
                        // 🔥 POPRAVEK: Uporabite prvo sliko iz novega polja galerija_slik
                        { $arrayElemAt: ["$galerija_slik", 0] } 
                    ]
                },
                deviznaKuhinja: { $arrayElemAt: ["$cuisine", 0] },
                
                // POPRAVEK: Uporabimo polje $meni namesto $menu
                opis: { $ifNull: ["$opis", "Opis manjka."] }, 
                meni: 1, 
                
                // 🔥🔥🔥 KRITIČNI POPRAVEK: DODAJ POLJE KOMENTARJI
                komentarji: 1, // <--- DODANO ZA REŠITEV PROBLEMA Z OCENAMI
                
                // Ostala polja
                galerija_slik: 1, 
                ocena_povprecje: { $ifNull: ["$ocena_povprecje", "$ocena", 0] },
                
                // 🔥 NOVO: Polja za Google oceno in število mnenj
                googleRating: { $ifNull: ["$googleRating", 0] },
                googleReviewCount: { $ifNull: ["$googleReviewCount", 0] },
                // ------------------------------------
                
                lokacija: 1,
                razpolozljivost_status: 1,
                razpolozljivost_cas: 1
            }}
        ]);
        
        res.status(200).json(restavracije);

    } catch (error) {
        console.error("Napaka pri pridobivanju privzetih restavracij:", error);
        res.status(500).json({ msg: "Napaka strežnika pri nalaganju restavracij" });
    }
};


/**
 * Pridobitev vseh restavracij (GET /) - Originalni kontroler
 */
exports.pridobiVseRestavracije = async (req, res) => {
    try {
        const restavracije = await Restavracija.find({});
        res.json(restavracije);
    } catch (error) {
        console.error('Napaka pri pridobivanju vseh restavracij (Originalni klic):', error);
        res.status(500).json({ msg: 'Napaka pri pridobivanju restavracij.' });
    }
};

/**
 * Ustvarjanje nove restavracije (POST /)
 */
exports.ustvariRestavracijo = async (req, res) => {
    try {
        const novaRestavracija = new Restavracija(req.body);
        const shranjenaRestavracija = await novaRestavracija.save();
        res.status(201).json(shranjenaRestavracija);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ msg: 'Restavracija s tem e-poštnim naslovom ali imenom že obstaja.' });
        }
        console.error('Napaka pri ustvarjanju restavracije:', error);
        res.status(500).json({ msg: 'Napaka strežnika pri ustvarjanju restavracije.', error: error.message });
    }
};

/**
 * Pridobitev ene restavracije po ID (GET /:id)
 */
exports.pridobiRestavracijoPoId = async (req, res) => {
    try {
        const restavracijaId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(restavracijaId)) {
            console.error(`Neveljaven format ID restavracije pri GET: ${restavracijaId}`);
            return res.status(400).json({ 
                msg: `Neveljaven format ID restavracije: "${restavracijaId}"` 
            });
        }

        const restavracija = await Restavracija.findById(restavracijaId);
        if (!restavracija) return res.status(404).json({ msg: 'Restavracija ni najdena.' });
        res.json(restavracija);

    } catch (error) {
        console.error('Napaka pri pridobivanju restavracije po ID:', error);
        res.status(500).json({ msg: 'Napaka serverja.' });
    }
};

/**
 * Posodobitev restavracije po ID (PUT /:id)
 */
exports.posodobiRestavracijo = async (req, res) => {
    try {
        const restavracijaId = req.params.id;
        const updateData = req.body; 

        if (!mongoose.Types.ObjectId.isValid(restavracijaId)) {
            return res.status(400).json({ msg: 'Neveljaven format ID restavracije.' });
        }

        const updatedRestavracija = await Restavracija.findByIdAndUpdate(
            restavracijaId,
            updateData,
            { new: true, runValidators: true } 
        );

        if (!updatedRestavracija) {
            return res.status(404).json({ msg: 'Restavracija ni najdena za posodobitev.' });
        }

        res.status(200).json(updatedRestavracija);

    } catch (error) {
        console.error('Napaka pri posodabljanju restavracije:', error);
        res.status(500).json({ msg: 'Napaka strežnika pri posodabljanju.', error: error.message });
    }
};

/**
 * Brisanje restavracije po ID (DELETE /:id)
 */
exports.izbrisiRestavracijo = async (req, res) => {
    try {
        const restavracijaId = req.params.id;
        
        if (!mongoose.Types.ObjectId.isValid(restavracijaId)) {
            return res.status(400).json({ msg: 'Neveljaven format ID restavracije.' });
        }

        const restavracija = await Restavracija.findByIdAndDelete(restavracijaId);

        if (!restavracija) {
            return res.status(404).json({ msg: 'Restavracija ni najdena za izbris.' });
        }

        res.status(200).json({ msg: 'Restavracija uspešno izbrisana.' });

    } catch (error) {
        console.error('Napaka pri brisanju restavracije:', error);
        res.status(500).json({ msg: 'Napaka strežnika pri brisanju.' });
    }
};


// =================================================================
// 2. Geospatial in rezervacijska logika
// =================================================================

/**
 * Geospatial iskanje (GET /blizina)
 */
exports.pridobiRestavracijePoBlizini = async (req, res) => {
    const { lat, lon, radius } = req.query; 
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const maxDistance = parseInt(radius) || 10000; 

    if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ msg: "Prosimo, zagotovite veljavne koordinate (lat in lon)." });
    }

    try {
        const rezultati = await Restavracija.aggregate([
            {
                $geoNear: {
                    near: { 
                        type: "Point", 
                        coordinates: [longitude, latitude] // MongoDB pričakuje [lon, lat]
                    },
                    distanceField: "razdalja_metri",
                    maxDistance: maxDistance,
                    spherical: true,
                }
            }
        ]);

        const restavracijeZRazdaljo = rezultati.map(r => ({
            ...r,
            razdalja_km: (r.razdalja_metri / 1000).toFixed(2) 
        }));

        if (restavracijeZRazdaljo.length === 0) {
             return res.status(200).json({
                msg: "V polmeru " + (maxDistance / 1000) + " km nismo našli restavracij.",
                restavracije: []
            });
        }

        res.status(200).json(restavracijeZRazdaljo);

    } catch (error) {
        console.error("Napaka pri $geoNear poizvedbi:", error.message);
        
        if (error.code === 16602) {
             return res.status(500).json({ 
                msg: "Geoprostorska poizvedba ne deluje. Preverite, ali imate 2dsphere indeks na polju 'lokacija'!",
                error_details: error.message
             });
        }

        res.status(500).json({ msg: "Napaka strežnika pri iskanju po bližini." });
    }
};


/**
 * Pridobivanje prostih ur (POST /proste_ure ALI GET /preveri_rezervacijo/:id/:datum/:osebe)
 * 🔥 POPRAVEK: Zmanjšanje intervala na polno uro (1.0).
 */
exports.pridobiProsteUre = async (req, res) => {
    
    const restavracijaId = req.body.restavracijaId || req.params.restavracijaId;
    const datum = req.body.datum || req.params.datum;
    const stevilo_oseb_string = req.body.stevilo_oseb || req.params.stevilo_oseb; 
    const trajanjeUr = req.body.trajanjeUr; 

    if (!restavracijaId || !datum || !stevilo_oseb_string) {
        return res.status(400).json({ msg: 'Manjkajoči podatki: restavracijaId, datum ali stevilo_oseb.' });
    }
    
    // 🔥 POPRAVEK 1: Preveri format in pripravi ObjectId za agregacijo
    let restavracijaObjectId;
    try {
        // Predpostavka: Mongoose in Restavracija Model sta uvožena.
        restavracijaObjectId = new mongoose.Types.ObjectId(restavracijaId); 
    } catch (e) {
        return res.status(400).json({ msg: 'Neveljaven format ID restavracije.' });
    }

    const stevilo_oseb = parseInt(stevilo_oseb_string);
    if (isNaN(stevilo_oseb) || stevilo_oseb <= 0) {
        return res.status(400).json({ msg: 'Neveljavno število oseb.' });
    }


    try {
        // 🔥🔥🔥 SPREMENJENO: Nastavimo interval na 1.0 (60 minut)
        const interval = 1.0; 
        const privzetoTrajanje = trajanjeUr ? parseFloat(trajanjeUr) : 1.5; 
        
        const rezultatiAggregation = await Restavracija.aggregate([
            // 🔥 POPRAVEK 2: Uporabi pravilno pretvorjen ObjectId
            { $match: { _id: restavracijaObjectId } }, 
            { $unwind: "$mize" }, 
            // 🟢 POPRAVEK ZA ADMIN PRIKAZ/PREVERJANJE PROSTIH MEST: 
            // Izločimo rezervacije, ki so bile že preklicane (če bi se klic uporabil za zasedenost).
            { $unwind: { path: "$mize.rezervacije", preserveNullAndEmptyArrays: true } }, // Dodan unwind rezervacij
            { $match: { 
                $or: [
                    { "mize.rezervacije.status": { $exists: false } },
                    { "mize.rezervacije.status": { $nin: ['PREKLICANO', 'ZAKLJUČENO'] } } // 🟢 SPREMENJENO: Zaključene se ne štejejo kot aktivno zasedena miza
                ]
            }},
            // Vrnemo se na "mize" array, da lahko preverimo kapaciteto
            { $group: {
                _id: "$mize._id",
                miza: { $first: "$mize" },
                delovniCasStart: { $first: "$delovniCasStart" },
                delovniCasEnd: { $first: "$delovniCasEnd" },
                rezervacije: { $push: "$mize.rezervacije" }
            }},
            { $match: { "miza.kapaciteta": { $gte: stevilo_oseb } } }, 
            { $project: {
                _id: 0, 
                miza: "$miza",
                rezervacije: "$rezervacije",
                delovniCasStart: 1,
                delovniCasEnd: 1
            }}
        ]);

        if (rezultatiAggregation.length === 0) {
            return res.json({ msg: 'Ni ustreznih miz za to število oseb.', mize: [] });
        }
        
        // Zamenjaj rezultatiAggregation z bolj čisto strukturo za nadaljnjo logiko
        const aggrRezultatiZaLogiko = rezultatiAggregation.map(r => ({
            miza: r.miza,
            delovniCasStart: r.delovniCasStart,
            delovniCasEnd: r.delovniCasEnd,
            rezervacije: r.rezervacije.filter(rez => rez && rez.casStart) // Odstranimo morebitne null/undefine
        }));


        const koncniRezultati = [];
        const casZacetka = aggrRezultatiZaLogiko[0].delovniCasStart || 8; 
        const casZaprtja = aggrRezultatiZaLogiko[0].delovniCasEnd || 23; 
        const minimalniCasKonca = casZaprtja - privzetoTrajanje;

        // Izračun v minutah za zanesljivost
        const zacetekMinut = casZacetka * 60; 
        const konecMinut = minimalniCasKonca * 60; 
        const intervalMinut = interval * 60; // Sedaj je to 60 minut

        for (const aggResult of aggrRezultatiZaLogiko) { // Uporabimo novo strukturo
            const miza = aggResult.miza;
            const prosteUre = [];
            
            const mizaImeZaIzpis = miza.Miza || miza.ime || miza.naziv || `ID: ${miza._id.toString().substring(0, 4)}...`;

            // Uporabimo že filtrirane rezervacije
            const obstojeceRezervacije = (aggResult.rezervacije || []).filter(rez => rez.datum === datum);

            // Zanka zdaj teče po minutah
            for (let min = zacetekMinut; min <= konecMinut; min += intervalMinut) {
                
                const uraFormatirana = min / 60; // Generira 10.0, 11.0, 12.0...
                let jeProsto = true;

                for (const obstojecaRezervacija of obstojeceRezervacije) {
                    
                    const obstojeceTrajanje = obstojecaRezervacija.trajanjeUr || 1.5;
                    
                    if (seRezervacijiPrekrivata(uraFormatirana, privzetoTrajanje, obstojecaRezervacija.casStart, obstojeceTrajanje)) {
                        jeProsto = false;
                        break; 
                    }
                }

                if (jeProsto) {
                    prosteUre.push(uraFormatirana); 
                }
            }
            // Konec zanke za ure

            if (prosteUre.length > 0) {
                koncniRezultati.push({
                    mizaIme: mizaImeZaIzpis, 
                    mizaId: miza._id, 
                    kapaciteta: miza.kapaciteta,
                    prosteUre: prosteUre
                });
            }
        }

        res.json({ msg: 'Uspešno pridobljene proste mize in ure.', mize: koncniRezultati });

    } catch (error) {
        console.error('Končna napaka pri pridobivanju prostih ur:', error);
        res.status(500).json({ msg: 'Napaka serverja pri pridobivanju prostih ur.' });
    }
};

/**
 * Ustvarjanje nove rezervacije (POST /ustvari_rezervacijo)
 * 💥 POPRAVEK: Dinamično iskanje prve proste mize, ki ustreza kriterijem.
 * ⚠️ OPOZORILO: Funkcija 'seRezervacijiPrekrivata' mora biti dostopna v tem obsegu!
 */
exports.ustvariRezervacijo = async (req, res) => {
    const userId = req.uporabnik ? req.uporabnik.id : null; 
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
        console.log("❌ ZAVRNJENO: Poskus rezervacije brez veljavnega uporabniškega ID-ja.");
        return res.status(401).json({ 
            error: 'Unauthorized', 
            message: 'Za ustvarjanje rezervacije morate biti prijavljeni z veljavnim uporabniškim računom.' 
        });
    }
    
    const uporabnikIdObject = new mongoose.Types.ObjectId(userId.toString());
    
    // 🔥 SPREMENJENO: ODSTRANILI SMO ZAHTEVO PO 'mizaId' IZ TELESA ZAHTEVE!
    const { restavracijaId, imeGosta, telefon, stevilo_oseb, datum, casStart, trajanjeUr } = req.body; 
    
    if (!restavracijaId || !imeGosta || !datum || !casStart) {
        return res.status(400).json({ msg: 'Manjkajo vsi potrebni podatki za rezervacijo (restavracijaId, imeGosta, datum, casStart, stevilo_oseb).' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(restavracijaId)) {
        return res.status(400).json({ msg: `Neveljaven format ID: "${restavracijaId}"` });
    }

    try {
        const trajanje = parseFloat(trajanjeUr) || 1.5;
        const casZacetka = parseFloat(casStart);
        const stOseb = parseInt(stevilo_oseb) || 2;
        let prostaMizaId = null; 
        let prostaMizaIme = null;
        
        // 1. Pridobi restavracijo in VSE njene mize
        const restavracija = await Restavracija.findById(restavracijaId, 'mize').lean();

        if (!restavracija) {
            return res.status(404).json({ msg: 'Restavracija ni najdena.' });
        }
        
        // 2. ISKANJE PRVE PROSTE MIZE, KI USTREZA KRITERIJEM (Stevilo oseb in Čas)
        const vseMize = restavracija.mize || [];
        
        for (const miza of vseMize) {
            // Preverjanje kapacitete
            if (miza.kapaciteta < stOseb) {
                continue; // Ta miza je premajhna
            }
            
            // Preverjanje razpoložljivosti časa
            let jeProsta = true;
            // 🟢 POPRAVEK: Filtriramo še za 'ZAKLJUČENO', saj ta miza ni zasedena.
            const obstojeceRezervacije = (miza.rezervacije || [])
                .filter(rez => rez.datum === datum && rez.status !== 'ZAKLJUČENO'); 
            
            for (const obstojecaRezervacija of obstojeceRezervacije) {
                const obstojeceTrajanje = obstojecaRezervacija.trajanjeUr || 1.5;
                
                // Uporabimo dostopno funkciju 'seRezervacijiPrekrivata'
                if (seRezervacijiPrekrivata(casZacetka, trajanje, obstojecaRezervacija.casStart, obstojeceTrajanje)) {
                    jeProsta = false; // Miza je zasedena v tem času
                    break;
                }
            }
            
            // 3. Če najdemo prosto mizo, jo takoj izberemo in prekinemo iskanje
            if (jeProsta) {
                prostaMizaId = miza._id.toString();
                prostaMizaIme = miza.Miza || miza.ime || miza.naziv || `ID: ${miza._id.toString().substring(0, 4)}...`;
                break; 
            }
        }
        
        // 4. Končna preverba: Ali smo našli mizo?
        if (!prostaMizaId) {
             return res.status(409).json({ 
                msg: `Žal nam je, ob ${casStart} ni proste mize, ki bi ustrezala ${stOseb} osebam.`,
                status: "ZASEDNO"
            });
        }
        
        // 5. Ustvarjanje rezervacije (za najdeno prosto mizo)
        const novaRezervacija = {
            uporabnikId: uporabnikIdObject,
            imeGosta,
            telefon,
            stevilo_oseb: stOseb,
            datum,
            casStart: casZacetka,
            trajanjeUr: trajanje,
            // **********************************************
            status: 'AKTIVNO', // ✅ POPRAVLJENO: Nujen popravek statusa!
            // **********************************************
        };

        const rezultat = await Restavracija.updateOne(
            // 🔥 Uporabimo najdeni prostaMizaId
            { _id: restavracijaId, "mize._id": prostaMizaId }, 
            { $push: { "mize.$.rezervacije": novaRezervacija } }
        );

        if (rezultat.modifiedCount === 0) {
             return res.status(500).json({ msg: 'Napaka pri shranjevanju. Restavracija ali miza ni bila posodobljena.' });
        }

        res.status(201).json({ 
            msg: `Rezervacija uspešno ustvarjena za mizo ${prostaMizaIme} ob ${casStart}.`,
            rezervacija: novaRezervacija,
            miza: prostaMizaIme // Dodamo ime mize v odgovor
        });

    } catch (error) {
        console.error('Napaka pri ustvarjanju rezervacije:', error);
        res.status(500).json({ msg: 'Napaka serverja pri ustvarjanju rezervacije.' });
    }
};

/**
 * 🟢 POPRAVLJENO: Brisanje rezervacije (DELETE /izbrisi_rezervacijo)
 * Izvaja TRDO BRISANJE ($pull), ki rezervacijo v celoti odstrani iz zbirke podatkov.
 * To rešuje problem vidnosti v Admin portalu.
 */
exports.izbrisiRezervacijo = async (req, res) => {
    const { restavracijaId, mizaId, rezervacijaId } = req.body;
    
    // ID prijavljenega uporabnika dobimo iz avtentikacijskega middleware-a
    const uporabnikovId = req.uporabnik ? req.uporabnik.id : null; 

    if (!uporabnikovId) {
        console.log("❌ ZAVRNJENO: Poskus preklica brez veljavnega uporabniškega ID-ja.");
        return res.status(401).json({ msg: 'Neavtorizirano: Za preklic morate biti prijavljeni.' });
    }

    if (!mongoose.Types.ObjectId.isValid(restavracijaId) || 
        !mongoose.Types.ObjectId.isValid(mizaId) || 
        !mongoose.Types.ObjectId.isValid(rezervacijaId)) 
    {
        return res.status(400).json({ msg: 'Neveljaven format ID-ja (Restavracija, Miza ali Rezervacija).' });
    }

    try {
        
        // 🔥 KLJUČNO: Uporabimo $pull za odstranitev celotnega objekta rezervacije iz podpolja 'rezervacije' znotraj ustrezne 'mize'.
        const rezultat = await Restavracija.updateOne(
            { 
                _id: new mongoose.Types.ObjectId(restavracijaId), // Poišči restavracijo
                "mize._id": new mongoose.Types.ObjectId(mizaId)  // Poišči ustrezno mizo
            }, 
            { 
                $pull: { 
                    "mize.$.rezervacije": { // Uporabi $ za ustrezno mizo
                        _id: new mongoose.Types.ObjectId(rezervacijaId), // Rezervacija, ki jo želimo odstraniti
                        uporabnikId: new mongoose.Types.ObjectId(uporabnikovId) // VARNOST: Preveri lastništvo
                    }
                } 
            }
        );

        if (rezultat.modifiedCount === 0) {
            // modifiedCount = 0 pomeni, da rezervacija ni bila najdena ali uporabnik ni njen lastnik.
            return res.status(404).json({ msg: 'Rezervacija ni najdena ali nimate dovoljenja za izbris.' });
        }

        res.json({ msg: 'Rezervacija uspešno izbrisana iz baze.' });

    } catch (error) {
        console.error('Napaka pri TRDEM brisanju rezervacije:', error);
        res.status(500).json({ msg: 'Napaka serverja pri brisanju rezervacije.' });
    }
};


// =================================================================
// 💥 4. FUNKCIJE ZA PROFIL UPORABNIKA (POPRAVLJENE)
// =================================================================

/**
 * Pridobitev aktivnih (prihajajočih) rezervacij za prijavljenega uporabnika
 * GET /api/restavracije/uporabnik/aktivne
 */
exports.pridobiAktivneRezervacijeUporabnika = async (req, res) => {
    // ID uporabnika dobimo iz avtentikacijskega žetona
    const userId = req.uporabnik ? req.uporabnik.id : null; 

    if (!userId) {
        return res.status(401).json({ msg: "Neavtorizirano: ID uporabnika manjka v žetonu." });
    }
    
    // Čas in datum
    const danes = new Date();
    // Odrezani datum (YYYY-MM-DD) za primerjavo stringov
    const danesISO = danes.toISOString().slice(0, 10); 
    // Trenutna ura v float obliki (npr. 14.67) + majhen buffer (npr. 0.5 ure)
    const trenutnaUraFloat = danes.getHours() + danes.getMinutes() / 60;
    const buffer = 0.5; // Rezervacija je še aktivna, dokler ne preteče določena ura plus buffer
    const casKoncaAktivne = trenutnaUraFloat + buffer;

    console.log(`[AKTIVNE] Poskus pridobivanja za Uporabnik ID: ${userId} od datuma: ${danesISO} in časa: ${casKoncaAktivne.toFixed(2)}`); 

    try {
        const aktivne = await Restavracija.aggregate([
            { $match: { "mize": { $exists: true, $ne: [] } } },
            { $unwind: "$mize" },
            { $unwind: "$mize.rezervacije" },
            
            // 🔥 POPRAVLJENO FILTRIRANJE AKTIVNIH
            { $match: { 
                "mize.rezervacije.uporabnikId": new mongoose.Types.ObjectId(userId),
                "mize.rezervacije.status": { $nin: ['PREKLICANO', 'ZAKLJUČENO'] }, // 🟢 ZAKLJUČENO ni aktivno
                $or: [
                    // 1. Prihodnji datumi
                    { "mize.rezervacije.datum": { $gt: danesISO } },
                    // 2. Rezervacije na DANAŠNJI dan, ki še niso pretekle
                    { 
                        "mize.rezervacije.datum": danesISO, 
                        "mize.rezervacije.casStart": { $gte: casKoncaAktivne } // CAS > Trenutni CAS (plus buffer)
                    }
                ]
            }},

            // PROJEKCIJA
            { $project: {
                _id: "$mize.rezervacije._id", // ID rezervacije
                ime_restavracije: "$ime", // Ime restavracije
                restavracijaId: "$_id",
                mizaId: "$mize._id", 
                datum_rezervacije: "$mize.rezervacije.datum",
                cas_rezervacije: "$mize.rezervacije.casStart",
                stevilo_oseb: "$mize.rezervacije.stevilo_oseb",
                status: "$mize.rezervacije.status"
            }},
            
            { $sort: { datum_rezervacije: 1, cas_rezervacije: 1 } }
        ]);

        console.log(`[AKTIVNE] Število najdenih rezervacij: ${aktivne.length}`); 

        res.status(200).json(aktivne);

    } catch (error) {
        console.error("Napaka pri pridobivanju aktivnih rezervacij uporabnika:", error);
        res.status(500).json({ msg: 'Napaka strežnika pri nalaganju aktivnih rezervacij.', error: error.message });
    }
};

/**
 * Pridobitev zgodovine (preteklih/preklicanih/zaključenih) rezervacij za prijavljenega uporabnika
 * GET /api/restavracije/uporabnik/zgodovina
 * * @param {object} req - Express zahteva
 * @param {object} res - Express odgovor
 */
exports.pridobiZgodovinoRezervacijUporabnika = async (req, res) => {
    const userId = req.uporabnik ? req.uporabnik.id : null; 

    if (!userId) {
        return res.status(401).json({ msg: "Neavtorizirano: ID uporabnika manjka v žetonu." });
    }

    // 🟢 POPRAVEK A: Pretvori userId v ObjectId tukaj, da prepreči notranjo napako 500
    let userIdObj;
    try {
        userIdObj = new mongoose.Types.ObjectId(userId);
    } catch (e) {
        console.error("Napaka: Neveljaven format userId v žetonu:", userId);
        return res.status(400).json({ msg: "Neveljaven ID uporabnika v žetonu." });
    }
    
    // Čas in datum
    const danes = new Date();
    const danesISO = danes.toISOString().slice(0, 10); 
    const trenutnaUraFloat = danes.getHours() + danes.getMinutes() / 60;
    const buffer = 0.5; 
    const casKoncaAktivne = trenutnaUraFloat + buffer;

    try {
        // --- 1. IZVEDBA AGREGACIJE: Pridobitev zgodovine ---
        const zgodovinaNepreverjena = await Restavracija.aggregate([
            { $match: { "mize": { $exists: true, $ne: [] } } },
            { $unwind: "$mize" },
            { $unwind: "$mize.rezervacije" },
            
            // FILTRIRANJE ZGODOVINE
            { $match: { 
                "mize.rezervacije.uporabnikId": userIdObj, 
                $or: [
                    { "mize.rezervacije.status": "ZAKLJUČENO" }, 
                    { "mize.rezervacije.datum": { $lt: danesISO } },
                    { 
                        "mize.rezervacije.datum": danesISO, 
                        "mize.rezervacije.casStart": { $lt: casKoncaAktivne }
                    },
                    { "mize.rezervacije.status": "PREKLICANO" } 
                 ]
            }},

            // PROJEKCIJA (Rezervacija se projecira kot svoj objekt)
            { $project: {
                _id: "$mize.rezervacije._id", // ID rezervacije (ObjectId)
                ime_restavracije: "$ime", // Ime restavracije
                restavracijaId: "$_id",   // ID restavracije
                mizaId: "$mize._id", 
                datum_rezervacije: "$mize.rezervacije.datum",
                cas_rezervacije: "$mize.rezervacije.casStart",
                stevilo_oseb: "$mize.rezervacije.stevilo_oseb",
                status: "$mize.rezervacije.status"
            }},
            
            { $sort: { datum_rezervacije: -1, cas_rezervacije: -1 } }
        ]);

        // 🟢 POPRAVEK B: Prekini, če ni najdenih rezervacij.
        if (zgodovinaNepreverjena.length === 0) {
            console.log(`[ZGODOVINA] Število najdenih rezervacij: 0. Vrnitev praznega seznama.`); 
            return res.status(200).json([]);
        }
        
        // --- 2. PREVERJANJE OCEN IN DODAJANJE POLJA 'ocenjeno' ---

        // Zberemo vse ID-je restavracij iz rezultatov
        const restavracijaIds = [...new Set(zgodovinaNepreverjena.map(r => r.restavracijaId))];
        
        // Pridobimo vse komentarje iz ustreznih restavracij
        const restavracijeSKomentarji = await Restavracija.find(
            { _id: { $in: restavracijaIds } },
            { komentarji: 1 } // Pridobimo samo polje komentarji
        ).lean();

        // Ustvarimo "slovar" vseh ID-jev rezervacij, ki so bile Ocenjene
        const vseOcenjeneRezervacije = new Set();
        restavracijeSKomentarji.forEach(restavracija => {
            // 🔥 KRITIČNI POPRAVEK: Preveri, ali komentarji obstajajo in so Array (uporaba Array.isArray)
            if (Array.isArray(restavracija.komentarji)) {
                restavracija.komentarji.forEach(komentar => {
                    // Preverimo, če obstaja ID rezervacije in ga pretvorimo v String za lažjo primerjavo
                    if (komentar.rezervacijaId) {
                        vseOcenjeneRezervacije.add(komentar.rezervacijaId.toString());
                    }
                });
            }
        });

        // --- 3. Dopolnitev rezultatov in pošiljanje na frontend ---
        const zgodovinaZOceno = zgodovinaNepreverjena.map(rezervacija => {
            // Pretvorimo _id rezervacije (ki jo vrne agregacija) v String za primerjavo
            const rezervacijaIdString = rezervacija._id.toString(); 
            
            // Če je ID rezervacije v Setu, je ocenjeno!
            rezervacija.ocenjeno = vseOcenjeneRezervacije.has(rezervacijaIdString);
            
            return rezervacija;
        });

        res.status(200).json(zgodovinaZOceno);

    } catch (error) {
        console.error("Napaka pri pridobivanju zgodovine rezervacij uporabnika:", error);
        res.status(500).json({ msg: 'Napaka strežnika pri nalaganju zgodovine rezervacij.' });
    }
};

// =================================================================
// 3. Admin operacije (PUT /admin/posodobi_vsebino/:restavracijaId)
// =================================================================

/**
 * Posodobitev bogatih podatkov (slike, opis, meni)
 */
exports.posodobiAdminVsebino = async (req, res) => { 
    const restavracijaId = req.params.restavracijaId;
    const { novOpis, glavnaSlikaUrl, galerijaUrlsi, novMeni } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(restavracijaId)) {
        return res.status(400).json({ msg: 'Neveljaven format ID restavracije.' });
    }

    try {
        const updateData = {};
        if (novOpis) updateData.description = novOpis;
        if (glavnaSlikaUrl) updateData.mainImageUrl = glavnaSlikaUrl;
        
        // 🔥 POPRAVEK: Zamenjano 'galleryUrls' z 'galerija_slik'
        if (galerijaUrlsi) updateData.galerija_slik = galerijaUrlsi;
        
        if (novMeni) updateData.menu = novMeni;
        
        const posodobljeno = await Restavracija.findByIdAndUpdate(
            restavracijaId, 
            { $set: updateData }, 
            { new: true, runValidators: true } 
        );

        if (!posodobljeno) {
            return res.status(404).json({ msg: 'Restavracija ni najdena za posodobitev.' });
        }

        res.json({ msg: 'Vsebina uspešno posodobljena.', restavracija: posodobljeno });

    } catch (error) {
        console.error('Napaka pri posodabljanju admin vsebine:', error);
        res.status(500).json({ msg: 'Napaka serverja.' });
    }
};


// =================================================================
// 💥 5. OPERACIJE Z AKCIJSKO DODELITVIJO TOČK IN OCENJEVANJEM
// =================================================================

/**
 * 🟢 POSODOBLJENO: Potrdi uporabnikov prihod s skeniranjem QR kode (samo restavracijaId).
 * Potrditev je dovoljena le v časovnem oknu, ki se začne 10 minut PRED rezervacijo in konča 60 minut PO rezervaciji.
 * POZOR: Za rezervacije, ki so pretekle in niso potrjene, glej funkcijo 'oznaciPretekleRezervacije'.
 * POST /api/restavracije/potrdi_prihod
 */
exports.potrdiPrihodInDodelitevTock = async (req, res) => {
    // Sprejmemo samo restavracijaId iz telesa (QR koda)
    const { restavracijaId } = req.body; 
    const userId = req.uporabnik ? req.uporabnik.id : null; 
    const TOCK_NA_REZERVACIJO = 50;
    const ZETON_ZA_OCENJEVANJE = 1; // Nov žeton, ki omogoča ocenjevanje po potrditvi

    if (!userId) {
        return res.status(401).json({ msg: 'Neavtorizirano: Prijavite se za potrditev prihoda.' });
    }
    if (!mongoose.Types.ObjectId.isValid(restavracijaId)) 
    {
        return res.status(400).json({ msg: 'Neveljaven format ID-ja restavracije.' });
    }

    try {
        const userIdObj = new mongoose.Types.ObjectId(userId);
        const restavracijaIdObj = new mongoose.Types.ObjectId(restavracijaId);
        
        const danes = new Date();
        const danesISO = danes.toISOString().split('T')[0];
        
        let aktivnaRezervacijaNajdena = false;
        let posodobitevStevilo = 0;
        let potrjenaRezervacijaId = null; 
        // 🚩 NOVO: Spremljamo, ali smo naleteli na preteklo in ne-potrjeno rezervacijo
        let preteklaRezervacijaOciscena = false; 


        // --- 1. AGREGACIJA: Poišči VSE ustrezne Rezervacije na DANAŠNJI DAN ---
        const rezultatIskanja = await Restavracija.aggregate([
            { $match: { "_id": restavracijaIdObj } },
            { $unwind: "$mize" },
            { $unwind: "$mize.rezervacije" },
            { $match: { 
                "mize.rezervacije.uporabnikId": userIdObj, 
                // Vključimo tudi že potrjene (da jih lahko ponovno skenira)
                "mize.rezervacije.status": { $in: ['AKTIVNO', 'POTRJENO_PRIHOD'] }, 
                // 💥 POPRAVEK: Uporabite pravilno ime polja za datum
                "mize.rezervacije.datum": danesISO 
            }},
            { $project: {
                _id: 0, 
                mizaId: "$mize._id",
                rezervacijaId: "$mize.rezervacije._id",
                casRezervacijeString: "$mize.rezervacije.cas", // npr. "10:00"
                status: "$mize.rezervacije.status"
            }}
        ]);

        if (rezultatIskanja.length === 0) {
            // Ni najdene niti AKTIVNE niti že POTRJENE rezervacije za danes
            return res.status(404).json({ msg: `profile.status_error: Aktivna rezervacija za danes (${danesISO}) v tej restavraciji ni bila najdena.` });
        }
        
        // --- 2. PREVERJANJE ČASA in POSODOBITEV ---
        
        for (const rezInfo of rezultatIskanja) {
            // Pretvori čas rezervacije (npr. "10:00") v objekt Date za današnji dan
            const [uraStr, minutaStr] = rezInfo.casRezervacijeString.split(':');
            const casZacetkaRezervacije = new Date(danes);
            casZacetkaRezervacije.setHours(parseInt(uraStr), parseInt(minutaStr), 0, 0);

            // Izračunaj časovno okno za potrditev (10 minut prej, 60 minut kasneje)
            const casZaPotrditevOd = new Date(casZacetkaRezervacije.getTime() - (10 * 60000)); 
            const casZaPotrditevDo = new Date(casZacetkaRezervacije.getTime() + (60 * 60000)); 
            
            aktivnaRezervacijaNajdena = true; // Našli smo rezervacijo za danes

            // Če je rezervacija že potrjena, se to sporoči in preskoči posodobitev
            if (rezInfo.status === 'POTRJENO_PRIHOD') {
                potrjenaRezervacijaId = rezInfo.rezervacijaId;
                continue; 
            }

            // 🚀 KLJUČNO: Preveri, ali je trenutni čas znotraj časovnega okna
            if (danes >= casZaPotrditevOd && danes <= casZaPotrditevDo) {
                // PRIMER A: PRAVOČASNA POTRDITEV
                
                potrjenaRezervacijaId = rezInfo.rezervacijaId; 
                
                // Posodobitev statusa rezervacije na POTRJENO_PRIHOD (Uporaba dveh array filtrov)
                const rezultatPosodobitve = await Restavracija.updateOne(
                    { 
                        _id: restavracijaIdObj, 
                        "mize.rezervacije._id": rezInfo.rezervacijaId // Zadošča, da jo najde v katerikoli mizi
                    }, 
                    { 
                        $set: { 
                            "mize.$[miza].rezervacije.$[rez].status": 'POTRJENO_PRIHOD',
                            "mize.$[miza].rezervacije.$[rez].potrjen_prihod": true,
                            "mize.$[miza].rezervacije.$[rez].zeton_za_ocenjevanje": ZETON_ZA_OCENJEVANJE 
                        } 
                    },
                    {
                        arrayFilters: [ 
                            { "miza._id": rezInfo.mizaId }, // Filter za mizo
                            { "rez._id": rezInfo.rezervacijaId } // Filter za rezervacijo
                        ]
                    }
                );
                
                if (rezultatPosodobitve.modifiedCount > 0) {
                    posodobitevStevilo++;
                }
                
            } else if (danes > casZaPotrditevDo) { 
                // 🔥 PRIMER B: PREPOZNO SKENIRANJE (Rezervacija je pretekla in ni bila potrjena)
                
                const rezultatOznacitve = await Restavracija.updateOne(
                    { 
                        _id: restavracijaIdObj, 
                        "mize.rezervacije._id": rezInfo.rezervacijaId 
                    }, 
                    { 
                        // Takoj jo označimo kot NI_POTRJENA, da ne povzroča napake na profilu (Uporaba dveh array filtrov)
                        $set: { 
                            "mize.$[miza].rezervacije.$[rez].status": 'NI_POTRJENA', 
                            "mize.$[miza].rezervacije.$[rez].potrjen_prihod": false 
                        } 
                    },
                    {
                        arrayFilters: [ 
                            { "miza._id": rezInfo.mizaId }, // Filter za mizo
                            { "rez._id": rezInfo.rezervacijaId } // Filter za rezervacijo
                        ]
                    }
                );
                
                if (rezultatOznacitve.modifiedCount > 0) {
                    preteklaRezervacijaOciscena = true;
                }

                console.log(`Rezervacija ID ${rezInfo.rezervacijaId} je pretekla in je bila označena kot NI_POTRJENA.`);
                // Nadaljujemo z zanko, da vidimo, če je katera druga rezervacija še aktivna
                
            } else {
                // PRIMER C: PREZRAN SKEN (Rezervacija je še v prihodnosti)
                console.log(`Rezervacija ID ${rezInfo.rezervacijaId} ob ${rezInfo.casRezervacijeString} je še v prihodnosti. Potrditev še ni mogoča.`);
            }
        }
        
        // --- 3. ODGOVOR IN DODELITEV TOČK ---

        // Če ni bila najdena ali potrjena nobena rezervacija V TEM ČASOVNEM OKNU
        if (posodobitevStevilo === 0 && !potrjenaRezervacijaId) {
            
            // 🔥 POPRAVEK ODGOVORA: Če je bila rezervacija OČIŠČENA, vrnemo uspeh/obvestilo, da ni aktivne
            if (preteklaRezervacijaOciscena) {
                return res.status(200).json({ msg: `profile.status_error: Vaša rezervacija je potekla in je bila označena kot ne-potrjena.`, status: 'NI_AKTIVNA' });
            }
            
             // Če ni potrjena, je izven okna in NI potekla, ali je bila v prihodnosti
             return res.status(404).json({ msg: `profile.status_error: Trenutno niste v časovnem oknu za potrditev prihoda.` });
        }
        
        // Dodelitev točk in odgovor (samo enkrat, če je bila katera koli rezervacija dejansko potrjena)
        if (posodobitevStevilo > 0) {
            const posodobljenUporabnik = await Uporabnik.findByIdAndUpdate(
                userId, 
                { $inc: { tockeZvestobe: TOCK_NA_REZERVACIJO } },
                { new: true }
            );

            res.json({ 
                msg: `Prihod na ${posodobitevStevilo} rezervacij(e) uspešno potrjen. Dodeljenih ${TOCK_NA_REZERVACIJO} točk!`,
                noveTocke: posodobljenUporabnik ? posodobljenUporabnik.tockeZvestobe : 'Ni posodobljeno',
                status: 'POTRJENO_PRIHOD' // Uporabimo status, ki ustreza shranjevanju
            });
        } else {
            // Če je bila rezervacija že potrjena in ste jo ponovno skenirali
            res.json({
                msg: `Prihod na rezervacijo ID ${potrjenaRezervacijaId} je že bil potrjen.`,
                status: 'ŽE_POTRJENO'
            });
        }

    } catch (error) {
        console.error('❌ NAPAKA PRI POTRDITVI PRIHODA IN DODELITVI TOČK:', error);
        res.status(500).json({ msg: 'Napaka strežnika pri potrditvi prihoda.' });
    }
};


/**
 * Označi rezervacijo kot zaključeno. To funkcijo običajno sproži lastnik/admin restavracije.
 * TA FUNKCIJA NE DODELJUJE VEČ TOČK, saj to naredi 'potrdiPrihodInDodelitevTock'.
 * PUT /api/restavracije/zakljuci_rezervacijo
 * (To sproži Admin.)
 */
exports.oznaciRezervacijoKotZakljuceno = async (req, res) => {
    // Predpostavljamo, da dobimo te ID-je od Admin portala
    const { restavracijaId, mizaId, rezervacijaId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(restavracijaId) || 
        !mongoose.Types.ObjectId.isValid(mizaId) || 
        !mongoose.Types.ObjectId.isValid(rezervacijaId)) 
    {
        return res.status(400).json({ msg: 'Neveljaven format ID-ja (Restavracija, Miza ali Rezervacija).' });
    }

    try {
        // 1. Poišči rezervacijo in pridobi trenutni status
        const restavracijaInfo = await Restavracija.aggregate([
            { $match: { "_id": new mongoose.Types.ObjectId(restavracijaId) } },
            { $unwind: "$mize" },
            { $match: { "mize._id": new mongoose.Types.ObjectId(mizaId) } },
            { $unwind: "$mize.rezervacije" },
            { $match: { "mize.rezervacije._id": new mongoose.Types.ObjectId(rezervacijaId) } },
            { $project: { status: "$mize.rezervacije.status" } }
        ]);

        if (restavracijaInfo.length === 0) {
            return res.status(404).json({ msg: 'Rezervacija ni najdena.' });
        }
        
        const rezervacija = restavracijaInfo[0];

        if (rezervacija.status === 'ZAKLJUČENO') {
            return res.status(409).json({ msg: 'Rezervacija je že zaključena.' });
        }

        // 2. Posodobitev statusa rezervacije na ZAKLJUČENO
        const rezultatRezervacije = await Restavracija.updateOne(
            { 
                _id: restavracijaId, 
                "mize._id": mizaId, 
                "mize.rezervacije._id": rezervacijaId 
            }, 
            { 
                $set: { "mize.$.rezervacije.$[rez].status": 'ZAKLJUČENO' } 
            },
            {
                arrayFilters: [ { "rez._id": new mongoose.Types.ObjectId(rezervacijaId) } ]
            }
        );
        
        if (rezultatRezervacije.modifiedCount === 0) {
            return res.status(500).json({ msg: 'Napaka pri posodabljanju statusa rezervacije. Nič ni bilo spremenjeno.' });
        }

        res.json({ 
            msg: `Rezervacija ID ${rezervacijaId} uspešno zaključena. Status: ZAKLJUČENO.`
        });

    } catch (error) {
        console.error('❌ NAPAKA PRI ZAKLJUČEVANJU REZERVACIJE (Admin):', error);
        res.status(500).json({ msg: 'Napaka strežnika pri zaključku rezervacije.' });
    }
};

// 🌟 FUNKCIJA ZA ODDAJO OCENE IN KOMENTARJA (Nespremenjena)
/**
 * @route POST /api/restavracije/oceni/:restavracijaId
 * @desc Shrani komentar v polje 'komentarji' in posodobi povprečje ocen.
 * @access Private (Gost se mora prijaviti)
 */
exports.oddajOcenoInKomentar = async (req, res, next) => {
    try {
        const restavracijaId = req.params.restavracijaId;
        // ⭐ POPRAVEK: VZAMEMO TUDI rezervacijaId IZ TELESA ZAHTEVE
        const { ocena, komentar, rezervacijaId } = req.body; 
        
        // 1. Preverjanje avtorizacije
        const userId = req.uporabnik ? req.uporabnik.id : null; 
        
        if (!userId) {
            return res.status(401).json({ msg: 'Neavtorizirano: Za ocenjevanje morate biti prijavljeni.' });
        }
        
        // 2. Preverjanje vnosa
        if (!ocena || ocena < 1 || ocena > 5) {
            return res.status(400).json({ success: false, error: 'Ocena je obvezna in mora biti med 1 in 5.' });
        }
        
        // ⭐ NOVO: Preverjanje rezervacijaId
        if (!rezervacijaId || !mongoose.Types.ObjectId.isValid(rezervacijaId)) {
            return res.status(400).json({ success: false, error: 'Rezervacija ID je obvezen in mora biti veljaven.' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(restavracijaId)) {
            return res.status(400).json({ msg: 'Neveljaven format ID restavracije.' });
        }

        // 3. Najdi restavracijo in uporabnika hkrati (za ime uporabnika)
        // Dovolj je samo najti restavracijo
        const [restavracija, uporabnik] = await Promise.all([
            // Dodamo rezervacijaId v iskalne pogoje, da hitreje najdemo obstoječ komentar
            Restavracija.findById(restavracijaId, 'ocena_povprecje st_ocen komentarji'), 
            Uporabnik.findById(userId, 'ime priimek')
        ]);

        if (!restavracija) {
            return res.status(404).json({ success: false, error: 'Restavracija ni najdena.' });
        }
        if (!uporabnik) {
            console.warn(`Opozorilo: Uporabnik z ID ${userId} ni bil najden. Ocena bo pripisana anonimnemu gostu.`);
        }
        
        // Določitev imena uporabnika za prikaz
        const uporabniskoIme = uporabnik 
            ? `${uporabnik.ime || ''} ${uporabnik.priimek || ''}`.trim() || 'Gost'
            : 'Gost';


        // 4. ⭐ KRITIČNI POPRAVEK: Preprečevanje dvojnih ocen iste REZERVACIJE
        // Sedaj preverjamo, ali komentar z ID te rezervacije že obstaja
        const jeRezervacijaZeOcenjena = restavracija.komentarji.find(k => 
            k.rezervacijaId && k.rezervacijaId.toString() === rezervacijaId.toString()
        );

        if (jeRezervacijaZeOcenjena) {
             // Sporočilo je sedaj specifično za rezervacijo
             return res.status(409).json({ success: false, error: 'To rezervacijo ste že ocenili. Vsaka rezervacija se lahko oceni samo enkrat.' });
        }

        // 5. Priprava novega komentarja/ocene
        const novKomentar = {
            userId: new mongoose.Types.ObjectId(userId),
            uporabniskoIme: uporabniskoIme, 
            ocena: Number(ocena),
            komentar: komentar || '', 
            datum: new Date(),
            rezervacijaId: new mongoose.Types.ObjectId(rezervacijaId) // ⭐ SHRANIMO ID REZERVACIJE
        };
        
        // 6. Izračun in posodobitev ocen
        
        const staraSkupnaOcena = (restavracija.ocena_povprecje || 0) * (restavracija.st_ocen || 0);
        const novoSteviloOcen = (restavracija.st_ocen || 0) + 1; 
        const novaSkupnaOcena = staraSkupnaOcena + Number(ocena);
        const novoPovprecje = (novaSkupnaOcena / novoSteviloOcen);
        
        // Posodobitev restavracije
        const posodobljeno = await Restavracija.findByIdAndUpdate(
            restavracijaId,
            {
                $push: { komentarji: novKomentar }, // Dodaj komentar v array
                $set: { 
                    st_ocen: novoSteviloOcen, 
                    ocena_povprecje: novoPovprecje.toFixed(1) // Shrani zaokroženo povprečje
                }
            },
            { new: true }
        );


        res.status(201).json({ 
            success: true, 
            message: 'Ocena in komentar uspešno shranjena!',
            data: {
                ocena_povprecje: posodobljeno.ocena_povprecje,
                st_ocen: posodobljeno.st_ocen,
                komentar: novKomentar
            }
        });

    } catch (error) {
        console.error('Napaka pri oddaji ocene:', error);
        res.status(500).json({ success: false, error: 'Napaka strežnika pri oddaji ocene.', details: error.message });
    }
};


// =================================================================
// 💥 6. FUNKCIJA ZA ISKANJE (KONČNA REŠITEV - Vrnjeno na REGEX in $OR)
// =================================================================

/**
 * 🚀 FUNKCIJA ISKANJA (POST /isci)
 * Iskanje restavracij na podlagi mesta/imena in kuhinje.
 */
exports.isciRestavracije = async (req, res) => {
    // Vsi iskalni parametri so v req.body
    const { mesto, kuhinja } = req.body; 
    console.log("===> API klic za /isci prejet. Iskalni parametri:", req.body);
    
    // Zgradimo objekt pogojev za MongoDB
    const iskalniPogoji = {};
    const mestoTrim = mesto ? mesto.trim() : '';

    // 1. Iskanje po mestu/imenu restavracije
    if (mestoTrim !== '') {
        // Uporabimo STRING za regex in $options:'i' (case-insensitive)
        iskalniPogoji.$or = [
            // Ime restavracije (npr. "Lipa")
            { ime: { $regex: mestoTrim, $options: 'i' } },
            // Mesto/Kraj
            { 'lokacija.mesto': { $regex: mestoTrim, $options: 'i' } },
            // Naslov
            { 'lokacija.naslov': { $regex: mestoTrim, $options: 'i' } }
        ];
    }
    
    // 2. Iskanje po kuhinji (Cuisine)
    const kuhinjaTrim = kuhinja ? kuhinja.trim() : '';
    if (kuhinjaTrim !== '') {
        iskalniPogoji.cuisine = { $in: [kuhinjaTrim] };
    }
    
    // ⚠️ POZOR: POGOJ ZA ŠTEVILO OSEB IN DATUM JE IZKLJUČEN.
    
    try {
        
        console.log("🔥 MongoDB Iskalni Pogoji (KONČNA REŠITEV):", JSON.stringify(iskalniPogoji));

        // Izvedba poizvedbe
        const rezultati = await Restavracija.find(iskalniPogoji)
            // 🔥 KRITIČNI POPRAVEK: DODANO POLJE 'komentarji'
            .select('ime name title mainImageUrl galerija_slik cuisine opis ocena_povprecje googleRating googleReviewCount lokacija komentarji') 
            .limit(50);
        
        // ====================================================================
        // ⭐ KLJUČNO: ZAGOTOVITEV, DA JE ODGOVOR VEDNO ARRAY ZA FRONT-END
        // ====================================================================
        let restavracijeZaOdgovor = [];

        if (Array.isArray(rezultatov)) {
            restavracijeZaOdgovor = rezultati;
        } else if (rezultati && typeof rezultati === 'object' && Object.keys(rezultatov).length > 0) {
            // Če je rezultat en sam objekt in ne array (kar se je dogajalo)
            restavracijeZaOdgovor = [rezultati];
        } else {
            // Ni najdenih rezultatov
            restavracijeZaOdgovor = [];
        }

        console.log(`✅ Iskanje uspešno: Najdenih restavracij za vrnitev: ${restavracijeZaOdgovor.length}`);

        // Odgovor v Front-end je VEDNO array (seštevka restavracij ali prazen array)
        return res.status(200).json(restavracijeZaOdgovor);
        
    } catch (error) {
        console.error("❌ Napaka pri iskanju restavracij:", error);
        res.status(500).json({ msg: "Napaka strežnika pri iskanju.", error: error.message });
    }
};

// =================================================================
// 🌟 NOVO: Funkcija za pretečene rezervacije (DODAJTE JO V SERVER.JS!)
// =================================================================

/**
 * Označi rezervacije, ki so pretekle (datum in ura sta mimo) in niso bile potrjene, 
 * s statusom 'NI_POTRJENA'.
 * @access Kliče se avtomatsko preko CRON Job-a ali ob zagonu strežnika.
 */
exports.oznaciPretekleRezervacije = async () => {
    // Uporabimo današnji datum
    const danes = new Date();
    const vceraj = new Date(danes);
    vceraj.setDate(danes.getDate() - 1); 
    const vcerajISO = vceraj.toISOString().split('T')[0];
    
    // Čas za primerjavo DANAŠNJIH rezervacij: npr. 1 uro nazaj
    const pretekliCas = new Date(danes.getTime() - (60 * 60000)); 
    const uraMinuteZdaj = `${String(pretekliCas.getHours()).padStart(2, '0')}:${String(pretekliCas.getMinutes()).padStart(2, '0')}`;
    const danesISO = danes.toISOString().split('T')[0];

    try {
        // --- 1. KORAK: OČISTI VSE REZERVACIJE, KI SO PRETEKLE PRED VČERAJŠNJIM DNEVOM ---
        const rezultatVceraj = await Restavracija.updateMany(
            { 
                "mize.rezervacije.datum_rezervacije": { $lte: vcerajISO }, // Datum do vključno včeraj
                "mize.rezervacije.status": { $in: ['AKTIVNO', 'POTRJENO'] } // Očisti aktivne in potrjene (ki niso bile zaključene)
            },
            {
                $set: { 
                    "mize.$[].rezervacije.$[rez].status": 'NI_POTRJENA',
                    "mize.$[].rezervacije.$[rez].potrjen_prihod": false 
                }
            },
            {
                arrayFilters: [ 
                    { "rez.status": { $in: ['AKTIVNO', 'POTRJENO'] } } // Filter na status
                ]
            }
        );

        // --- 2. KORAK: OČISTI DANAŠNJE REZERVACIJE, KI SO PO URI ŽE PRETEKLE (npr. pred 1 uro) ---
        // Opomba: Ker ne moremo uporabiti $expr, uporabimo navaden tekstovni filter, 
        // ki dela samo za današnji dan, saj se teksti ure pravilno primerjajo.
        const rezultatDanes = await Restavracija.updateMany(
            { 
                "mize.rezervacije.datum_rezervacije": danesISO, // Samo današnji datum
                "mize.rezervacije.cas": { $lte: uraMinuteZdaj }, // Čas do 1 uro nazaj
                "mize.rezervacije.status": { $in: ['AKTIVNO', 'POTRJENO'] }
            },
            {
                $set: { 
                    "mize.$[].rezervacije.$[rez].status": 'NI_POTRJENA',
                    "mize.$[].rezervacije.$[rez].potrjen_prihod": false 
                }
            },
            {
                arrayFilters: [ 
                    { "rez.status": { $in: ['AKTIVNO', 'POTRJENO'] } }
                ]
            }
        );


        const skupnoPosodobljeno = rezultatVceraj.modifiedCount + rezultatDanes.modifiedCount;
        
        console.log(`✅ Uspešno označeno kot 'NI_POTRJENA': ${skupnoPosodobljeno} rezervacij.`);
        return skupnoPosodobljeno;
    } catch (error) {
        console.error("❌ Napaka pri označevanju preteklih rezervacij:", error);
        return 0;
    }
}