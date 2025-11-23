// ========================================
// 🟢 SERVER.JS — Rentyo Gourmet Backend (POPRAVLJENO)
// ========================================

// 1️⃣ Uvoz potrebnih modulov
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config(); 
const path = require('path');
const fallback = require('connect-history-api-fallback'); 

// ⭐ Uvoz Passport.js in Express Session
const passport = require('passport');
const session = require('express-session');

// ⭐ KLJUČNO: Uvoz funkcije za inicializacijo Passporta
// 🚨 POPRAVEK: MORA BITI UVOŽENA PRED KLICEM setupPassport(app)
// PREDPOSTAVKA POTI: Preverite, ali je pot `./passportConfig` pravilna!
const setupPassport = require('./passportConfig'); 

// ⭐ KLJUČNO: Uvoz ločene povezave za uporabnike.
const dbUsers = require('./dbUsers'); // Predvidevamo, da ta poskrbi za svojo povezavo

// 4️⃣ Inicializacija aplikacije
const app = express();
const PORT = process.env.PORT || 5000;

// 🟢 KLJUČNO: Preverjanje tajnih ključev
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'fallback_secret_for_cookies'; 
const SESSION_SECRET = process.env.SESSION_SECRET || 'super_session_secret_123'; 

if (!JWT_SECRET_KEY) {
    console.error("❌ KRITIČNA NAPAKA: JWT_SECRET_KEY ni najden. Preverite .env datoteko!");
}

// ========================================
// 🔗 NASTAVITEV ABSOLUTNE POTI ZA ISKANJE MODELOV ZA RENDER (OSTANE)
// ========================================
// Ker vemo, da je server.js v 'src' in modeli v 'src/models',
// to je pot, ki nam je pomagala pri prejšnji napaki.
module.paths.push(path.resolve(__dirname)); 
// Opomba: Ker smo v passportConfig.js uporabili './models/Uporabnik', tukaj ne potrebujemo več '../'.

// ========================================
// 🗄️ POVEZAVA Z MONGODB (RESTAVRACIJE) - KRITIČEN KORAK
// ========================================
const mongoURIReservations = process.env.DB_URI_RESERVATIONS;

mongoose.connect(mongoURIReservations)
  .then(() => {
    console.log('✅ Povezava z MongoDB (Restavracije) je uspešna! Baza: rezervacije_db');
    // Po uspešni povezavi zaganjamo ostalo aplikacijo
    startApp(); 
  })
  .catch(err => {
    console.error('❌ Napaka pri povezovanju z MongoDB (Restavracije). Kritična napaka:', err);
    process.exit(1); // Zapusti aplikacijo, če je DB nedostopen
  });

// Sekundarna povezava za uporabnike se vzpostavi preko dbUsers.js (predvidevamo, da je znotraj te datoteke)
// Če dbUsers.js ne izvaža Promise, je to edini način za sinhronizacijo.

// ========================================
// 🚀 GLAVNA FUNKCIJA ZA ZAGON APLIKACIJE (Kliče se po uspešni povezavi z DB)
// ========================================
function startApp() {
    
    // 🟢 5️⃣ Middleware in CORS
    const allowedOrigins = [
        'https://www.rentyo.eu', 
        'http://www.rentyo.eu',  
        'https://rentyo-gourmet-spletna-stran.onrender.com', 
        'http://localhost:5000' 
    ];

    app.use(cors({
        origin: true,
        credentials: true
    })); 

    app.use(express.json());
    app.use(express.urlencoded({ extended: true })); // Dodano za Passport.js
    app.use(cookieParser(COOKIE_SECRET));

    // Middleware za Session in Passport
    app.use(session({
        secret: SESSION_SECRET, 
        resave: false,
        saveUninitialized: false,
        cookie: { 
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dni
        }
    }));

    // ⭐ Inicializacija Passporta (MORA BITI PO Session)
    app.use(passport.initialize());
    app.use(passport.session()); 
    
    // ========================================
    // 3️⃣ Uvoz in inicializacija routerjev (ZDaj, ko je DB povezana!)
    // ========================================
    let restavracijaRouter;
    let userRoutes;
    let uploadRouter; 
    let authMiddleware; 
    let preveriGosta; 
    let zahtevajPrijavo; 

    try {
        // Ta koda uporablja modele, zato jo premaknemo sem!
        authMiddleware = require('./middleware/authMiddleware')(JWT_SECRET_KEY);
        preveriGosta = authMiddleware.preveriGosta; 
        zahtevajPrijavo = authMiddleware.zahtevajPrijavo;

        // Klic setupPassport
        setupPassport(app); // Sedaj je funkcija definirana zgoraj!

        // Uvoz routerjev, ki uporabljajo Mongoose modele
        restavracijaRouter = require('./routes/restavracijaRoutes')(preveriGosta);
        userRoutes = require('./routes/uporabnikRouter')(JWT_SECRET_KEY, preveriGosta, zahtevajPrijavo); 
        uploadRouter = require('./routes/uploadRoutes'); 

    } catch (e) {
        console.error("❌ Kritična napaka pri nalaganju routerjev. Preverite poti modelov znotraj routerjev:", e.message);
        // Tukaj moramo ugotoviti, kateri uvoz je povzročil napako
        console.error("Stack trace:", e.stack);
        // Aplikacijo lahko pustimo teči, da vidimo, kje drugje so napake, a API poti ne bodo delovale
    }


    // ========================================
    // 🔗 API POTI
    // ========================================
    if (restavracijaRouter) {
        app.use('/api/restavracije', restavracijaRouter);
        console.log("✅ API Pot za Restavracije (/api/restavracije) je uspešno priključena.");
    } else {
        console.error("❌ KRITIČNA NAPAKA: restavracijaRouter se ni uspel naložiti. Preverite napake v routes/restavracijaRoutes.js ali modelu!");
    }

    if (userRoutes) {
        // TUKAJ SE BO SEDAJ NAŠLA RUTA /api/auth/google
        app.use('/api/auth', userRoutes); 
        console.log("✅ API Pot za Avtentikacijo (/api/auth) je uspešno priključena.");
    }

    if (uploadRouter) {
        app.use('/api/upload', uploadRouter); 
        console.log("✅ API Pot za Nalaganje (/api/upload) je uspešno priključena.");
    }


    // ========================================
    // 🌐 TESTNI ENDPOINT
    // ========================================
    app.get('/api/test', (req, res) => {
      const nepodpisan = req.cookies.some_cookie;
      const podpisan = req.signedCookies.some_signed_cookie;
      
      res.json({ 
        sporocilo: 'Povezava z backendom deluje pravilno ✅',
        test_piskotek_signed: podpisan ? 'Najden' : 'Ni najden',
        test_piskotek_unsigned: nepodpisan ? 'Najden' : 'Ni najden',
        uporabnik_povezan: req.user ? req.user.ime : 'Ne prijavljen'
      });
    });


    // 🌟 Strežba statičnih datotek (slike, meniji, CSS, JS)
    app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 
    // Pričakujemo, da je mapa 'Public' znotraj 'src' na Renderju, sicer bi morali uporabiti '..'
    app.use(express.static(path.join(__dirname, 'Public'))); 

    // 🔹 SPA fallback - postavi ZADNJI, PO API IN STATIČNEM
    app.use(fallback({
        index: '/index.html',
        verbose: true
    }));

    // 🚀 ZAGON STREŽNIKA
    app.listen(PORT, () => {
      console.log(`🚀 Strežnik teče na portu ${PORT}`);
    });
}