// ==========================================================
// 🟢 /controllers/authController.js — Controller za Avtentikacijo
// (POPRAVEK: Implementacija OTP/PIN kode namesto Deep Linkov)
// ==========================================================

// Uvoz potrebnih modulov
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
// const crypto = require('crypto'); // NI POTREBNO: Ne hashiramo več žetona
const SibApiV3Sdk = require('sib-api-v3-sdk'); 

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
    
    // ⭐ 2. KONFIGURACIJA BREVO API
    
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

    let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    
    if (!process.env.BREVO_API_KEY) {
        console.error("❌ KRITIČNA NAPAKA: BREVO_API_KEY ni definiran. Pošiljanje e-pošte ne bo delovalo!");
    }
    
    // Pomožna funkcija za generiranje 6-mestne kode
    const generirajOtpKodo = () => {
        // Generira naključno število med 100000 in 999999
        return Math.floor(100000 + Math.random() * 900000).toString();
    };


    // ==========================================================
    // 🟠 OBSTAJEČE FUNKCIJE (Registracija, Prijava, Profil, Odjava, Izbris - NESPREMENJENO)
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
    // ⭐ NOVE FUNKCIJE ZA PONASTAVITEV GESLA (OTP/PIN KODA) ⭐
    // (Zamenjava za staro Deep Link logiko)
    // ==========================================================

    // 1. Pošlji zahtevo za kodo (Faza 0)
    exports.requestPasswordResetOtp = async (req, res) => {
        const { email } = req.body;
        
        const user = await Uporabnik.findOne({ email });
        if (!user) {
            // Varnost: VEDNO splošno sporočilo, da preprečimo 'fishing' (izdajo obstoja računa)
            return res.status(200).json({ message: 'Če je vaš e-poštni naslov registriran, boste prejeli kodo za ponastavitev gesla.' });
        }

        // 1. Generiraj PIN/OTP kodo in nastavi čas poteka (10 minut)
        const otpCode = generirajOtpKodo();
        
        user.resetPasswordToken = otpCode; 
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minut veljavnosti
        await user.save({ validateBeforeSave: false }); 

        // 2. Preverjanje API ključa za Brevo
        if (!process.env.BREVO_API_KEY) {
             user.resetPasswordToken = undefined;
             user.resetPasswordExpires = undefined;
             await user.save({ validateBeforeSave: false });
             return res.status(500).json({ message: 'Napaka pri strežniku: Manjka Brevo API ključ.' });
        }

        // Pripravi HTML vsebino (Besedilo prilagojeno PIN kodi)
        const htmlContent = `
            <p>Pozdravljeni ${user.ime},</p>
            <p>Prejeli smo zahtevo za ponastavitev gesla. Vaša enkratna koda (PIN/OTP) za ponastavitev je:</p>
            <h2 style="text-align: center; color: #076b6a; background-color: #f0f0f0; padding: 10px; border-radius: 5px;">${otpCode}</h2>
            <p>Prosimo, vnesite to kodo v aplikacijo. Koda poteče v 10 minutah.</p>
            <p>Če niste zahtevali ponastavitve, prosimo, ignorirajte to sporočilo.</p>
        `;

        // Uporaba Brevo API za pošiljanje
        let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail(); 
        
        sendSmtpEmail = {
            sender: { email: process.env.SENDER_EMAIL, name: "Rentyo Gourmet & Experience" }, 
            to: [{ email: user.email, name: user.ime }],
            subject: 'Koda za ponastavitev gesla (PIN/OTP) - Rentyo Gourmet & Experience',
            htmlContent: htmlContent,
        };

        try {
            await apiInstance.sendTransacEmail(sendSmtpEmail); 
            // Vrni sporočilo in sessionId za uporabo v naslednjem koraku
            res.status(200).json({ message: 'Koda je bila uspešno poslana na vaš e-poštni naslov.', sessionId: user._id });
        } catch (error) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save({ validateBeforeSave: false });
            
            console.error('❌ NAPAKA PRI POŠILJANJU E-POŠTE ZA PONASTAVITEV (BREVO OTP):', error.message || error);
            res.status(500).json({ message: 'Napaka pri pošiljanju e-pošte za kodo.' });
        }
    };


    // 2. Potrdi kodo in nastavi novo geslo (Faza 1)
    exports.resetPasswordWithOtp = async (req, res) => {
        const { email, code, newPassword } = req.body; 

        // 1. Poišči uporabnika in preveri veljavnost kode
        const user = await Uporabnik.findOne({
            email: email,
            resetPasswordToken: code, // Preverjamo shranjeno OTP kodo (string)
            resetPasswordExpires: { $gt: Date.now() } // Preverjamo, ali je koda še veljavna
        });

        if (!user) {
            return res.status(400).json({ error: 'Koda je neveljavna, potekla ali se ne ujema z e-poštnim naslovom. Prosimo, poskusite znova.' });
        }
        
        // 2. Hashiraj novo geslo
        const salt = await bcrypt.genSalt(10);
        user.geslo = await bcrypt.hash(newPassword, salt);
        
        // 3. Počisti žeton/kodo in veljavnost
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save({ validateBeforeSave: false }); 

        res.status(200).json({ message: 'Geslo je bilo uspešno ponastavljeno.' });
    };

    
    // ==========================================================
    // ⭐ IZVOZ VSEH FUNKCIJ (POSODOBITEV - ODSTRANJENA Deep Link logika)
    // ==========================================================
    return { 
        registracija: exports.registracija, 
        prijava: exports.prijava, 
        odjava: exports.odjava,
        profil: exports.profil,
        izbrisProfila: exports.izbrisProfila,
        
        // ⭐ NOVO: IZVAŽAMO SAMO FUNKCIJE ZA PONASTAVITEV S KODO ⭐
        requestPasswordResetOtp: exports.requestPasswordResetOtp,
        resetPasswordWithOtp: exports.resetPasswordWithOtp,

        // ODSTRANJENO: forgotPassword in resetPassword (Deep Link)
        
        // Izvoz pomožnih funkcij:
        generirajZeton: generirajZeton,
        nastaviAuthPiškotek: nastaviAuthPiškotek
    };
};