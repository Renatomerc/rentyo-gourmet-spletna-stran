// ==========================================================
// 🟢 /controllers/authController.js — Controller za Avtentikacijo
// ==========================================================

// Uvoz potrebnih modulov
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Za generiranje žetonov
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
    // ⭐ NOVE FUNKCIJE ZA PONASTAVITEV GESLA (Z PIN KODO/OTP) ⭐
    // ==========================================================

    exports.forgotPassword = async (req, res) => {
        const { email } = req.body;
        
        const user = await Uporabnik.findOne({ email });
        if (!user) {
            // Varnost: VEDNO splošno sporočilo
            return res.status(200).json({ message: 'Če je vaš e-poštni naslov registriran, boste prejeli navodila za ponastavitev gesla.' });
        }

        // 1. Generiraj 6-mestno PIN kodo (OTP) in nastavi kratek čas poteka (5 min)
        const otpCode = crypto.randomInt(100000, 999999).toString(); 
        const otpExpires = Date.now() + 5 * 60 * 1000; // 5 minut veljavnosti

        // ⭐ Shranimo kodo in čas poteka v uporabniški zapis
        user.resetPasswordToken = otpCode; 
        user.resetPasswordExpires = otpExpires;
        await user.save({ validateBeforeSave: false }); 

        // 2. Pripravi in pošlji e-pošto s PIN kodo
        if (!process.env.BREVO_API_KEY) {
             // V primeru, da Brevo API ključ manjka, počistimo shranjene podatke za varnost
             user.resetPasswordToken = undefined;
             user.resetPasswordExpires = undefined;
             await user.save({ validateBeforeSave: false });
             return res.status(500).json({ message: 'Napaka pri strežniku: Manjka Brevo API ključ.' });
        }
        
        // Pripravi HTML vsebino (Besedilo prilagojeno PIN kodi)
        const htmlContent = `
            <p>Pozdravljeni ${user.ime},</p>
            <p>Prejeli smo zahtevo za ponastavitev gesla za vaš račun. Prosimo, vnesite to kodo v aplikacijo, da nastavite novo geslo. Koda je veljavna samo 5 minut.</p>
            <p style="text-align: center; margin: 20px 0;"><span style="font-size: 24px; font-weight: bold; color: #076b6a; border: 2px solid #076b6a; padding: 10px 20px; border-radius: 5px; letter-spacing: 5px;">${otpCode}</span></p>
            <p>Če niste zahtevali ponastavitve, prosimo, ignorirajte to sporočilo.</p>
        `;

        let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail(); 
        
        sendSmtpEmail = {
            sender: { email: process.env.SENDER_EMAIL, name: "Rentyo Gourmet & Experience" }, 
            to: [{ email: user.email, name: user.ime }],
            subject: 'Koda za ponastavitev gesla - Rentyo Gourmet & Experience (APLIKACIJA)',
            htmlContent: htmlContent, // Sedaj pošiljamo HTML z vsebino kode
        };

        try {
            await apiInstance.sendTransacEmail(sendSmtpEmail); 
            // Odziv se spremeni in poudari, da je poslana koda, ne povezava
            res.status(200).json({ message: 'Koda za ponastavitev gesla je bila uspešno poslana na vaš e-poštni naslov. Koda je veljavna 5 minut.' });
        } catch (error) {
            // V primeru napake pri pošiljanju počistimo token za varnost
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.save({ validateBeforeSave: false });
            
            console.error('❌ NAPAKA PRI POŠILJANJU E-POŠTE ZA PONASTAVITEV (BREVO API):', error.message || error);
            res.status(500).json({ message: 'Napaka pri pošiljanju e-pošte. Prosimo, preverite Brevo API ključ in status.' });
        }
    };


    // 💥 NOVA FUNKCIJA: Potrditev PIN kode in ponastavitev gesla
    exports.confirmResetPassword = async (req, res) => {
        // Ta endpoint bo prejel email, PIN kodo (OTP) in novo geslo iz Capacitor aplikacije
        const { email, otpCode, newPassword } = req.body; 

        // 1. Preveri osnovne podatke
        if (!email || !otpCode || !newPassword) {
            return res.status(400).json({ error: 'Prosimo, vnesite e-pošto, kodo in novo geslo.' });
        }
        
        // 2. Poišči uporabnika, ki ima ujemajočo PIN kodo in ni potekla
        // POMEMBNO: Ne heširamo, ker je shranjena neheširana 6-mestna koda
        const user = await Uporabnik.findOne({
            email: email, 
            resetPasswordToken: otpCode, // Preverjamo neposredno ujemanje PIN kode
            resetPasswordExpires: { $gt: Date.now() } // Preverjamo, ali koda ni potekla
        });

        if (!user) {
            // Splošno sporočilo, da preprečimo Brute Force napade na OTP kodo
            return res.status(400).json({ error: 'Koda je neveljavna, potekla ali napačen e-poštni naslov.' });
        }
        
        // 3. Hashiraj novo geslo
        const salt = await bcrypt.genSalt(10);
        user.geslo = await bcrypt.hash(newPassword, salt);
        
        // 4. Počisti PIN kodo (OBVEZNO: Koda mora biti UNICENA po uporabi!)
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save({ validateBeforeSave: false }); 

        res.status(200).json({ message: 'Geslo je bilo uspešno ponastavljeno. Sedaj se lahko prijavite z novim geslom.' });
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
        forgotPassword: exports.forgotPassword, 
        // 💥 POZOR: Staro funkcijo resetPassword smo zamenjali z novo confirmResetPassword
        confirmResetPassword: exports.confirmResetPassword,
        // Izvoz pomožnih funkcij, ki jih potrebuje uporabnikRoutes.js za socialno prijavo:
        generirajZeton: generirajZeton,
        nastaviAuthPiškotek: nastaviAuthPiškotek
    };
};