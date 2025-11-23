// ========================================
// 🟢 passportConfig.js — Konfiguracija Passport.js (PREGLED POTI ZA RENDER)
// ========================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path'); 

// 🚨 KRITIČEN UVOZ: Preizkusimo 2 najverjetnejši poti
// Glede na to, da Render VSE datoteke postavi v SRC, poskusimo s potjo, ki predpostavlja:
// 1. Model je v "models" (relativno na koren)
// 2. Model je v "models" (relativno na SRC)
let Uporabnik;

// 1. POSKUS (Fizično logična pot v Korenu):
try {
    // Potrebno, ker je passportConfig.js in models/ v KORENU
    Uporabnik = require('./models/uporabnik'); 
} catch (e1) {
    // 2. POSKUS (Virtualna pot za Render):
    try {
        // Potrebno, ker Render misli, da je koda v SRC/ (tj. gor iz SRC in potem v models/)
        Uporabnik = require('../models/uporabnik'); 
    } catch (e2) {
        // 3. POSKUS (Absolutna pot na Renderju)
        try {
            // Poskusimo z absolutno potjo, ki jo uporablja Render
            Uporabnik = require('/opt/render/project/models/uporabnik');
        } catch (e3) {
            // Če noben poskus ne uspe, prikažemo obe napaki
            console.error("KRITIČNA NAPAKA: 1. poskus (./models/uporabnik) je propadel. Napaka:", e1.message);
            console.error("KRITIČNA NAPAKA: 2. poskus (../models/uporabnik) je propadel. Napaka:", e2.message);
            throw new Error("Kritična napaka: Modela 'uporabnik' ni bilo mogoče naložiti z nobene preizkušene poti.");
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
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

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
            let currentUser = await Uporabnik.findOne({ googleId: profile.id });

            if (currentUser) {
                console.log('Uporabnik je že registriran:', currentUser.ime);
                done(null, currentUser);
            } else {
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