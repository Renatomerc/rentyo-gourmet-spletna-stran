const express = require('express');
const router = express.Router();
// Ker se vaš server.js povezuje z Mongoose, ga uporabimo tudi tukaj.
const mongoose = require('mongoose'); 

// GET /api/offers -> Pridobi vse aktivne ponudbe
// (Pot '/' tukaj v kontekstu server.js pomeni '/api/offers')
router.get('/', async (req, res) => {
    
    // 1. Preverimo, ali je povezava z bazo pripravljena
    if (mongoose.connection.readyState !== 1) {
        // ReadyState 1 pomeni 'connected'
        return res.status(503).json({ message: "Storitev ni na voljo: Povezava z bazo še ni vzpostavljena." });
    }
    
    try {
        // Pridobimo Mongoose Native Connection Object, ki omogoča neposreden dostop do zbirk
        const db = mongoose.connection.db; 
        
        // 2. Dostop do zbirke 'offers'
        const offersCollection = db.collection('offers'); 
        
        // 3. Najdi vse dokumente, kjer je is_active nastavljeno na true, in jih pretvori v polje
        // To zagotavlja skalabilnost in ne pošilja vseh 500 ponudb, če niso aktivne.
        const offers = await offersCollection.find({ is_active: true }).toArray(); 

        // 4. Pošlji polje ponudb Frontendu
        res.json(offers); 
        
    } catch (error) {
        console.error("Napaka pri pridobivanju ponudb iz MongoDB:", error);
        res.status(500).json({ message: "Napaka strežnika pri dostopu do podatkov o ponudbah." });
    }
});

module.exports = router;