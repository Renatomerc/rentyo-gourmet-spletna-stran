// ========================================
// 🟢 passportConfig.js — Konfiguracija Passport.js (GOOGLE IN APPLE)
// ========================================

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple'); 
// ODSTRANIMO 'path' in KRITIČNE ABSOLUTNE POTI, ker se datoteka nahaja v korenu.
// Uporabljamo preprosto relativno pot, ki je pravilna, če je models/ v istem imeniku kot passportConfig.js.
const Uporabnik = require('../models/Uporabnik');

function setupPassport(app) {
    // Uvoz okoljskih spremenljivk
    require('dotenv').config();

    // 1. Serizacija in Deserializacija (Vodenje seje)
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

    // ========================================
    // 2. GOOGLE Strategija
    // ========================================
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback" 
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            let currentUser = await Uporabnik.findOne({ googleId: profile.id });

            if (currentUser) {
                console.log('Google uporabnik že registriran:', currentUser.ime);
                done(null, currentUser);
            } else {
                const newUser = await Uporabnik.create({
                    googleId: profile.id,
                    ime: profile.displayName,
                    email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : 'ni-emaila@google.com',
                });
                console.log('Nov Google uporabnik ustvarjen:', newUser.ime);
                done(null, newUser);
            }
        } catch (err) {
            console.error("Napaka pri avtentikaciji Google uporabnika:", err);
            done(err, null);
        }
    }));

    // ========================================
    // 3. APPLE Strategija
    // ========================================
    // Preverimo, ali so v okoljskih spremenljivkah nastavljeni ključi za Apple
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID) {
        passport.use(new AppleStrategy({
            clientID: process.env.APPLE_CLIENT_ID, 
            teamID: process.env.APPLE_TEAM_ID,
            keyIdentifier: process.env.APPLE_KEY_ID,
            // Uporabimo string ključa (.p8 vsebino), da se izognemo težavam s potjo na Renderju
            privateKeyString: process.env.APPLE_PRIVATE_KEY_STRING, 
            callbackURL: "/api/auth/apple/callback",
            passReqToCallback: true 
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                // Apple ID je edinstven identifikator
                const appleId = profile.id;
                let currentUser = await Uporabnik.findOne({ appleId: appleId });

                if (currentUser) {
                    console.log('Apple uporabnik že registriran:', currentUser.ime);
                    done(null, currentUser);
                } else {
                    // Apple lahko skrije email in ime. Če jih dobi, jih uporabi.
                    const email = profile.email || 'skrit-email@apple.com';
                    const name = (req.body && req.body.user && req.body.user.name && req.body.user.name.firstName) 
                                 ? `${req.body.user.name.firstName} ${req.body.user.name.lastName}`
                                 : 'Apple Uporabnik';
                                 
                    const newUser = await Uporabnik.create({
                        appleId: appleId,
                        ime: name,
                        email: email,
                    });
                    console.log('Nov Apple uporabnik ustvarjen:', newUser.ime);
                    done(null, newUser);
                }
            } catch (err) {
                console.error("Napaka pri avtentikaciji Apple uporabnika:", err);
                done(err, null);
            }
        }));
    } else {
        console.warn("⚠️ OPOZORILO: Apple spremenljivke v .env niso nastavljene, Apple prijava je onemogočena.");
    }
}

module.exports = setupPassport;