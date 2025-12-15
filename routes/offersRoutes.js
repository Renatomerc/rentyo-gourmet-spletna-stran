const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 

// GET /api/offers -> Pridobi vse aktivne ponudbe
// Omogoča filtriranje po kategoriji: /api/offers?category=event
router.get('/', async (req, res) => {
    
    // 1. Preverimo, ali je povezava z bazo pripravljena
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: "Storitev ni na voljo: Povezava z bazo še ni vzpostavljena." });
    }
    
    try {
        // Pridobimo Mongoose Native Connection Object
        const db = mongoose.connection.db; 
        
        // 2. Definiramo osnovno poizvedbo
        const query = { 
            is_active: true // Vedno iščemo samo aktivne ponudbe
        };
        
        // 🔥🔥🔥 KORAK 3: DODAJANJE FILTRA ZA KATEGORIJO 🔥🔥🔥
        const requestedCategory = req.query.category;
        
        if (requestedCategory) {
            // Preverimo, ali je kategorija prisotna v URL-ju (npr. ?category=event)
            // Dodamo filter za polje 'category' (ki ste ga dodali v dokumente)
            query.category = requestedCategory;
            
            console.log(`Filtriranje ponudb po kategoriji: ${requestedCategory}`);
        }
        
        // 4. Dostop do zbirke 'offers'
        const offersCollection = db.collection('offers'); 
        
        // 5. Izvedemo poizvedbo s spremenljivko 'query'
        // Poizvedba bo: { is_active: true } ALI { is_active: true, category: 'event' }
        const offers = await offersCollection.find(query).toArray(); 

        // 6. Pošljemo rezultate
        res.json(offers); 
        
    } catch (error) {
        console.error("Napaka pri pridobivanju ponudb iz MongoDB:", error);
        res.status(500).json({ message: "Napaka strežnika pri dostopu do podatkov o ponudbah." });
    }
});

module.exports = router;