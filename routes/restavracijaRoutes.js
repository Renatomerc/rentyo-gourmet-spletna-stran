// To je ROUTER za vse operacije z restavracijami, vključno z logiko rezervacij.

module.exports = (preveriGosta) => {
    const express = require('express');
    const router = express.Router();
    
    // Uvoz modela Restavracija.
    const Restavracija = require('../models/Restavracija'); 
    
    // Dodatno uvozimo Mongoose, da lahko uporabimo new mongoose.Types.ObjectId
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
    // 💥 1. POTI Z FIKSNIMI IMENI (Proste ure, Rezervacije, Admin, itd.) 
    //    MORAL BI BITI NA VRHU, DA JIH NE PRESTREŽE /:id
    // =================================================================

    // -----------------------------------------------------------------
    // ADMIN: POSODOBITEV BOGATIH PODATKOV (Slike, Opis, Meni)
    // -----------------------------------------------------------------
    /**
     * PUT /api/restavracije/admin/posodobi_vsebino/:restavracijaId
     */
    router.put('/admin/posodobi_vsebino/:restavracijaId', preveriGosta, async (req, res) => { 
        const restavracijaId = req.params.restavracijaId;
        const { novOpis, glavnaSlikaUrl, galerijaUrlsi, novMeni } = req.body;

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
            console.error('Napaka pri posodabljanju vsebine:', error);
            res.status(500).json({ msg: 'Napaka serverja.' });
        }
    });
    
    // -----------------------------------------------------------------
    // NOVO: 1. IZRAČUN PROSTIH UR IN MIZ (/proste_ure)
    // -----------------------------------------------------------------
    /**
     * POST /api/restavracije/proste_ure
     */
    router.post('/proste_ure', async (req, res) => {
        const { restavracijaId, datum, stevilo_oseb, trajanjeUr } = req.body;

        if (!restavracijaId || !datum || !stevilo_oseb) {
            return res.status(400).json({ msg: 'Manjkajoči podatki: restavracijaId, datum ali stevilo_oseb.' });
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
                        mizaIme: miza.Miza, 
                        mizaId: miza._id, 
                        kapaciteta: miza.kapaciteta,
                        prosteUre: prosteUre
                    });
                }
            }

            res.json({ msg: 'Uspešno pridobljene proste mize in ure.', mize: koncniRezultati });

        } catch (error) {
            console.error('Napaka pri preverjanju prostih ur:', error);
            res.status(500).json({ msg: 'Napaka serverja.' });
        }
    });


    // -----------------------------------------------------------------
    // NOVO: 2. USTVARJANJE NOVE REZERVACIJE (/ustvari_rezervacijo)
    // -----------------------------------------------------------------
    /**
     * POST /api/restavracije/ustvari_rezervacijo
     */
    router.post('/ustvari_rezervacijo', preveriGosta, async (req, res) => {
        const { restavracijaId, mizaId, imeGosta, telefon, stevilo_oseb, datum, casStart, trajanjeUr } = req.body;
        
        if (!restavracijaId || !mizaId || !imeGosta || !datum || !casStart) {
            return res.status(400).json({ msg: 'Manjkajo vsi potrebni podatki za rezervacijo (restavracijaId, mizaId, imeGosta, datum, casStart).' });
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

            const obstojeceRezervacije = (izbranaMiza.rezervacije || []).filter(rez => rez.datum === datum);

            for (const obstojecaRezervacija of obstojeceRezervacije) {
                const obstojeceTrajanje = obstojecaRezervacija.trajanjeUr || 1.5;
                if (seRezervacijiPrekrivata(casZacetka, trajanje, obstojecaRezervacija.casStart, obstojeceTrajanje)) {
                    return res.status(409).json({ msg: `Miza ${izbranaMiza.Miza} je že zasedena v tem času. Prosimo, izberite drugo uro.` });
                }
            }
            
            const novaRezervacija = {
                imeGosta,
                telefon,
                stevilo_oseb: stevilo_oseb || 2,
                datum,
                casStart: casZacetka,
                trajanjeUr: trajanje,
                // userId: req.user.id 
            };

            const rezultat = await Restavracija.updateOne(
                { _id: restavracijaId, "mize._id": mizaId },
                { $push: { "mize.$.rezervacije": novaRezervacija } }
            );

            if (rezultat.modifiedCount === 0) {
                 return res.status(500).json({ msg: 'Napaka pri shranjevanju. Restavracija ali miza ni bila najdena.' });
            }

            res.status(201).json({ 
                msg: `Rezervacija uspešno ustvarjena za ${izbranaMiza.Miza} ob ${casStart}.`,
                rezervacija: novaRezervacija 
            });

        } catch (error) {
            console.error('Napaka pri ustvarjanju rezervacije:', error);
            res.status(500).json({ msg: 'Napaka serverja.' });
        }
    });


    // -----------------------------------------------------------------
    // NOVO: 3. BRISANJE REZERVACIJE (/izbrisi_rezervacijo)
    // -----------------------------------------------------------------
    /**
     * DELETE /api/restavracije/izbrisi_rezervacijo
     */
    router.delete('/izbrisi_rezervacijo', preveriGosta, async (req, res) => {
        const { restavracijaId, mizaId, rezervacijaId } = req.body;

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
    });

    
    // =================================================================
    // 💥 2. DINAMIČNE POTI (/:id in /) - NA ZADNJEM MESTU!
    // =================================================================

    // -----------------------------------------------------------------
    // OSNOVNI CRUD: Splošna pot za posodabljanje restavracije (PUT /:id)
    // -----------------------------------------------------------------
    router.put('/:id', preveriGosta, async (req, res) => {
        try {
            const restavracijaId = req.params.id;
            const updateData = req.body; 

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
    });

    // -----------------------------------------------------------------
    // OSNOVNI CRUD: Pridobitev vseh restavracij (GET /)
    // -----------------------------------------------------------------
    router.get('/', async (req, res) => {
        try {
            const restavracije = await Restavracija.find({});
            res.json(restavracije);
        } catch (error) {
            res.status(500).json({ msg: 'Napaka pri pridobivanju restavracij.' });
        }
    });

    // -----------------------------------------------------------------
    // OSNOVNI CRUD: Pridobitev ene restavracije (GET /:id)
    // -----------------------------------------------------------------
    router.get('/:id', async (req, res) => {
        try {
            const restavracija = await Restavracija.findById(req.params.id);
            if (!restavracija) return res.status(404).json({ msg: 'Restavracija ni najdena.' });
            res.json(restavracija);
        } catch (error) {
            res.status(500).json({ msg: 'Napaka serverja.' });
        }
    });
    
    return router;
};