// ===============================================
// 🚀 RESTAVRACIJA ROUTER (Poenostavljen in prečiščen)
// Poskrbi za usmerjanje. Logika je v Controllerju.
// ===============================================

module.exports = (preveriGosta) => {
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
    // 🔥🔥 NOVO: RUTA ZA GLAVNO ISKANJE (POST /isci) 🔥🔥
    // -----------------------------------------------------------------
    /**
     * POST /api/restavracije/isci 
     * RUTA, ki jo kliče glavni iskalnik na frontend-u.
     * Logika iskanja naj bo v funkciji restavracijaController.isciRestavracije.
     */
    router.post('/isci', restavracijaController.isciRestavracije); 
    
    
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
     */
    router.put('/admin/posodobi_vsebino/:restavracijaId', preveriGosta, restavracijaController.posodobiAdminVsebino);
    
    
    // -----------------------------------------------------------------
    // USTVARJANJE NOVE REZERVACIJE (/ustvari_rezervacijo)
    // -----------------------------------------------------------------
    /**
     * POST /api/restavracije/ustvari_rezervacijo
     */
    router.post('/ustvari_rezervacijo', preveriGosta, restavracijaController.ustvariRezervacijo);


    // -----------------------------------------------------------------
    // BRISANJE REZERVACIJE (/izbrisi_rezervacijo)
    // -----------------------------------------------------------------
    /**
     * DELETE /api/restavracije/izbrisi_rezervacijo
     */
    router.delete('/izbrisi_rezervacijo', preveriGosta, restavracijaController.izbrisiRezervacijo);
    
    
    // -----------------------------------------------------------------
    // 🟢 NOVO: POTI ZA PROFIL UPORABNIKA (AKTIVNE/ZGODOVINA)
    // -----------------------------------------------------------------
    /**
     * GET /api/restavracije/uporabnik/aktivne
     */
    router.get('/uporabnik/aktivne', preveriGosta, restavracijaController.pridobiAktivneRezervacijeUporabnika);

    /**
     * GET /api/restavracije/uporabnik/zgodovina
     */
    router.get('/uporabnik/zgodovina', preveriGosta, restavracijaController.pridobiZgodovinoRezervacijUporabnika);


    // -----------------------------------------------------------------
    // 💥 NOVO: RUTA ZA ZAKLJUČEVANJE REZERVACIJ IN TOČKE ZVESTOBE
    // -----------------------------------------------------------------
    /**
     * PUT /api/restavracije/zakljuci_rezervacijo
     * Uporablja se za zaključevanje rezervacije in pripis 50 točk zvestobe.
     * (Običajno za admina ali lastnika restavracije)
     */
    router.put('/zakljuci_rezervacijo', preveriGosta, restavracijaController.oznaciRezervacijoKotZakljuceno);
    // -----------------------------------------------------------------


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