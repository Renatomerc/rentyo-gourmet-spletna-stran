const express = require('express');
const router = express.Router();
const Promocija = require('../models/Promocija');

// Pot: GET /api/promocije?lang=sl
router.get('/', async (req, res) => {
    try {
        const lang = req.query.lang || 'sl';
        // Tu lahko kasneje dodaš še filtriranje po državi, če želiš
        const promocije = await Promocija.find({ aktivna: true }).sort({ ustvarjeno: -1 });
        res.json(promocije);
    } catch (err) {
        res.status(500).json({ message: "Napaka pri nalaganju promocij", error: err.message });
    }
});

module.exports = router;