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
    obstojeceCasStart = parseFloat(obstojeCasStart);
    obstojeceTrajanje = parseFloat(obstojeceTrajanje);
    
    const novaCasKonec = novaCasStart + novaTrajanje;
    const obstojeceCasKonec = obstojeceCasStart + obstojeceTrajanje;
    
    // Logika prekrivanja: A.Start < B.End AND B.Start < A.End
    return novaCasStart < obstojeceCasKonec && obstojeceCasStart < novaCasKonec;
};

// =================================================================
// 1. CRUD operacije (Osnovni)
// ... OSTALA KODA (GET, POST, PUT, DELETE) OSTANE NESPREMENJENA ...
// =================================================================

/**
 * 🚀 **FUNKCIJA ZA FRONTEND (KONČNA POPRAVLJENA AGGREGATION)**
 * ...
 */
exports.getPrivzetoRestavracije = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};

/**
 * Pridobitev vseh restavracij (GET /) - Originalni kontroler
 */
exports.pridobiVseRestavracije = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};

/**
 * Ustvarjanje nove restavracije (POST /)
 */
exports.ustvariRestavracijo = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};

/**
 * Pridobitev ene restavracije po ID (GET /:id)
 */
exports.pridobiRestavracijoPoId = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};

/**
 * Posodobitev restavracije po ID (PUT /:id)
 */
exports.posodobiRestavracijo = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};

/**
 * Brisanje restavracije po ID (DELETE /:id)
 */
exports.izbrisiRestavracijo = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};


// =================================================================
// 2. Geospatial in rezervacijska logika
// ... OSTALA KODA OSTANE NESPREMENJENA ...
// =================================================================

/**
 * Geospatial iskanje (GET /blizina)
 */
exports.pridobiRestavracijePoBlizini = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};


/**
 * Pridobivanje prostih ur (POST /proste_ure ALI GET /preveri_rezervacijo/:id/:datum/:osebe)
 * 🔥 POPRAVEK: Zmanjšanje intervala na polno uro (1.0).
 */
exports.pridobiProsteUre = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};

/**
 * Ustvarjanje nove rezervacije (POST /ustvari_rezervacijo)
 * 💥 POPRAVEK: DODAN `uporabnikId` IZ REQ.UPORABNIK.ID ZA FILTRIRANJE NA PROFILU
 */
exports.ustvariRezervacijo = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};

/**
 * Brisanje rezervacije (DELETE /izbrisi_rezervacijo)
 */
exports.izbrisiRezervacijo = async (req, res) => {
// ... OSTALA KODA OSTANE NESPREMENJENA ...
};


// =================================================================
// 💥 4. FUNKCIJE ZA PROFIL UPORABNIKA (NOVO)
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
    console.log(`[AKTIVNE] Poskus pridobivanja za Uporabnik ID: ${userId} od datuma: ${danesISO}`); // 💡 DIAGNOSTIKA

    try {
        const aktivne = await Restavracija.aggregate([
            { $match: { "mize": { $exists: true, $ne: [] } } },
            { $unwind: "$mize" },
            { $unwind: "$mize.rezervacije" },
            
            // FILTRIRANJE: Samo rezervacije trenutnega uporabnika in prihodnje
            { $match: { 
                "mize.rezervacije.uporabnikId": new mongoose.Types.ObjectId(userId),
                // Dodan $exists: true, da se izognemo napakam, če je polje na katerem koli zapisu prazno
                "mize.rezervacije.datum": { $exists: true, $gte: danesISO }, 
                "mize.rezervacije.status": { $nin: ['PREKLICANO', 'ZAKLJUČENO'] } 
            }},

            // PROJEKCIJA: Izloči samo relevantne podatke za Frontend
            { $project: {
                _id: "$mize.rezervacije._id", // ID rezervacije
                ime_restavracije: "$ime", // Ime restavracije
                restavracijaId: "$_id",
                datum_rezervacije: "$mize.rezervacije.datum",
                cas_rezervacije: "$mize.rezervacije.casStart",
                stevilo_oseb: "$mize.rezervacije.stevilo_oseb",
                status: "$mize.rezervacije.status"
            }},
            
            { $sort: { datum_rezervacije: 1, cas_rezervacije: 1 } }
        ]);

        console.log(`[AKTIVNE] Število najdenih rezervacij: ${aktivne.length}`); // 💡 DIAGNOSTIKA
        if (aktivne.length === 0) {
             console.log("[AKTIVNE] Agregacija ni vrnila rezultatov. Preverite: 1) format datuma v bazi (YYYY-MM-DD), 2) ujemanje uporabnikId, 3) status.");
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
            
            // FILTRIRANJE: Samo rezervacije trenutnega uporabnika
            { $match: { 
                "mize.rezervacije.uporabnikId": new mongoose.Types.ObjectId(userId),
                $or: [
                    // Pretekle rezervacije (datum je že pretekel)
                    { "mize.rezervacije.datum": { $lt: danesISO } },
                    // Rezervacije, ki so bile preklicane ne glede na datum
                    { "mize.rezervacije.status": "PREKLICANO" } 
                 ]
            }},

            // PROJEKCIJA
            { $project: {
                _id: "$mize.rezervacije._id", // ID rezervacije
                ime_restavracije: "$ime", // Ime restavracije
                restavracijaId: "$_id",
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
// ... OSTALA KODA OSTANE NESPREMENJENA ...
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