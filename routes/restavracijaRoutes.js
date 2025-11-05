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
    // 🟢 DVE POTI ZA PREVERJANJE RAZPOLOŽLJIVOSTI:
    // -----------------------------------------------------------------
    
    // 1. Združljiva z odjemalcem: GET pot, ki uporablja parametre iz URL-ja (za stare klice/preverjanje)
    // Če odjemalec kliče /api/restavracije/preveri_rezervacijo/ID/DATUM/OSEBE, se ujema tukaj.
    /**
     * GET /api/restavracije/preveri_rezervacijo/:restavracijaId/:datum/:stevilo_oseb
     * Uporabimo enak controller kot za proste_ure, če zmore obdelati obe obliki.
     * PREDPOSTAVKA: pridobiProsteUre zmore prebrati tudi req.params (za GET).
     */
    router.get('/preveri_rezervacijo/:restavracijaId/:datum/:stevilo_oseb', restavracijaController.pridobiProsteUre);
    
    // 2. Originalna POST pot (Priporočljiva, saj se parametri lažje prenašajo v telesu)
    /**
     * POST /api/restavracije/proste_ure
     */
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