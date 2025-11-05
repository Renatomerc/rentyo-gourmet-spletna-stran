// ===============================================
// 🧪 TESTNI KONTROLER - ZA PREVERJANJE, ALI SE MODUL USPE NALOŽITI
// Vsa prava logika je začasno odstranjena.
// ===============================================

// 🛑 TEH VRSTIC NE UPORABLJAJTE V TEM TESTU!
// const Restavracija = require('../models/Restavracija'); 
// const mongoose = require('mongoose');


/**
 * 🚀 TEST FUNKCIJA ZA FRONTEND
 * Vrne samo testni JSON, da preveri, ali routa sploh dela.
 */
exports.getPrivzetoRestavracije = async (req, res) => {
    // 📢 LOG 1: Prva vrstica, ki se izvede. Če to vidimo, je z routerji in uvozom vse OK.
    console.log("=========================================");
    console.log("===> ZACETEK: TESTNI API KLIC /privzeto PREJET!");
    console.log("=========================================");

    // Namesto klica na bazo vrne navidezni odgovor
    return res.status(200).json([
        { ime: "TESTNI REZULTAT 1", lokacija: { coordinates: [0,0] }, description: "To je testni objekt." },
        { ime: "TESTNI REZULTAT 2", lokacija: { coordinates: [0,0] }, description: "To je testni objekt." }
    ]);
};


// ⛔ Ostale funkcije začasno vrnejo 500 ali so odstranjene za potrebe testa
exports.pridobiVseRestavracije = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.ustvariRestavracijo = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.pridobiRestavracijoPoId = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.posodobiRestavracijo = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.izbrisiRestavracijo = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.pridobiRestavracijePoBlizini = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.pridobiProsteUre = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.ustvariRezervacijo = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.izbrisiRezervacijo = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
exports.posodobiAdminVsebino = (req, res) => res.status(500).json({ msg: "TEST: Onemogočeno." });
