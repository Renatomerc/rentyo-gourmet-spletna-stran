const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 

// 🔥 KLJUČEN POPRAVEK: Uvoz modela 'Offer'
// PRILAGODITE POT DO MODELA PO POTREBI (npr. '../models/Offer' ali './models/Offer')
const Offer = require('../models/Offer'); 

// GET /api/offers -> Pridobi vse aktivne ponudbe
// Omogoča filtriranje po kategoriji: /api/offers?category=event
router.get('/', async (req, res) => {
    
    // 1. Preverimo, ali je povezava z bazo pripravljena
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: "Storitev ni na voljo: Povezava z bazo še ni vzpostavljena." });
    }
    
    try {
        
        // 2. Definiramo osnovno poizvedbo
        const query = { 
            is_active: true // Vedno iščemo samo aktivne ponudbe
        };
        
        // 🔥🔥🔥 KORAK 3: DODAJANJE FILTRA ZA KATEGORIJO 🔥🔥🔥
        const requestedCategory = req.query.category;
        
        if (requestedCategory) {
            // Dodamo filter za polje 'category' v Mongoose poizvedbo
            query.category = requestedCategory;
            
            console.log(`Filtriranje ponudb po kategoriji: ${requestedCategory}`);
        }
        
        // 🔥 KLJUČEN POPRAVEK (4. in 5. korak združena): Uporabimo Mongoose Model Offer
        // Mongoose poizvedba s filtrom 'query'
        const offers = await Offer.find(query); 

        // 6. Pošljemo rezultate
        res.json(offers); 
        
    } catch (error) {
        console.error("Napaka pri pridobivanju ponudb iz MongoDB:", error);
        res.status(500).json({ message: "Napaka strežnika pri dostopu do podatkov o ponudbah." });
    }
});

module.exports = router;