const express = require('express');
const router = express.Router();

// 🚨 KRITIČNA NAPAKA POPRAVLJENA: Pot do config datoteke. 
// Ohranimo '../config/', saj je to standardno. Če ne deluje, pomeni, da je 
// datoteka 'cloudinaryConfig.js' v resnici v drugi mapi.
const cloudinary = require('../config/cloudinaryConfig'); // Uvoz Cloudinary konfiguracije
const multer = require('multer');
const fs = require('fs'); // Za brisanje začasne datoteke

// 🔥🔥🔥 POMEMBNO: Uvoz Mongoose modela restavracije
const Restavracija = require('../models/Restavracija'); 
// OPOZORILO: Pot '../models/Restavracija' je potrjena kot pravilna, ker je strežnik naložen!

// Nastavitev Multerja: določa, kam se začasno shrani datoteka, preden jo pošljemo na Cloudinary
const upload = multer({ dest: 'uploads/' }); 

/**
 * POST /api/upload/slika
 * Funkcija: Obravnava nalaganje ene datoteke ('file') in shranjevanje URL-ja v MongoDB.
 * Pričakuje: V multipart/form-data polje 'file' (sliko) IN polje 'restavracijaId' (ID restavracije).
 */
router.post('/slika', upload.single('file'), async (req, res) => {
    // 1. Pridobitev ID-ja restavracije iz telesa zahtevka
    const { restavracijaId } = req.body; 

    // 2. Preverjanje nujnih podatkov
    if (!req.file || !restavracijaId) {
        return res.status(400).json({ 
            msg: 'Manjka datoteka ("file") ali ID restavracije ("restavracijaId").' 
        });
    }
    
    // Pot do začasno shranjene datoteke v mapi 'uploads/'
    const filePath = req.file.path;

    try {
        // 3. Naloži datoteko na Cloudinary
        const rezultat = await cloudinary.uploader.upload(filePath, {
            folder: 'restavracije', 
            resource_type: 'auto'
        });

        // 🔥 4. ZELO POMEMBNO: Shranjevanje URL-ja v MongoDB 🔥
        const posodobljenaRestavracija = await Restavracija.findByIdAndUpdate(
            restavracijaId, 
            { 
                $set: { 
                    mainImageUrl: rezultat.secure_url // Shranimo celoten URL v polje, ki ga išče controller
                } 
            },
            { new: true, runValidators: true } // Vrne posodobljen dokument in sproži validatorje
        );
        
        // Preverjanje, ali je bila restavracija posodobljena
        if (!posodobljenaRestavracija) {
            fs.unlinkSync(filePath); 
            return res.status(404).json({ msg: 'Restavracija s tem ID-jem ni bila najdena.' });
        }
        // ----------------------------------------------------

        // 5. Izbriši začasno datoteko z lokalnega strežnika
        fs.unlinkSync(filePath); 

        // 6. Vrni končni URL
        res.status(200).json({
            msg: 'Slika uspešno naložena in URL shranjen v bazo.',
            url: rezultat.secure_url, 
            public_id: rezultat.public_id
        });

    } catch (error) {
        // Ob napaki poskrbimo za brisanje datoteke
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        console.error('Cloudinary/MongoDB napaka pri nalaganju:', error);
        res.status(500).json({ msg: 'Napaka pri nalaganju slike.', error: error.message });
    }
});

module.exports = router;