// ==========================================================
// 🟢 /controllers/authController.js — Controller za Avtentikacijo
// ==========================================================

// Uvoz potrebnih modulov
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
// const crypto = require('crypto'); // ❌ ODSTRANJENO: Ni več potrebno za OTP logiko
// const nodemailer = require('nodemailer'); // ❌ ODSTRANJENO: NE SMEMO UVOZITI NODEMAILERJA!

// 🔥 NOVO: Uvoz Brevo API klienta (sib-api-v3-sdk)
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
    
    // ⭐ 2. KONFIGURACIJA BREVO API (Nadomestilo za Nodemailer/SMTP)
    
    // Inicializacija klienta in nastavitev API ključa
    SibApiV3Sdk.ApiClient.instance.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

    let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    
    if (!process.env.BREVO_API_KEY) {
        console.error("❌ KRITIČNA NAPAKA: BREVO_API_KEY ni definiran. Pošiljanje e-pošte ne bo delovalo!");
    }


    // ==========================================================
    // 🟠 OBSTAJEČE FUNKCIJE (Registracija, Prijava, Profil itd. - NESPREMENJENO)
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
    // ⭐ NOVE FUNKCIJE ZA PONASTAVITEV GESLA (Z OTP KODO) ⭐
    // ==========================================================
    
    // 🟠 requestPasswordResetOtp: Zahtevek za OTP kodo in pošiljanje e-maila
    exports.requestPasswordResetOtp = async (req, res) => {
        const { email } = req.body;
        
        try {
            const user = await Uporabnik.findOne({ email });

            if (!user) {
                // Varnost: Vedno vrnite generično sporočilo, tudi če uporabnik ne obstaja
                return res.status(200).json({ 
                    message: 'Če uporabnik obstaja, je bila koda za ponastavitev poslana na vaš e-poštni naslov.'
                });
            }
            
            // 1. Generirajte 6-mestno numerično kodo (OTP)
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 števk
            
            // 2. Shranite kodo in čas poteka (10 minut)
            user.passwordResetOtp = otpCode;
            user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minut
            await user.save({ validateBeforeSave: false }); 
            
            // 3. Pripravite in pošljite e-mail s kodo (Preko Brevo API)
            
            if (!process.env.BREVO_API_KEY) {
                 // Počistimo shranjeno kodo, če Brevo ne dela
                 user.passwordResetOtp = undefined;
                 user.passwordResetExpires = undefined;
                 await user.save({ validateBeforeSave: false });
                 return res.status(500).json({ message: 'Napaka pri strežniku: Manjka Brevo API ključ.' });
            }

            const htmlContent = `
                <p>Pozdravljeni ${user.ime},</p>
                <p>Vaša unikatna koda za ponastavitev gesla (PIN) je: <strong>${otpCode}</strong>.</p>
                <p>Prosimo, vnesite jo v aplikacijo za potrditev novega gesla. Koda poteče v 10 minutah. Je nikomur ne izdajte!</p>
                <p>Če niste zahtevali ponastavitve, prosimo, ignorirajte to sporočilo.</p>
            `;

            let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail(); 
            
            sendSmtpEmail = {
                sender: { email: process.env.SENDER_EMAIL, name: "Rentyo Gourmet & Experience" }, 
                to: [{ email: user.email, name: user.ime }],
                subject: 'Ponastavitev Gesla - Vaša PIN Koda (Rentyo APLIKACIJA)',
                htmlContent: htmlContent,
            };

            try {
                await apiInstance.sendTransacEmail(sendSmtpEmail); 
                res.status(200).json({ message: 'Koda za ponastavitev gesla je bila uspešno poslana na vaš e-poštni naslov.' });
            } catch (error) {
                // V primeru napake pri pošiljanju počistimo kodo za varnost
                user.passwordResetOtp = undefined;
                user.passwordResetExpires = undefined;
                await user.save({ validateBeforeSave: false });
                
                console.error('❌ NAPAKA PRI POŠILJANJU E-POŠTE ZA OTP (BREVO API):', error.message || error);
                res.status(500).json({ message: 'Napaka pri pošiljanju e-pošte. Prosimo, preverite Brevo API ključ in status.' });
            }
        
        } catch (error) {
            console.error('❌ NAPAKA PRI ZAHTEVKU OTP KODE:', error);
            res.status(500).json({ message: 'Sistemska napaka pri obravnavi zahteve.' });
        }
    };


    // 🟠 resetPasswordWithOtp: Potrditev OTP kode in nastavitev novega gesla
    exports.resetPasswordWithOtp = async (req, res) => {
        const { email, code, newPassword } = req.body;
        
        try {
            const user = await Uporabnik.findOne({ email });

            if (!user) {
                return res.status(404).json({ message: 'Uporabnik ne obstaja.' });
            }
            
            // 1. Preverjanje poteka kode in pravilnosti
            if (user.passwordResetOtp !== code || user.passwordResetExpires < Date.now()) {
                return res.status(401).json({ message: 'Koda PIN je napačna ali je potekla. Prosimo, poskusite znova poslati kodo.' });
            }
            
            // 2. Hashiranje novega gesla in shranjevanje
            const salt = await bcrypt.genSalt(10);
            user.geslo = await bcrypt.hash(newPassword, salt);
            
            // 3. Počistite kodo in čas poteka
            user.passwordResetOtp = undefined;
            user.passwordResetExpires = undefined;
            
            await user.save({ validateBeforeSave: false }); // Pomembno: ne validiramo vseh polj
            
            res.status(200).json({ message: 'Geslo uspešno posodobljeno.' });
            
        } catch (error) {
            console.error('❌ NAPAKA PRI POTRDITVI OTP IN PONASTAVITVI GESLA:', error);
            res.status(500).json({ message: 'Sistemska napaka pri ponastavitvi gesla.' });
        }
    };
    
    // ==========================================================
    // ⭐ IZVOZ VSEH FUNKCIJ 
    // ==========================================================
    return { 
        registracija: exports.registracija, 
        prijava: exports.prijava, 
        odjava: exports.odjava,
        profil: exports.profil,
        izbrisProfila: exports.izbrisProfila,
        
        // 🔥 POMEMBNO: ZAMENJAN IZVOZ: Namesto starih funkcij (forgotPassword, resetPassword) izvažamo nove OTP funkcije:
        requestPasswordResetOtp: exports.requestPasswordResetOtp, 
        resetPasswordWithOtp: exports.resetPasswordWithOtp,
        
        // Izvoz pomožnih funkcij, ki jih potrebuje uporabnikRoutes.js za socialno prijavo:
        generirajZeton: generirajZeton,
        nastaviAuthPiškotek: nastaviAuthPiškotek
        
        // Stari funkciji exports.forgotPassword in exports.resetPassword sta odstranjeni iz izvoza.
    };
};