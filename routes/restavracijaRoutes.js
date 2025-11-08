// ===============================================
// 🚀 RESTAVRACIJA ROUTER (Poenostavljen in prečiščen)
// Poskrbi za usmerjanje. Logika je v Controllerju.
// ===============================================

// 🚨 POPRAVEK: Sprejmemo CELOTEN objekt, ki ga vrne authMiddleware
module.exports = ({ preveriGosta, zahtevajPrijavo }) => { 
    const express = require('express');
    const router = express.Router();
    
    // 🔥 KLJUČNO: Uvozimo vse funkcije iz controllerja
    const restavracijaController = require('../controllers/restavracijaController');
    
    
    // =================================================================
    // 💥 1. POTI Z FIKSNIMI IMENI (Ki niso ID-ji)
    // =================================================================

    // -----------------------------------------------------------------
    // 🟢 ZAČETNI KLIC ZA FRONTEND (Najpomembnejše!)
    // -----------------------------------------------------------------
    /**
     * GET /api/restavracije/privzeto
     * Povezava na funkcijo z obsežnim logiranjem, ki smo jo dodali v Controller.
     */
    router.get('/privzeto', restavracijaController.getPrivzetoRestavracije); 


    // -----------------------------------------------------------------
    // 🟢 DVE POTI ZA PREVERJANJE RAZPOLOŽLJIVOSTI:
    // -----------------------------------------------------------------
    
    // 1. Združljiva z odjemalcem: GET pot, ki uporablja parametre iz URL-ja (za stare klice/preverjanje)
    router.get('/preveri_rezervacijo/:restavracijaId/:datum/:stevilo_oseb', restavracijaController.pridobiProsteUre);
    
    // 2. Originalna POST pot (Priporočljiva, saj se parametri lažje prenašajo v telesu)
    router.post('/proste_ure', restavracijaController.pridobiProsteUre);
    
    
    // -----------------------------------------------------------------
    // 🌍 ISKANJE RESTAVRACIJ PO BLIŽINI (GEOSPATIAL $geoNear)
    // -----------------------------------------------------------------
    /**
     * GET /api/restavracije/blizina?lat=...&lon=...&radius=...
     */
    router.get('/blizina', restavracijaController.pridobiRestavracijePoBlizini);
    
    // -----------------------------------------------------------------
    // ADMIN: POSODOBITEV BOGATIH PODATKOV (Slike, Opis, Meni)
    // -----------------------------------------------------------------
    /**
     * PUT /api/restavracije/admin/posodobi_vsebino/:restavracijaId
     * Potreben je prijavljen uporabnik (admin), zato lahko uporabimo 'zahtevajPrijavo' ali 'preveriGosta' (če imate poseben middleware za admina). Zaenkrat pustimo 'preveriGosta'.
     */
    router.put('/admin/posodobi_vsebino/:restavracijaId', preveriGosta, restavracijaController.posodobiAdminVsebino);
    
    
    // -----------------------------------------------------------------
    // USTVARJANJE NOVE REZERVACIJE (/ustvari_rezervacijo)
    // -----------------------------------------------------------------
    /**
     * POST /api/restavracije/ustvari_rezervacijo
     * 🚨 POPRAVEK: Uporabi 'zahtevajPrijavo', da prepreči anonimne rezervacije.
     */
    router.post('/ustvari_rezervacijo', zahtevajPrijavo, restavracijaController.ustvariRezervacijo);


    // -----------------------------------------------------------------
    // BRISANJE REZERVACIJE (/izbrisi_rezervacijo)
    // -----------------------------------------------------------------
    /**
     * DELETE /api/restavracije/izbrisi_rezervacijo
     * 🚨 POPRAVEK: Tudi brisanje/preklic naj bo zaščiteno.
     */
    router.delete('/izbrisi_rezervacijo', zahtevajPrijavo, restavracijaController.izbrisiRezervacijo);
    
    
    // -----------------------------------------------------------------
    // 🟢 NOVO: POTI ZA PROFIL UPORABNIKA (AKTIVNE/ZGODOVINA)
    // -----------------------------------------------------------------
    /**
     * GET /api/restavracije/uporabnik/aktivne
     * 🚨 POPRAVEK: Obvezna prijava za dostop do profila.
     */
    router.get('/uporabnik/aktivne', zahtevajPrijavo, restavracijaController.pridobiAktivneRezervacijeUporabnika);

    /**
     * GET /api/restavracije/uporabnik/zgodovina
     * 🚨 POPRAVEK: Obvezna prijava za dostop do zgodovine.
     */
    router.get('/uporabnik/zgodovina', zahtevajPrijavo, restavracijaController.pridobiZgodovinoRezervacijUporabnika);


    // =================================================================
    // 💥 2. SPLOŠNI CRUD (/, POST /) - Fiksne poti brez parametrov
    // =================================================================
    
    router.route('/')
        // OSNOVNI CRUD: Pridobitev vseh restavracij (GET /)
        .get(restavracijaController.pridobiVseRestavracije)
        // OSNOVNI CRUD: Ustvarjanje nove restavracije (POST /)
        .post(preveriGosta, restavracijaController.ustvariRestavracijo);


    // =================================================================
    // 💥 3. DINAMIČNE POTI (/:id) - NA ZADNJE MESTO!
    // =================================================================

    router.route('/:id')
        // OSNOVNI CRUD: Pridobitev ene restavracije (GET /:id)
        .get(restavracijaController.pridobiRestavracijoPoId)
        // OSNOVNI CRUD: Posodabljanje restavracije (PUT /:id)
        .put(preveriGosta, restavracijaController.posodobiRestavracijo)
        // OSNOVNI CRUD: Brisanje restavracije (DELETE /:id)
        .delete(preveriGosta, restavracijaController.izbrisiRestavracijo);
    
    return router;
};