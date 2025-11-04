const express = require('express');
const router = express.Router();
const cloudinary = require('../config/cloudinaryConfig'); // Uvoz Cloudinary konfiguracije
const multer = require('multer');
const fs = require('fs'); // Za brisanje začasne datoteke

// Nastavitev Multerja: določa, kam se začasno shrani datoteka, preden jo pošljemo na Cloudinary
const upload = multer({ dest: 'uploads/' }); 

/**
 * POST /api/upload/slika
 * Avtorizacija: Tukaj mora biti v prihodnje admin avtorizacija!
 * Funkcija: Obravnava nalaganje ene datoteke ('file') na Cloudinary.
 */
router.post('/slika', upload.single('file'), async (req, res) => {
    // 1. Preverjanje, ali je datoteka sploh priložena
    if (!req.file) {
        return res.status(400).json({ msg: 'Datoteka ni priložena v zahtevku (uporabite ključ "file").' });
    }
    
    // Pot do začasno shranjene datoteke v mapi 'uploads/'
    const filePath = req.file.path;

    try {
        // 2. Naloži datoteko na Cloudinary
        const rezultat = await cloudinary.uploader.upload(filePath, {
            folder: 'restavracije', // Definira mapo v Cloudinary za boljšo organizacijo
            resource_type: 'auto'
        });

        // 3. ZELO POMEMBNO: Izbriši začasno datoteko z lokalnega strežnika
        fs.unlinkSync(filePath); 

        // 4. Vrni URL, ki ga shranimo v MongoDB
        res.status(200).json({
            msg: 'Slika uspešno naložena na Cloudinary.',
            url: rezultat.secure_url, // Ta URL shranite v MongoDB dokument restavracije
            public_id: rezultat.public_id
        });

    } catch (error) {
        // Ob napaki poskrbimo za brisanje datoteke
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error('Cloudinary napaka pri nalaganju:', error);
        res.status(500).json({ msg: 'Napaka pri nalaganju slike.', error: error.message });
    }
});

module.exports = router;