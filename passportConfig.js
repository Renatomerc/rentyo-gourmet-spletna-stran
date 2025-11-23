// ========================================
// 🟢 passportConfig.js — Konfiguracija Passport.js (IZBOLJŠANA POT Z __dirname ZA RENDER)
// ========================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path'); 

// 🚨 KRITIČEN UVOZ: 
// Uporabimo samo path.resolve() za ustvarjanje absolutne poti od korenskega imenika,
// da se izognemo Renderjevemu problemu z relativnimi potmi.

// Predpostavka: Karkoli se izvaja na Renderju, je koren projekta na isti ravni kot server.js.
// Uporabimo require.resolve, da preverimo pot do models/uporabnik.js
try {
    // 1. Določimo pot: Zanesemo se na dejstvo, da je 'models' zraven 'server.js'
    // Če se passportConfig.js izvaja iz /src, bo '..' pomaknil navzgor, in 'models' bo najden.
    const modelPath = path.resolve(__dirname, '..', 'models', 'uporabnik');
    
    // 2. Poskusimo zahtevati modul.
    // Če je ta pot napačna, bo Node.js vrgel napako.
    const Uporabnik = require(modelPath); 

    console.log(`Uporabnik model uspešno naložen z absolutno potjo: ${modelPath}`);


    // ----------------------------------------
    // PREOSTALI DEL KODE
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
            callbackURL: "/api/auth/google/callback" 
        },
        async (accessToken, refreshToken, profile, done) => {
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

} catch (err) {
    // Če pride do napake pri require, to zapišemo in vržemo nazaj.
    console.error(`KRITIČNA NAPAKA PRI UVOZU MODELA! Node.js ni mogel najti modela na: ${path.resolve(__dirname, '..', 'models', 'uporabnik')}`);
    throw err;
}