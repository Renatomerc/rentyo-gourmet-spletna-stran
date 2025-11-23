// module.exports sedaj izvaža FUNKCIJO, ki prejme tajni ključ IN middleware.
// 👇 KLJUČNO: SPREJMEMO TRI PARAMETRE!
module.exports = (JWT_SECRET_KEY, preveriGosta, zahtevajPrijavo) => { 

    const express = require('express');
    const router = express.Router();
    const jwt = require('jsonwebtoken');
    const bcrypt = require('bcryptjs');
    // ⭐ NOVO: Uvozimo Passport, ki mora biti nameščen (npm install passport)
    const passport = require('passport'); 
    
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

    // ==========================================================
    // 🟢 NOVO: RUTI ZA GOOGLE PRIJAVO (OAUTH)
    // ==========================================================
    
    // 1. Pot, ki jo kliče frontend za začetek prijave (/api/auth/google)
    router.get('/google', (req, res, next) => {
        // Preberemo URL, kamor naj se uporabnik vrne po prijavi.
        const redirectUrl = req.query.redirectUrl || '/'; 

        // Svoj lasten RedirectUrl shranimo v Passport sejo
        // Opomba: Ker tole uporablja Passport, mora biti sejna podpora v server.js omogočena.
        req.session.oauthRedirectUrl = redirectUrl;

        // Zaženemo Passport Google strategijo
        passport.authenticate('google', { 
            scope: ['profile', 'email'],
        })(req, res, next);
    });

    // 2. Pot, kamor Google preusmeri brskalnik nazaj (/api/auth/google/callback)
    router.get('/google/callback', 
        // Uporabimo Passport za avtentikacijo in obravnavo odgovora od Googla
        passport.authenticate('google', { 
            failureRedirect: '/prijava?status=error', // Preusmeri na prijavo v primeru napake
            session: true // Poskrbi, da se user shrani v req.user
        }),
        // Če je prijava uspešna, se izvede ta middleware:
        async (req, res) => {
            // Predpostavimo, da Passport prilepi prijavljenega uporabnika na req.user
            const uporabnik = req.user;
            
            if (!uporabnik) {
                 return res.redirect((req.session.oauthRedirectUrl || '/') + '?status=error&msg=Prijava+neuspešna.');
            }
            
            // Generiraj žeton in ga nastavi v piškotek
            const zeton = generirajZeton(uporabnik._id);
            nastaviAuthPiškotek(res, zeton); 
            
            // Pridobimo Redirect URL, kamor želimo poslati frontend (iz seje)
            const redirectUrl = req.session.oauthRedirectUrl || '/';
            
            // Očistimo sejo
            req.session.oauthRedirectUrl = undefined;
            
            // Preusmerimo nazaj na frontend z vsemi potrebnimi podatki v URL-ju
            res.redirect(`${redirectUrl}?zeton=${zeton}&jeLastnik=${uporabnik.jeLastnik}&ime=${encodeURIComponent(uporabnik.ime)}&telefon=${encodeURIComponent(uporabnik.telefon || '')}`);
        }
    );
    
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
                // Če ste v Mongoose shemi dodali tockeZvestobe z default: 0, 
                // ga ni treba explicitno dodajati tukaj.
            });
            
            const zeton = generirajZeton(novUporabnik._id);
            nastaviAuthPiškotek(res, zeton); 

            res.status(201).json({
                _id: novUporabnik._id,
                ime: novUporabnik.ime,
                email: novUporabnik.email,
                jeLastnik: novUporabnik.jeLastnik,
                cena: novUporabnik.cena,
                // Predpostavimo, da je tockeZvestobe: 0, saj ga frontend trenutno ne rabi pri registraciji, ampak ga rabi pri profilu.
                // 🚀 DODANO: Žeton za frontend (shranjevanje v localStorage)
                zeton: zeton, 
                msg: "Registracija uspešna. Žeton shranjen v varnem piškotku in JSON." 
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