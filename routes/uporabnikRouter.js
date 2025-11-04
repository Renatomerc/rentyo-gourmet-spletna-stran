// module.exports sedaj izvaža FUNKCIJO, ki prejme tajni ključ IN middleware.
// 👇 KLJUČNO: SPREJMEMO DVA PARAMETRA!
module.exports = (JWT_SECRET_KEY, preveriGosta) => { 

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
        // Žeton za piškotek lahko damo daljšo veljavnost, saj se preverja na vsaki zahtevi
        return jwt.sign({ id: uporabnikId }, TAJNI_KLJUC, { expiresIn: '7d' }); 
    };
    
    // ⭐ POPRAVLJENO: Pomožna funkcija za nastavitev piškotka (Z SAME SITE: 'None')
    const nastaviAuthPiškotek = (res, zeton) => {
        // Piškotek za avtentikacijo:
        res.cookie('auth_token', zeton, {
            httpOnly: true, // ZELO POMEMBNO: onemogoči dostop iz JavaScripta
            signed: true,   // Uporabi COOKIE_SECRET iz server.js za podpisovanje
            maxAge: 7 * 24 * 60 * 60 * 1000, // Veljavnost 7 dni (v milisekundah)
            secure: true,   // KLJUČNO: Ker Render vedno uporablja HTTPS (in 'None' zahteva secure)
            sameSite: 'None' // KLJUČNO ZA CORS: Omogoči prenos piškotkov med domenama
        });
    };
    // ==========================================================

    // Registracija
    router.post('/registracija', async (req, res) => {
        console.log("🔥 DEBUG: Klic Registracije Prejet!"); 

        const { ime, email, geslo, jeLastnik, cena } = req.body;
        
        if (!ime || !email || !geslo) return res.status(400).json({ msg: 'Vnesite vsa polja.' });
        if (jeLastnik && (cena === undefined || cena === null))
            return res.status(400).json({ msg: 'Kot lastnik morate določiti ceno.' });

        try {
            const obstojec = await Uporabnik.findOne({ email });
            if (obstojec) return res.status(400).json({ msg: 'Uporabnik že obstaja.' });

            const salt = await bcrypt.genSalt(10);
            const hashiranoGeslo = await bcrypt.hash(geslo, salt);

            const novUporabnik = await Uporabnik.create({ 
                ime, 
                email, 
                geslo: hashiranoGeslo, 
                jeLastnik: jeLastnik || false, 
                cena: cena || 0 
            });
            
            const zeton = generirajZeton(novUporabnik._id);
            nastaviAuthPiškotek(res, zeton); // <--- NOVO: Nastavi piškotek!

            // V odgovor ne pošljemo več žetona, ampak samo podatke
            res.status(201).json({
                _id: novUporabnik._id,
                ime: novUporabnik.ime,
                email: novUporabnik.email,
                jeLastnik: novUporabnik.jeLastnik,
                cena: novUporabnik.cena,
                msg: "Registracija uspešna. Žeton shranjen v varnem piškotku." // <--- INFO za frontend
            });

        } catch (err) {
            console.error('❌ NAPAKA PRI REGISTRACIJI:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri registraciji.' });
        }
    });

    // Prijava
    router.post('/prijava', async (req, res) => {
        console.log("🔥 DEBUG: Klic Prijave Prejet!"); 
        
        const { email, geslo } = req.body;
        try {
            const uporabnik = await Uporabnik.findOne({ email });
            if (!uporabnik) return res.status(401).json({ msg: 'Neveljavne poverilnice.' });

            const gesloPravilno = await bcrypt.compare(geslo, uporabnik.geslo);
            if (!gesloPravilno) return res.status(401).json({ msg: 'Neveljavne poverilnice.' });

            const zeton = generirajZeton(uporabnik._id);
            nastaviAuthPiškotek(res, zeton); // <--- NOVO: Nastavi piškotek!

            // V odgovor ne pošljemo več žetona, ampak samo podatke
            res.json({
                _id: uporabnik._id,
                ime: uporabnik.ime,
                email: uporabnik.email,
                jeLastnik: uporabnik.jeLastnik,
                cena: uporabnik.cena,
                msg: "Prijava uspešna. Žeton shranjen v varnem piškotku." // <--- INFO za frontend
            });
        } catch (err) {
            console.error('❌ NAPAKA PRI PRIJAVI:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri prijavi.' });
        }
    });
    
    // ⭐ NOVO: Ruta za odjavo (logout)
    router.post('/odjava', (req, res) => {
        // Izbriše piškotek tako, da mu nastavi datum veljavnosti v preteklosti
        res.cookie('auth_token', '', { 
            httpOnly: true, 
            expires: new Date(0) 
        });
        res.status(200).json({ msg: 'Uspešno odjavljen. Piškotek izbrisan.' });
    });

    // ==========================================================
    // ✅ POPRAVLJENA ZAŠČITENA POT: /api/auth/profil
    // ==========================================================
    // Opomba: Odstranimo 'async', saj middleware že skrbi za asinhronost
    router.get('/profil', preveriGosta, (req, res) => { 
        
        //🔥 KLJUČNI POPRAVEK:
        // Ker je req.uporabnik sedaj že navaden JSON objekt (nastavljen v authMiddleware.js)
        // se izognemo destrukturiranju znotraj try/catch, da zagotovimo stabilnost.
        
        if (req.uporabnik && req.uporabnik.id) { // Preverimo, ali je uporabnik avtenticiran (ima ID, ne le anonimni gost)
            const uporabnikPodatki = req.uporabnik;
            
            // Posredujemo samo potrebne podatke in izpustimo geslo, ki bi sicer moralo biti že odstranjeno v middleware
            res.json({
                msg: "Podatki profila uspešno pridobljeni.",
                uporabnik: { 
                    _id: uporabnikPodatki._id || uporabnikPodatki.id, 
                    ime: uporabnikPodatki.ime, 
                    email: uporabnikPodatki.email, 
                    jeLastnik: uporabnikPodatki.jeLastnik, 
                    cena: uporabnikPodatki.cena 
                }
            });
            
        } else {
             // Če ni avtenticiran, vrnemo 401
             res.status(401).json({ msg: "Za dostop do profila je potrebna prijava." });
        }
    });


    return router; 
};