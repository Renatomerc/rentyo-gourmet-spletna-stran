// ========================================
// 🟢 passportConfig.js — Konfiguracija Passport.js za Google OAuth (NAKZANESLJIVEJŠI UVOZ MODELA)
// ========================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// ⭐ Uvozimo modul 'path'
const path = require('path'); 

// 🚨 KRITIČEN POPRAVEK: Uvoz modela. Poskušali bomo tri možnosti, da zagotovimo delovanje na Renderju.
// Ta robustna rešitev poskuša naložiti model iz treh možnih poti,
// dokler ena ne uspe, s čimer se izogne napaki 'Cannot find module'.
let Uporabnik;
try {
    // POSKUS 1: Standardna pot v Node.js/Express projektih. 
    // Išče mapo 'models' en nivo nad to datoteko (npr. /koren/models/uporabnik.js)
    Uporabnik = require('../models/uporabnik'); 
} catch (e) {
    try {
        // POSKUS 2: Pot, ki jo predlagajo logi Renderja (datoteka premaknjena v isti src/ dir)
        // Išče v isti mapi (/src/uporabnik)
        Uporabnik = require('./uporabnik');
    } catch (e) {
        // POSKUS 3: Absolutna pot (prejšnji poskus, path.join)
        Uporabnik = require(path.join(__dirname, '..', 'models', 'uporabnik')); 
    }
}


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