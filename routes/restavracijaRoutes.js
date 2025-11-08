// ===============================================
// 🚀 RESTAVRACIJA ROUTER (Poenostavljen in prečiščen)
// Poskrbi za usmerjanje. Logika je v Controllerju.
// ===============================================

// 🚨 POPRAVEK 1: Sprejme CELOTEN objekt authMiddleware za dostop do obeh funkcij
module.exports = ({ preveriGosta, zahtevajPrijavo }) => {
    const express = require('express');
    const router = express.Router();
    
    // 🔥 KLJUČNO: Uvozimo vse funkcije iz controllerja
    const restavracijaController = require('../controllers/restavracijaController');
    
    
    // =================================================================
    // 💥 1. POTI Z FIKSNIMI IMENI (Ki niso ID-ji)
    // =================================================================

    // -----------------------------------------------------------------
    // 🟢 ZAČETNI KLIC ZA FRONTEND (Ostane brez middleware-a)
    // -----------------------------------------------------------------
    router.get('/privzeto', restavracijaController.getPrivzetoRestavracije); 


    // -----------------------------------------------------------------
    // 🟢 DVE POTI ZA PREVERJANJE RAZPOLOŽLJIVOSTI: (Ostane brez middleware-a)
    // -----------------------------------------------------------------
    router.get('/preveri_rezervacijo/:restavracijaId/:datum/:stevilo_oseb', restavracijaController.pridobiProsteUre);
    router.post('/proste_ure', restavracijaController.pridobiProsteUre);
    
    
    // -----------------------------------------------------------------
    // 🌍 ISKANJE RESTAVRACIJ PO BLIŽINI (Ostane brez middleware-a)
    // -----------------------------------------------------------------
    router.get('/blizina', restavracijaController.pridobiRestavracijePoBlizini);
    
    // -----------------------------------------------------------------
    // ADMIN: POSODOBITEV BOGATIH PODATKOV 
    // 🚨 ZAŠČITA: Ostanemo pri preveriGosta, ker je to admin pot (Če imate admin auth, jo uporabite)
    // -----------------------------------------------------------------
    router.put('/admin/posodobi_vsebino/:restavracijaId', preveriGosta, restavracijaController.posodobiAdminVsebino);
    
    
    // -----------------------------------------------------------------
    // USTVARJANJE NOVE REZERVACIJE (/ustvari_rezervacijo)
    // 🚨 POPRAVEK 2: ZAHTEVAJ PRIJAVO
    // -----------------------------------------------------------------
    router.post('/ustvari_rezervacijo', zahtevajPrijavo, restavracijaController.ustvariRezervacijo);


    // -----------------------------------------------------------------
    // BRISANJE REZERVACIJE (/izbrisi_rezervacijo)
    // 🚨 POPRAVEK 3: ZAHTEVAJ PRIJAVO
    // -----------------------------------------------------------------
    router.delete('/izbrisi_rezervacijo', zahtevajPrijavo, restavracijaController.izbrisiRezervacijo);
    
    
    // -----------------------------------------------------------------
    // 🟢 NOVO: POTI ZA PROFIL UPORABNIKA (AKTIVNE/ZGODOVINA)
    // 🚨 POPRAVEK 4: ZAHTEVAJ PRIJAVO
    // -----------------------------------------------------------------
    router.get('/uporabnik/aktivne', zahtevajPrijavo, restavracijaController.pridobiAktivneRezervacijeUporabnika);
    router.get('/uporabnik/zgodovina', zahtevajPrijavo, restavracijaController.pridobiZgodovinoRezervacijUporabnika);


    // =================================================================
    // 💥 2. SPLOŠNI CRUD (/, POST /)
    // -----------------------------------------------------------------
    
    router.route('/')
        .get(restavracijaController.pridobiVseRestavracije)
        .post(preveriGosta, restavracijaController.ustvariRestavracijo);


    // =================================================================
    // 💥 3. DINAMIČNE POTI (/:id) 
    // -----------------------------------------------------------------

    router.route('/:id')
        .get(restavracijaController.pridobiRestavracijoPoId)
        .put(preveriGosta, restavracijaController.posodobiRestavracijo)
        .delete(preveriGosta, restavracijaController.izbrisiRestavracijo);
    
    return router;
};