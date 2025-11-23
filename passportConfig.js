// ========================================
// 🟢 passportConfig.js — Konfiguracija Passport.js (ULTIMATIVNA REŠITEV - PATH ABSOLUTNI Z __dirname)
// ========================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path'); 

// 🚨 KRITIČEN UVOZ: Preizkusimo vse kritične poti z uporabo __dirname
let Uporabnik;

// 1. POSKUS (models je v Korenu, vendar je passportConfig v src/): ../models/uporabnik
try {
    // __dirname je /opt/render/project/src/
    // Path.join premakne gor in najde models/uporabnik
    Uporabnik = require(path.join(__dirname, '..', 'models', 'uporabnik')); 
    console.log("Uporabnik model naložen s potjo 1: ../models/uporabnik");
} catch (e1) {
    // 2. POSKUS (models je v src/, tj. src/models/uporabnik): ./models/uporabnik
    try {
        // Path.join ostane v src/ in najde models/uporabnik
        Uporabnik = require(path.join(__dirname, 'models', 'uporabnik')); 
        console.log("Uporabnik model naložen s potjo 2: ./models/uporabnik (Znotraj src/)");
    } catch (e2) {
        // 3. POSKUS (Model je neposredno v Korenu):
        try {
            Uporabnik = require(path.join(__dirname, '..', 'uporabnik')); 
            console.log("Uporabnik model naložen s potjo 3: ../uporabnik (Neposredno v korenu)");
        } catch (e3) {
            // Če noben poskus ne uspe, prikažemo napake za debugiranje
            console.error("KRITIČNA NAPAKA: Ne morem najti modela 'uporabnik' na nobeni preizkušeni poti (Absolutno).");
            console.error("Napaka 1:", e1.message);
            console.error("Napaka 2:", e2.message);
            console.error("Napaka 3:", e3.message);
            throw new Error("Kritična napaka: Modela 'uporabnik' ni bilo mogoče naložiti z nobeno preizkušeno potjo.");
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