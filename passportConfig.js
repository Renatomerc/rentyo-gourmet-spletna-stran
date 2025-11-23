// ========================================
// 🟢 passportConfig.js — Konfiguracija Passport.js (POPRAVLJENO)
// ========================================

// 1. NALOŽI OKOLJSKE SPREMENLJIVKE TAKOJ!
require('dotenv').config(); 

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const AppleStrategy = require('passport-apple'); 

// ⭐ KLJUČNO POPRAVLJENO: Uvozimo Shemo (ne modela), da se izognemo Mongoose napaki.
const UporabnikShema = require('./models/Uporabnik'); 
// Uvozimo sekundarno povezavo
const dbUsers = require('./dbUsers'); 

// 🚨 Definiramo model na SEKUNDARNI POVEZAVI.
let Uporabnik;
try {
    // Poskusimo dobiti že obstoječi model (če je bil ustvarjen v authMiddleware.js)
    Uporabnik = dbUsers.model('Uporabnik');
} catch (e) {
    // Če model še ne obstaja na tej povezavi, ga registriramo s shemo
    Uporabnik = dbUsers.model('Uporabnik', UporabnikShema);
}

// Globalni ključi za lažje preverjanje
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;


function setupPassport(app) {
    
    // 1. Serizacija in Deserializacija (Vodenje seje)
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            // Uporabljamo model Uporabnik, povezan s sekundarno bazo
            const user = await Uporabnik.findById(id); 
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });

    // ========================================
    // 2. GOOGLE Strategija
    // ========================================
    // 🚨 KRITIČNA PREVERBA PRED UPORABO KLJUC̆EV
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        console.warn("⚠️ OPOZORILO: Manjkajo GOOGLE_CLIENT_ID ali SECRET. Google Auth je onemogočen.");
    } else {
        passport.use(new GoogleStrategy({
            clientID: GOOGLE_CLIENT_ID, // Ključi so sedaj na voljo!
            clientSecret: GOOGLE_CLIENT_SECRET, // Ključi so sedaj na voljo!
            callbackURL: "/api/auth/google/callback" 
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let currentUser = await Uporabnik.findOne({ googleId: profile.id });

                if (currentUser) {
                    console.log('Google uporabnik že registriran:', currentUser.ime);
                    done(null, currentUser);
                } else {
                    // Dodajanje privzetega gesla za Google uporabnike, da se izognemo Mongoose validaciji
                    const novoGeslo = 'google_oauth_user_no_password_set_' + profile.id; 
                    
                    const newUser = await Uporabnik.create({
                        googleId: profile.id,
                        ime: profile.displayName,
                        email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : 'ni-emaila@google.com',
                        geslo: novoGeslo, // Dodano, da model Uporabnik Shema ni prekršena
                        tockeZvestobe: 100 // Dodana privzeta vrednost
                    });
                    console.log('Nov Google uporabnik ustvarjen:', newUser.ime);
                    done(null, newUser);
                }
            } catch (err) {
                console.error("Napaka pri avtentikaciji Google uporabnika:", err);
                done(err, null);
            }
        }));
    }

    // ========================================
    // 3. APPLE Strategija
    // ========================================
    // Preverimo, ali so v okoljskih spremenljivkah nastavljeni ključi za Apple
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_PRIVATE_KEY_STRING) {
        passport.use(new AppleStrategy({
            clientID: process.env.APPLE_CLIENT_ID, 
            teamID: process.env.APPLE_TEAM_ID,
            keyIdentifier: process.env.APPLE_KEY_ID,
            // Uporabimo string ključa (.p8 vsebino)
            privateKeyString: process.env.APPLE_PRIVATE_KEY_STRING, 
            callbackURL: "/api/auth/apple/callback",
            passReqToCallback: true 
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const appleId = profile.id;
                let currentUser = await Uporabnik.findOne({ appleId: appleId });

                if (currentUser) {
                    console.log('Apple uporabnik že registriran:', currentUser.ime);
                    done(null, currentUser);
                } else {
                    const email = profile.email || 'skrit-email@apple.com';
                    const name = (req.body && req.body.user && req.body.user.name && req.body.user.name.firstName) 
                                 ? `${req.body.user.name.firstName} ${req.body.user.name.lastName}`
                                 : 'Apple Uporabnik';

                    const novoGeslo = 'apple_oauth_user_no_password_set_' + appleId;
                                 
                    const newUser = await Uporabnik.create({
                        appleId: appleId,
                        ime: name,
                        email: email,
                        geslo: novoGeslo, // Dodano
                        tockeZvestobe: 100 // Dodano
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