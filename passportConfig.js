// ========================================
// 🟢 passportConfig.js — Konfiguracija Passport.js (ULTIMATIVNA REŠITEV POTI Z VEČKRATNIM POSKUSOM)
// ========================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path'); 

// 🚨 KRITIČEN UVOZ: Preizkusimo vse kritične poti, dokler ena ne deluje.
// Ker se passportConfig.js nahaja v KORENU, je standardna pot './models/uporabnik'.
let Uporabnik;

// 1. POSKUS (NAJBOLJ LOGIČEN): passportConfig v korenu, model v models/
try {
    Uporabnik = require('./models/uporabnik'); 
} catch (e1) {
    // 2. POSKUS: Absolutna pot (preverjeno, da je process.cwd() koren)
    try {
        Uporabnik = require(path.join(process.cwd(), 'models', 'uporabnik')); 
    } catch (e2) {
        // 3. POSKUS: Pot, ki jo Render vztrajno zahteva (kot da bi bil passportConfig v src/)
        try {
            Uporabnik = require('../models/uporabnik');
        } catch (e3) {
            // 4. POSKUS: Vsiljena pot Renderja (kot da je vse premaknjeno v src/ in ga kliče)
            try {
                Uporabnik = require('./uporabnik');
            } catch (e4) {
                 // Če noben poskus ne uspe, se ustavi z originalno napako 1. poskusa (za lažje debugiranje)
                console.error("KRITIČNA NAPAKA: Ne morem najti modela 'uporabnik' na nobeni preizkušeni poti.");
                throw e1;
            }
        }
    }
}

// ----------------------------------------
// PREOSTALI DEL KODE JE ENAK
// ----------------------------------------

function setupPassport(app) {
    // Uvoz okoljskih spremenljivk (Google Client ID in Secret)
    require('dotenv').config();

    // 1. Serizacija in Deserializacija
    // Shrani user.id (Mongo _id) v sejo (session cookie)
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Uporabi id za iskanje uporabnika v bazi, ko je zahteva poslana
    passport.deserializeUser(async (id, done) => {
        try {
            // Pomembno: Uporabnik model mora biti dostopen tukaj
            const user = await Uporabnik.findById(id); 
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });

    // 2. Google Strategija
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // Ta pot mora ustrezati poti, ki jo boste uporabili v uporabnikRouter.js (tj. /api/auth/google/callback)
        callbackURL: "/api/auth/google/callback" 
    },
    async (accessToken, refreshToken, profile, done) => {
        // Ta funkcija se izvede, ko se Google uspešno avtenticira
        try {
            // Preverimo, ali uporabnik že obstaja v naši bazi
            let currentUser = await Uporabnik.findOne({ googleId: profile.id });

            if (currentUser) {
                // Uporabnik že obstaja
                console.log('Uporabnik je že registriran:', currentUser.ime);
                done(null, currentUser);
            } else {
                // Uporabnik je nov - ustvari ga v bazi
                const newUser = await Uporabnik.create({
                    googleId: profile.id,
                    ime: profile.displayName,
                    email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : 'ni-emaila@google.com',
                });
                console.log('Nov uporabnik ustvarjen:', newUser.ime);
                done(null, newUser);
            }
        } catch (err) {
            console.error("Napaka pri avtentikaciji Google uporabnika:", err);
            done(err, null);
        }
    }));
}

module.exports = setupPassport;