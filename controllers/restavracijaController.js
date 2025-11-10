// ===============================================
// 🟢 RESTAVRACIJA CONTROLLER
// Vsebuje vso poslovno logiko za restavracije, rezervacije in Geo iskanje.
// ===============================================

// ⚠️ OPOMBA: Če se strežnik zatakne, je najverjetnejša težava pri uvozu ali definiciji modela.
const Restavracija = require('../models/Restavracija'); 
const mongoose = require('mongoose');

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
            { $limit: 10 },
            { $project: {
                _id: 1, 
                // Ključni podatki kartice
                imeRestavracije: { $ifNull: ["$ime", "$naziv", "Ime manjka v bazi (Controller)"] }, 
                urlSlike: { 
                    $ifNull: [
                        "$mainImageUrl", 
                        { $arrayElemAt: ["$galleryUrls", 0] }
                    ]
                },
                deviznaKuhinja: { $arrayElemAt: ["$cuisine", 0] },
                
                // POPRAVEK: Uporabimo polje $meni namesto $menu
                opis: { $ifNull: ["$opis", "Opis manjka."] }, 
                meni: 1, // <--- SEDAJ PRAVILNO
                
                // Ostala polja
                ocena_povprecje: { $ifNull: ["$ocena_povprecje", "$ocena", 0] },
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
                    { "mize.rezervacije.status": { $ne: 'PREKLICANO' } }
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
            const obstojeceRezervacije = (miza.rezervacije || []).filter(rez => rez.datum === datum);
            
            for (const obstojecaRezervacija of obstojeceRezervacije) {
                const obstojeceTrajanje = obstojecaRezervacija.trajanjeUr || 1.5;
                
                // Uporabimo dostopno funkcijo 'seRezervacijiPrekrivata'
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
            status: 'POTRJENO',
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
    const userId = req.uporabnik.id; 

    if (!userId) {
        return res.status(401).json({ msg: "Neavtorizirano: ID uporabnika manjka v žetonu." });
    }
    
    // Uporabimo današnji datum za filtriranje prihodnjih rezervacij
    const danesISO = new Date().toISOString().slice(0, 10); 
    console.log(`[AKTIVNE] Poskus pridobivanja za Uporabnik ID: ${userId} od datuma: ${danesISO}`); 

    try {
        const aktivne = await Restavracija.aggregate([
            { $match: { "mize": { $exists: true, $ne: [] } } },
            { $unwind: "$mize" },
            { $unwind: "$mize.rezervacije" },
            
            // FILTRIRANJE: Samo rezervacije trenutnega uporabnika in prihodnje
            { $match: { 
                "mize.rezervacije.uporabnikId": new mongoose.Types.ObjectId(userId),
                // Po trdem brisanju status ni več kritičen, a ga pustimo za vsak primer
                "mize.rezervacije.datum": { $exists: true, $gte: danesISO }, // Datum danes ali v prihodnosti (String primerjava)
                "mize.rezervacije.status": { $nin: ['PREKLICANO', 'ZAKLJUČENO'] } // Izključi neaktivne statuse
            }},

            // PROJEKCIJA: Dodan mizaId, ki ga frontend potrebuje za preklic
            { $project: {
                _id: "$mize.rezervacije._id", // ID rezervacije
                ime_restavracije: "$ime", // Ime restavracije
                restavracijaId: "$_id",
                mizaId: "$mize._id", // 💥 POPRAVEK: DODAN mizaId
                datum_rezervacije: "$mize.rezervacije.datum",
                cas_rezervacije: "$mize.rezervacije.casStart",
                stevilo_oseb: "$mize.rezervacije.stevilo_oseb",
                status: "$mize.rezervacije.status"
            }},
            
            { $sort: { datum_rezervacije: 1, cas_rezervacije: 1 } }
        ]);

        console.log(`[AKTIVNE] Število najdenih rezervacij: ${aktivne.length}`); 
        if (aktivne.length === 0) {
             console.log("[AKTIVNE] Agregacija ni vrnila rezultatov. Vzrok je verjetno MANJKAJOČE POLJE 'uporabnikId' v starejših testnih rezervacijah. Prosim, preverite bazo.");
        }

        res.status(200).json(aktivne);

    } catch (error) {
        console.error("Napaka pri pridobivanju aktivnih rezervacij uporabnika:", error);
        res.status(500).json({ msg: 'Napaka strežnika pri nalaganju aktivnih rezervacij.', error: error.message });
    }
};

/**
 * Pridobitev zgodovine (preteklih/preklicanih) rezervacij za prijavljenega uporabnika
 * GET /api/restavracije/uporabnik/zgodovina
 */
exports.pridobiZgodovinoRezervacijUporabnika = async (req, res) => {
    const userId = req.uporabnik.id; 

    if (!userId) {
        return res.status(401).json({ msg: "Neavtorizirano: ID uporabnika manjka v žetonu." });
    }

    const danesISO = new Date().toISOString().slice(0, 10); 

    try {
        const zgodovina = await Restavracija.aggregate([
            { $match: { "mize": { $exists: true, $ne: [] } } },
            { $unwind: "$mize" },
            { $unwind: "$mize.rezervacije" },
            
            // FILTRIRANJE
            { $match: { 
                "mize.rezervacije.uporabnikId": new mongoose.Types.ObjectId(userId),
                $or: [
                    // Pretekle rezervacije (datum je že pretekel)
                    { "mize.rezervacije.datum": { $lt: danesISO } },
                    // Rezervacije, ki so bile preklicane ne glede na datum
                    { "mize.rezervacije.status": "PREKLICANO" } 
                 ]
            }},

            // PROJEKCIJA: Dodan mizaId
            { $project: {
                _id: "$mize.rezervacije._id", // ID rezervacije
                ime_restavracije: "$ime", // Ime restavracije
                restavracijaId: "$_id",
                mizaId: "$mize._id", // 💥 POPRAVEK: DODAN mizaId
                datum_rezervacije: "$mize.rezervacije.datum",
                cas_rezervacije: "$mize.rezervacije.casStart",
                stevilo_oseb: "$mize.rezervacije.stevilo_oseb",
                status: "$mize.rezervacije.status"
            }},
            
            { $sort: { datum_rezervacije: -1, cas_rezervacije: -1 } } // Najnovejše pretekle na vrh
        ]);

        res.status(200).json(zgodovina);

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
        if (galerijaUrlsi) updateData.galleryUrls = galerijaUrlsi;
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