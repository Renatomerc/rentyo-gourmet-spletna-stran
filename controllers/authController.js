// ==========================================================
// 🟢 /controllers/authController.js — Controller za Avtentikacijo
// Vključuje logiko prijave, registracije in ponastavitve gesla.
// ==========================================================

// Uvoz potrebnih modulov
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Za generiranje žetonov
const nodemailer = require('nodemailer'); // Za pošiljanje e-pošte

// ⭐ KLJUČNO: Controller izvaža FUNKCIJO, ki prejme zunanje spremenljivke (ključi, modeli)!
module.exports = (JWT_SECRET_KEY, Uporabnik, Restavracija) => {

    // ⭐ 1. LOKALNE SPREMENLJIVKE IN POMOŽNE FUNKCIJE
    const TAJNI_KLJUC = JWT_SECRET_KEY; 

    if (!TAJNI_KLJUC) {
        console.error("❌ KRITIČNA NAPAKA: JWT_SECRET_KEY ni na voljo v authController.js!");
    }

    const generirajZeton = (uporabnikId) => {
        if (!TAJNI_KLJUC) {
            throw new Error("Napaka JWT: Tajni ključ ni na voljo.");
        }
        return jwt.sign({ id: uporabnikId }, TAJNI_KLJUC, { expiresIn: '7d' }); 
    };
    
    const nastaviAuthPiškotek = (res, zeton) => {
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('auth_token', zeton, {
            httpOnly: true,
            signed: true,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dni
            secure: isProduction, 
            sameSite: isProduction ? 'None' : 'Lax', 
            path: '/'
        });
    };
    
    // ⭐ 2. KONFIGURACIJA NODEMAILERJA
    // OPOMBA: Vse te spremenljivke MORAJO biti nastavljene v vašem .env datoteki!
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.NODE_ENV === 'production', // true za 465, false za ostalo
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });


    // ==========================================================
    // 🟠 OBSTAJEČE FUNKCIJE (Iz 'uporabnikRoutes.js')
    // ==========================================================

    // Registracija
    exports.registracija = async (req, res) => {
        const { ime, priimek, telefon, email, geslo, jeLastnik, cena, fcmToken, drzava } = req.body;
        
        if (!ime || !email || !geslo || !drzava) return res.status(400).json({ msg: 'Vnesite vsa obvezna polja: ime, e-mail, geslo in država.' });
        if (jeLastnik && (cena === undefined || cena === null)) return res.status(400).json({ msg: 'Kot lastnik morate določiti ceno.' });

        try {
            const obstojec = await Uporabnik.findOne({ email });
            if (obstojec) return res.status(400).json({ msg: 'Uporabnik že obstaja s tem e-mailom.' });

            const salt = await bcrypt.genSalt(10);
            const hashiranoGeslo = await bcrypt.hash(geslo, salt);

            const uporabnikData = { 
                ime, priimek: priimek || '', telefon: telefon || '', email, 
                geslo: hashiranoGeslo, jeLastnik: jeLastnik || false, cena: cena || 0,
                drzava: drzava,
            };

            if (fcmToken) { uporabnikData.fcmToken = fcmToken; }
            
            const novUporabnik = await Uporabnik.create(uporabnikData); 
            
            const zeton = generirajZeton(novUporabnik._id);
            nastaviAuthPiškotek(res, zeton); 

            res.status(201).json({
                _id: novUporabnik._id, ime: novUporabnik.ime, email: novUporabnik.email,
                jeLastnik: novUporabnik.jeLastnik, cena: novUporabnik.cena, drzava: novUporabnik.drzava,
                zeton: zeton, msg: "Registracija uspešna." 
            });

        } catch (err) {
            if (err.code === 11000) return res.status(409).json({ msg: 'Vneseni e-mail ali drugi podatki so že v uporabi.' });
            console.error('❌ KRITIČNA NAPAKA PRI REGISTRACIJI:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri registraciji.' });
        }
    };

    // Prijava
    exports.prijava = async (req, res) => {
        const { email, geslo } = req.body;
        try {
            const uporabnik = await Uporabnik.findOne({ email });
            if (!uporabnik) return res.status(401).json({ msg: 'Neveljavne poverilnice.' });

            const gesloPravilno = await uporabnik.primerjajGeslo(geslo); // Uporabljamo metodo iz modela
            if (!gesloPravilno) return res.status(401).json({ msg: 'Neveljavne poverilnice.' });

            const zeton = generirajZeton(uporabnik._id);
            nastaviAuthPiškotek(res, zeton); 

            res.json({
                _id: uporabnik._id, ime: uporabnik.ime, email: uporabnik.email,
                jeLastnik: uporabnik.jeLastnik, cena: uporabnik.cena, zeton: zeton, 
                msg: "Prijava uspešna." 
            });
        } catch (err) {
            console.error('❌ NAPAKA PRI PRIJAVI:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri prijavi.' });
        }
    };

    // Odjava
    exports.odjava = (req, res) => {
        res.cookie('auth_token', '', { httpOnly: true, expires: new Date(0), path: '/' });
        res.status(200).json({ msg: 'Uspešno odjavljen. Piškotek izbrisan.' });
    };

    // Profil (pridobitev podatkov)
    exports.profil = async (req, res) => {
        const uporabnikId = req.uporabnik._id || req.uporabnik.id; 

        try {
            const uporabnikDB = await Uporabnik.findById(uporabnikId).select('-geslo');

            if (!uporabnikDB) return res.status(404).json({ msg: 'Profilni podatki niso najdeni v bazi.' });
            
            res.json({
                msg: "Podatki profila uspešno pridobljeni.",
                uporabnik: { 
                    _id: uporabnikDB._id, ime: uporabnikDB.ime, email: uporabnikDB.email, 
                    jeLastnik: uporabnikDB.jeLastnik, cena: uporabnikDB.cena,
                    drzava: uporabnikDB.drzava, tockeZvestobe: uporabnikDB.tockeZvestobe 
                }
            });

        } catch (err) {
            console.error('❌ NAPAKA PRI NALAGANJU PROFILA IZ BAZE:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri nalaganju profila.' });
        }
    };

    // Izbris profila
    exports.izbrisProfila = async (req, res) => {
        const uporabnikId = req.uporabnik._id || req.uporabnik.id; 
        const uporabnikIdObject = new mongoose.Types.ObjectId(uporabnikId); 

        try {
            await Uporabnik.findByIdAndDelete(uporabnikId);

            // Kaskadni izbris in anonimizacija (GDPR) - uporabljamo model Restavracija
            await Restavracija.updateMany(
                { 'mize.rezervacije.uporabnikId': uporabnikIdObject }, 
                { $pull: { 'mize.$[].rezervacije': { uporabnikId: uporabnikIdObject } } }
            );
            
            await Restavracija.updateMany(
                { 'komentarji.userId': uporabnikIdObject }, 
                { $set: { 
                    'komentarji.$[element].userId': null, 'komentarji.$[element].uporabniskoIme': 'GDPR Deleted User', 
                    'komentarji.$[element].email_gosta': null, 'komentarji.$[element].je_anonimizirana': true 
                } },
                { arrayFilters: [ { 'element.userId': uporabnikIdObject } ] }
            );

            res.cookie('auth_token', '', { httpOnly: true, expires: new Date(0), path: '/' });
            res.status(200).json({ msg: 'Račun in vsi povezani osebni podatki so bili trajno izbrisani/anonimizirani.' });

        } catch (err) {
            console.error('❌ KRITIČNA NAPAKA PRI IZBRISU RAČUNA:', err);
            res.status(500).json({ msg: 'Napaka strežnika pri trajnem izbrisu računa in podatkov.' });
        }
    };

    // ==========================================================
    // ⭐ NOVE FUNKCIJE ZA PONASTAVITEV GESLA ⭐
    // ==========================================================

    exports.forgotPassword = async (req, res) => {
        const { email } = req.body;
        
        const user = await Uporabnik.findOne({ email });
        if (!user) {
            // Varnost: VEDNO splošno sporočilo
            return res.status(200).json({ message: 'Če je vaš e-poštni naslov registriran, boste prejeli navodila za ponastavitev gesla.' });
        }

        // 1. Generiraj žeton in nastavi čas poteka
        const resetToken = user.getResetPasswordToken(); 
        await user.save({ validateBeforeSave: false }); 

        // 2. Pripravi in pošlji e-pošto
        // Ta del ustvari URL za ponastavitev na podlagi protokola in gostitelja
        const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
        
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: user.email,
            subject: 'Zahteva za ponastavitev gesla - Leo Gourmet',
            html: `
                <p>Pozdravljeni ${user.ime},</p>
                <p>Prejeli smo zahtevo za ponastavitev gesla za vaš račun. Prosimo, kliknite na to povezavo. Povezava je veljavna samo 1 uro.</p>
                <p style="text-align: center; margin: 20px 0;"><a href="${resetUrl}" style="background-color: #076b6a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">PONASTAVI GESLO</a></p>
                <p>Če niste zahtevali ponastavitve, prosimo, ignorirajte to sporočilo.</p>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            res.status(200).json({ message: 'Navodila za ponastavitev gesla so bila uspešno poslana na vaš e-poštni naslov.' });
        } catch (error) {
            // V primeru napake pri pošiljanju počistimo token za varnost
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save({ validateBeforeSave: false });
            
            console.error('❌ NAPAKA PRI POŠILJANJU E-POŠTE ZA PONASTAVITEV:', error);
            res.status(500).json({ message: 'Napaka pri pošiljanju e-pošte. Preverite nastavitve SMTP.' });
        }
    };


    exports.resetPassword = async (req, res) => {
        const { token } = req.params; // Nehashiran žeton iz URL-ja
        const { newPassword } = req.body; 

        // 1. Hashiraj žeton iz URL-ja
        const resetPasswordTokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // 2. Poišči uporabnika (preveri hash in veljavnost)
        const user = await Uporabnik.findOne({
            resetPasswordToken: resetPasswordTokenHash, 
            resetPasswordExpires: { $gt: Date.now() } 
        });

        if (!user) {
            return res.status(400).json({ error: 'Žeton za ponastavitev je neveljaven ali je potekel. Prosimo, zahtevajte novo ponastavitev.' });
        }
        
        // 3. Hashiraj novo geslo
        const salt = await bcrypt.genSalt(10);
        user.geslo = await bcrypt.hash(newPassword, salt);
        
        // 4. Počisti žeton in veljavnost
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save({ validateBeforeSave: false }); 

        res.status(200).json({ message: 'Geslo je bilo uspešno ponastavljeno. Sedaj se lahko prijavite z novim geslom.' });
    };
    
    // ==========================================================
    // ⭐ IZVOZ VSEH FUNKCIJ (Vključno s tistimi za Passport.js, ki jih uporablja router)
    // ==========================================================
    return { 
        registracija: exports.registracija, 
        prijava: exports.prijava, 
        odjava: exports.odjava,
        profil: exports.profil,
        izbrisProfila: exports.izbrisProfila,
        forgotPassword: exports.forgotPassword, 
        resetPassword: exports.resetPassword,
        // Izvoz pomožnih funkcij, ki jih potrebuje uporabnikRoutes.js za socialno prijavo:
        generirajZeton: generirajZeton,
        nastaviAuthPiškotek: nastaviAuthPiškotek
    };
};