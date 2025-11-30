// ========================================
// 🟢 SERVER.JS — Rentyo Gourmet Backend (POPRAVLJENO z Firebase Admin SDK in Schedulerjem)
// ========================================

// 1️⃣ Uvoz potrebnih modulov
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config(); 
const path = require('path');
const fallback = require('connect-history-api-fallback'); 

// 🔥 DODANO: Uvoz Admin SDK
const admin = require('firebase-admin'); 

// ⭐ Uvoz Passport.js in Express Session
const passport = require('passport');
const session = require('express-session');

// ⭐ KLJUČNO: Uvoz funkcije za inicializacijo Passporta
const setupPassport = require('./passportConfig'); 

// ⭐ KLJUČNO: Uvoz ločene povezave za uporabnike.
const dbUsers = require('./dbUsers'); 

// 🟢 NOVO: Uvoz krmilnika za dostop do funkcije za čiščenje rezervacij
const restavracijaController = require('./controllers/restavracijaController'); 

// 🔥 DODANO ZA CRON JOB: Uvoz schedulerja
const scheduler = require('./cron/scheduler'); 

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
// 🔥 PUSH OBOVESTILA - INITIALIZACIJA FIREBASE ADMIN SDK (Vaša koda, ostane ista)
// ========================================
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        // Ker Render pošlje JSON kot en dolg tekst, ga moramo parsiati
        const serviceAccountText = process.env.FIREBASE_SERVICE_ACCOUNT;
        const serviceAccount = JSON.parse(serviceAccountText);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('✅ Firebase Admin SDK za PUSH obvestila je uspešno inicializiran.');
    } catch (e) {
        console.error('❌ NAPAKA: Inicializacija Firebase Admin SDK ni uspela. Preverite FIREBASE_SERVICE_ACCOUNT JSON format.', e);
        // OPOZORILO: Ne izključite strežnika, saj to ni kritično za delovanje strani, le za PUSH obvestila
    }
} else {
    console.warn('⚠️ OPOZORILO: FIREBASE_SERVICE_ACCOUNT ni nastavljen. PUSH obvestila ne bodo delovala, dokler ga ne nastavite na Renderju.');
}
// ========================================


// ========================================
// 🔗 NASTAVITEV ABSOLUTNE POTI ZA ISKANJE MODELOV ZA RENDER (OSTANE)
// ========================================
module.paths.push(path.resolve(__dirname)); 

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
    process.exit(1); 
  });

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
    app.use(express.urlencoded({ extended: true })); 
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
    // 🔥 NOVO: Klic funkcije za čiščenje preteklih rezervacij ob zagonu
    // ========================================
    try {
        console.log("🛠️ Sprožam čiščenje preteklih, nepotrjenih rezervacij...");
        restavracijaController.oznaciPretekleRezervacije(); 
        
        // ⭐ DODANO: Zaganjanje periodičnega CRON SCHEDULERJA
        if (admin.apps.length > 0) { // Preveri, ali je Firebase Admin SDK inicializiran
            scheduler.startScheduler();
        } else {
            console.warn("⚠️ Cron Scheduler NI zagnan, ker Firebase Admin SDK ni inicializiran.");
        }
        
    } catch (e) {
        console.error("❌ NAPAKA pri inicializaciji čiščenja rezervacij ali schedulerja:", e.message);
    }
    // ========================================
    
    
    // ========================================
    // 3️⃣ Uvoz in inicializacija routerjev 
    // ========================================
    let restavracijaRouter;
    let userRoutes;
    let uploadRouter;
    let offersRouter; 
    let authMiddleware; 
    let preveriGosta; 
    let zahtevajPrijavo; 

    try {
        authMiddleware = require('./middleware/authMiddleware')(JWT_SECRET_KEY);
        preveriGosta = authMiddleware.preveriGosta; 
        zahtevajPrijavo = authMiddleware.zahtevajPrijavo;

        // Klic setupPassport
        setupPassport(app); 

        // Uvoz routerjev, ki uporabljajo Mongoose modele
        // Uporabimo uvoženi restavracijaController, da se izognemo ponovnemu require() klicu
        restavracijaRouter = require('./routes/restavracijaRoutes')(preveriGosta);
        userRoutes = require('./routes/uporabnikRouter')(JWT_SECRET_KEY, preveriGosta, zahtevajPrijavo); 
        uploadRouter = require('./routes/uploadRoutes');
        
        offersRouter = require('./routes/offersRoutes'); 

    } catch (e) {
        console.error("❌ Kritična napaka pri nalaganju routerjev. Preverite poti modelov znotraj routerjev:", e.message);
        console.error("Stack trace:", e.stack);
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
    
    // ⭐ NOVO: Priključitev API Poti za Ponudbe
    if (offersRouter) {
        app.use('/api/offers', offersRouter);
        console.log("✅ API Pot za Ponudbe (/api/offers) je uspešno priključena.");
    }

    if (userRoutes) {
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