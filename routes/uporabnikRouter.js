// module.exports sedaj izvaža FUNKCIJO, ki prejme tajni ključ IN middleware.
// 👇 KLJUČNO: SPREJMEMO TRI PARAMETRE!
module.exports = (JWT_SECRET_KEY, preveriGosta, zahtevajPrijavo) => { 

    const express = require('express');
    const router = express.Router();
    const jwt = require('jsonwebtoken');
    const bcrypt = require('bcryptjs');
    
    // ⭐ 1. Uvozimo Shemo in Sekundarno povezavo
    const UporabnikShema = require('../models/Uporabnik'); 
    const dbUsers = require('../dbUsers'); 

    // ⭐ 2. KLJUČNO: Ustvarimo model, POVEZAN S SEKUNDARNO POVEZAVO
    const Uporabnik = dbUsers.model('Uporabnik', UporabnikShema);

    // ==========================================================
    // 🔴 KONČNI POPRAVEK: VAREN JWT KLJUČ
    // ==========================================================
    const TAJNI_KLJUC = JWT_SECRET_KEY; 

    if (!TAJNI_KLJUC) {
        console.error("❌ KRITIČNA NAPAKA: JWT_SECRET_KEY ni bil prenesen v uporabnikRouter.js. Preverite server.js!");
    }

    const generirajZeton = (uporabnikId) => {
        if (!TAJNI_KLJUC) {
            throw new Error("Napaka JWT: Tajni ključ ni na voljo.");
        }
        return jwt.sign({ id: uporabnikId }, TAJNI_KLJUC, { expiresIn: '7d' }); 
    };
    
    // ==========================================================
    // ✅ POPRAVLJENO: Pomožna funkcija za nastavitev piškotka
    // ==========================================================
    const nastaviAuthPiškotek = (res, zeton) => {
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('auth_token', zeton, {
            httpOnly: true,
            signed: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dni
            secure: isProduction, // ✅ HTTPS samo v produkciji
            sameSite: isProduction ? 'None' : 'Lax', // ✅ deluje lokalno in v CORS
            path: '/'
        });
    };
    // ==========================================================

    // Registracija
    router.post('/registracija', async (req, res) => {
        console.log("🔥 DEBUG: Klic Registracije Prejet!"); 

        // ⭐ POPRAVEK: Iz req.body izluščimo VSA možna polja
        const { 
            ime, 
            priimek, 
            telefon, 
            email, 
            geslo, 
            jeLastnik, 
            cena, 
            fcmToken, // KLJUČNO: Izluščimo fcmToken
        } = req.body;
        
        // Osnovna validacija
        if (!ime || !email || !geslo) return res.status(400).json({ msg: 'Vnesite vsa obvezna polja: ime, e-mail in geslo.' });
        if (jeLastnik && (cena === undefined || cena === null))
            return res.status(400).json({ msg: 'Kot lastnik morate določiti ceno.' });

        try {
            const obstojec = await Uporabnik.findOne({ email });
            if (obstojec) return res.status(400).json({ msg: 'Uporabnik že obstaja s tem e-mailom.' });

            const salt = await bcrypt.genSalt(10);
            const hashiranoGeslo = await bcrypt.hash(geslo, salt);

            // ⭐ NOVO: Ustvarimo objekt s podatki za bazo
            const uporabnikData = { 
                ime, 
                priimek: priimek || '',      // Varno, če ni posredovano
                telefon: telefon || '',      // Varno, če ni posredovano
                email, 
                geslo: hashiranoGeslo, 
                jeLastnik: jeLastnik || false, 
                cena: cena || 0,
            };

            // ⭐ ZAOBID NAPAKE E11000: Dodaj fcmToken SAMO, če ima vrednost.
            // S tem preprečimo vstavljanje eksplicitne vrednosti 'null' in zaobidemo napako.
            if (fcmToken) {
                uporabnikData.fcmToken = fcmToken;
            }
            
            const novUporabnik = await Uporabnik.create(uporabnikData); // Uporabimo objekt uporabnikData
            
            const zeton = generirajZeton(novUporabnik._id);
            nastaviAuthPiškotek(res, zeton); 

            res.status(201).json({
                _id: novUporabnik._id,
                ime: novUporabnik.ime,
                email: novUporabnik.email,
                jeLastnik: novUporabnik.jeLastnik,
                cena: novUporabnik.cena,
                zeton: zeton, 
                msg: "Registracija uspešna. Žeton shranjen v varnem piškotku in JSON." 
            });

        } catch (err) {
            // ⭐ POPRAVEK: Obravnava E11000 napake
            if (err.code === 11000) {
                console.error('❌ NAPAKA PRI REGISTRACIJI (MongoDB Duplicate Key):', err.message);
                return res.status(409).json({ msg: 'Vneseni e-mail ali drugi podatki so že v uporabi.' });
            }
            
            console.error('❌ KRITIČNA NAPAKA PRI REGISTRACIJI:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri registraciji. Prosimo, poskusite znova.' });
        }
    });

    // Prijava
    router.post('/prijava', async (req, res) => {
        console.log("🔥 DEBUG: Klic Prijave Prejet!"); 
        
        const { email, geslo } = req.body;
        try {
            // Uporabnik je v tem klicu že najden v DB, zato je polje tockeZvestobe že na voljo
            const uporabnik = await Uporabnik.findOne({ email });
            if (!uporabnik) return res.status(401).json({ msg: 'Neveljavne poverilnice.' });

            const gesloPravilno = await bcrypt.compare(geslo, uporabnik.geslo);
            if (!gesloPravilno) return res.status(401).json({ msg: 'Neveljavne poverilnice.' });

            const zeton = generirajZeton(uporabnik._id);
            nastaviAuthPiškotek(res, zeton); 

            res.json({
                _id: uporabnik._id,
                ime: uporabnik.ime,
                email: uporabnik.email,
                jeLastnik: uporabnik.jeLastnik,
                cena: uporabnik.cena,
                // 🚀 DODANO: Žeton za frontend (shranjevanje v localStorage)
                zeton: zeton, // ⬅️ KLJUČNO!
                msg: "Prijava uspešna. Žeton shranjen v varnem piškotku in JSON." 
            });
        } catch (err) {
            console.error('❌ NAPAKA PRI PRIJAVI:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri prijavi.' });
        }
    });
    
    // Odjava
    router.post('/odjava', (req, res) => {
        res.cookie('auth_token', '', { 
            httpOnly: true, 
            expires: new Date(0),
            path: '/' 
        });
        res.status(200).json({ msg: 'Uspešno odjavljen. Piškotek izbrisan.' });
    });

    // Zaščitena pot: /api/auth/profil
    // 🟢 POPRAVEK: Ruta je sedaj ASINHRONA in neposredno kliče bazo!
    router.get('/profil', preveriGosta, zahtevajPrijavo, async (req, res) => {
        
        // Uporabimo ID, ki ga dobimo iz JWT in je shranjen v req.uporabnik (ali req.user/req.payload)
        const uporabnikId = req.uporabnik._id || req.uporabnik.id; 

        try {
            // 🟢 KLJUČNA SPREMEMBA: Poiščemo uporabnika neposredno v bazi,
            // da dobimo VSE POSODOBLJENE PODATKE, vključno s točkeZvestobe.
            const uporabnikDB = await Uporabnik.findById(uporabnikId).select('-geslo');

            if (!uporabnikDB) {
                return res.status(404).json({ msg: 'Profilni podatki niso najdeni v bazi.' });
            }
            
            res.json({
                msg: "Podatki profila uspešno pridobljeni.",
                uporabnik: { 
                    _id: uporabnikDB._id, 
                    ime: uporabnikDB.ime, 
                    email: uporabnikDB.email, 
                    jeLastnik: uporabnikDB.jeLastnik, 
                    cena: uporabnikDB.cena,
                    // 🟢 NOVO: TOČKE ZVESTOBE
                    tockeZvestobe: uporabnikDB.tockeZvestobe 
                }
            });

        } catch (err) {
            console.error('❌ NAPAKA PRI NALAGANJU PROFILA IZ BAZE:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri nalaganju profila.' });
        }
    });

    return router; 
};