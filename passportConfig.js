// ========================================
// 🟢 passportConfig.js — Konfiguracija Passport.js (ČISTA RELATIVNA POT ZA RENDER)
// ========================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const path = require('path'); // Ni več potrebno

// 🚨 KRITIČEN UVOZ: Uporabimo čisto relativno pot, ki predpostavlja, 
// da se passportConfig.js izvaja iz mape 'src/', kjer je tudi mapa 'models/'.
// To je poskus, da se ujame z logi Renderja.
const Uporabnik = require('./models/uporabnik'); 


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