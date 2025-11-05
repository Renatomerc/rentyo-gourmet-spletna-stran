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
 */
exports.pridobiProsteUre = async (req, res) => {
    
    // Prilagodljivo branje: Najprej poskusimo BODY (POST), nato PARAMS (GET)
    const restavracijaId = req.body.restavracijaId || req.params.restavracijaId;
    const datum = req.body.datum || req.params.datum;
    const stevilo_oseb_string = req.body.stevilo_oseb || req.params.stevilo_oseb; 
    const trajanjeUr = req.body.trajanjeUr; 

    if (!restavracijaId || !datum || !stevilo_oseb_string) {
        return res.status(400).json({ msg: 'Manjkajoči podatki: restavracijaId, datum ali stevilo_oseb.' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(restavracijaId)) {
        return res.status(400).json({ msg: 'Neveljaven format ID restavracije.' });
    }

    const stevilo_oseb = parseInt(stevilo_oseb_string);
    if (isNaN(stevilo_oseb) || stevilo_oseb <= 0) {
        return res.status(400).json({ msg: 'Neveljavno število oseb.' });
    }


    try {
        const interval = 0.5; 
        const privzetoTrajanje = trajanjeUr ? parseFloat(trajanjeUr) : 1.5; 
        
        const rezultatiAggregation = await Restavracija.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(restavracijaId) } }, 
            { $unwind: "$mize" }, 
            { $match: { "mize.kapaciteta": { $gte: stevilo_oseb } } }, 
            { $project: {
                _id: 0, 
                miza: "$mize",
                delovniCasStart: "$delovniCasStart",
                delovniCasEnd: "$delovniCasEnd"
            }}
        ]);

        if (rezultatiAggregation.length === 0) {
            return res.json({ msg: 'Ni ustreznih miz za to število oseb.', mize: [] });
        }

        const koncniRezultati = [];
        const casZacetka = rezultatiAggregation[0].delovniCasStart || 8; 
        const casZaprtja = rezultatiAggregation[0].delovniCasEnd || 23; 
        const minimalniCasKonca = casZaprtja - privzetoTrajanje;

        for (const aggResult of rezultatiAggregation) {
            const miza = aggResult.miza;
            const prosteUre = [];
            
            const mizaImeZaIzpis = miza.Miza || miza.ime || miza.naziv || `ID: ${miza._id.toString().substring(0, 4)}...`;

            const obstojeceRezervacije = (miza.rezervacije || []).filter(rez => rez.datum === datum);

            for (let ura = casZacetka; ura <= minimalniCasKonca; ura += interval) {
                
                const uraFormatirana = parseFloat(ura.toFixed(2));
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
        console.error('Napaka pri preverjanju prostih ur:', error);
        res.status(500).json({ msg: 'Napaka serverja pri pridobivanju prostih ur.' });
    }
};

/**
 * Ustvarjanje nove rezervacije (POST /ustvari_rezervacijo)
 */
exports.ustvariRezervacijo = async (req, res) => {
    const { restavracijaId, mizaId, imeGosta, telefon, stevilo_oseb, datum, casStart, trajanjeUr } = req.body;
    
    if (!restavracijaId || !mizaId || !imeGosta || !datum || !casStart) {
        return res.status(400).json({ msg: 'Manjkajo vsi potrebni podatki za rezervacijo (restavracijaId, mizaId, imeGosta, datum, casStart).' });
    }

    if (!mongoose.Types.ObjectId.isValid(restavracijaId) || !mongoose.Types.ObjectId.isValid(mizaId)) {
        const neveljavenId = !mongoose.Types.ObjectId.isValid(restavracijaId) ? restavracijaId : mizaId;
        return res.status(400).json({ msg: `Neveljaven format ID: "${neveljavenId}"` });
    }

    try {
        const trajanje = parseFloat(trajanjeUr) || 1.5;
        const casZacetka = parseFloat(casStart);
        
        const restavracija = await Restavracija.findById(restavracijaId, 'mize').lean();

        if (!restavracija) {
            return res.status(404).json({ msg: 'Restavracija ni najdena.' });
        }
        
        const izbranaMiza = restavracija.mize.find(m => m._id.toString() === mizaId);

        if (!izbranaMiza) {
             return res.status(404).json({ msg: 'Miza ni najdena v restavraciji.' });
        }

        const mizaIme = izbranaMiza.Miza || izbranaMiza.ime || izbranaMiza.naziv || `ID: ${izbranaMiza._id.toString().substring(0, 4)}...`;

        const obstojeceRezervacije = (izbranaMiza.rezervacije || []).filter(rez => rez.datum === datum);

        for (const obstojecaRezervacija of obstojeceRezervacije) {
            const obstojeceTrajanje = obstojecaRezervacija.trajanjeUr || 1.5;
            if (seRezervacijiPrekrivata(casZacetka, trajanje, obstojecaRezervacija.casStart, obstojeceTrajanje)) {
                return res.status(409).json({ 
                    msg: `Miza ${mizaIme} je že zasedena v tem času. Prosimo, izberite drugo uro.`,
                    status: "ZASEDNO"
                });
            }
        }
        
        const novaRezervacija = {
            imeGosta,
            telefon,
            stevilo_oseb: stevilo_oseb || 2,
            datum,
            casStart: casZacetka,
            trajanjeUr: trajanje,
            status: 'POTRJENO',
        };

        const rezultat = await Restavracija.updateOne(
            { _id: restavracijaId, "mize._id": mizaId },
            { $push: { "mize.$.rezervacije": novaRezervacija } }
        );

        if (rezultat.modifiedCount === 0) {
             return res.status(500).json({ msg: 'Napaka pri shranjevanju. Restavracija ali miza ni bila najdena ali posodobljena.' });
        }

        res.status(201).json({ 
            msg: `Rezervacija uspešno ustvarjena za ${mizaIme} ob ${casStart}.`,
            rezervacija: novaRezervacija 
        });

    } catch (error) {
        console.error('Napaka pri ustvarjanju rezervacije:', error);
        res.status(500).json({ msg: 'Napaka serverja pri ustvarjanju rezervacije.' });
    }
};

/**
 * Brisanje rezervacije (DELETE /izbrisi_rezervacijo)
 */
exports.izbrisiRezervacijo = async (req, res) => {
    const { restavracijaId, mizaId, rezervacijaId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(restavracijaId) || !mongoose.Types.ObjectId.isValid(mizaId) || !mongoose.Types.ObjectId.isValid(rezervacijaId)) {
        return res.status(400).json({ msg: 'Neveljaven format ID-ja.' });
    }

    try {
        const rezultat = await Restavracija.updateOne(
            { _id: restavracijaId, "mize._id": mizaId },
            { "$pull": { "mize.$.rezervacije": { _id: rezervacijaId } } }
        );

        if (rezultat.modifiedCount === 0) {
            return res.status(404).json({ msg: 'Rezervacija ali miza ni najdena za izbris.' });
        }

        res.json({ msg: 'Rezervacija uspešno preklicana.' });

    } catch (error) {
        console.error('Napaka pri brisanju rezervacije:', error);
        res.status(500).json({ msg: 'Napaka serverja.' });
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