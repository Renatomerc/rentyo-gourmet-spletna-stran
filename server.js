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

// ===============================================
// 🚨 KRITIČNO: DODAJANJE GLOBALNE POTI ZA ISKANJE MODELOV ZA RENDER
// To omogoča, da require() najde 'models/uporabnik', ne glede na to,
// kje Render izvaja passportConfig.js (npr. znotraj 'src').
// Path.resolve() se uporabi, da se ustvari absolutna pot do korenskega imenika (..).
// Pričakuje se, da se server.js nahaja v 'src', models pa v korenu.
module.paths.push(path.resolve(__dirname, '..')); 
// ===============================================

// Prepričajte se, da je ta pot pravilna (npr. če je datoteka v korenu projekta)
const setupPassport = require('./passportConfig'); 

// 2️⃣ Uvoz sekundarne povezave (uporabniki)
const dbUsers = require('./dbUsers');

// 4️⃣ Inicializacija aplikacije (PREMAKNJENO GOR)
const app = express();
const PORT = process.env.PORT || 5000;


// 🟢 KLJUČNO: Preverjanje tajnih ključev
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'fallback_secret_for_cookies'; 
// ⭐ Skrivnost za Session (Passport uporablja seje)
const SESSION_SECRET = process.env.SESSION_SECRET || 'super_session_secret_123'; 


if (!JWT_SECRET_KEY) {
    console.error("❌ KRITIČNA NAPAKA: JWT_SECRET_KEY ni najden. Preverite .env datoteko!");
}

// ========================================
// 🟢 5️⃣ Middleware in POPRAVLJEN CORS
// ========================================

const allowedOrigins = [
    'https://www.rentyo.eu', 
    'http://www.rentyo.eu',  
    'https://rentyo-gourmet-spletna-stran.onrender.com', 
    'http://localhost:5000' 
];

app.use(cors({
    origin: true,
    credentials: true // Nujno, ker uporabljate piškotke (JWT)
})); 

app.use(express.json());

// 🔥 Vključitev Cookie Parserja
app.use(cookieParser(COOKIE_SECRET));

// 1️⃣ Middleware za Session in Passport - MORA BITI V TEM VRSTNEM REDU!
// ⭐ NOVO: Dodajanje Express Session (MORA BITI PRED Passport.initialize())
app.use(session({
    secret: SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dni
    }
}));

// ⭐ NOVO: Inicializacija Passporta (MORA BITI PO Session)
app.use(passport.initialize());
app.use(passport.session()); 
// ========================================

// 3️⃣ Uvoz routerjev in middleware-a
let restavracijaRouter;
let userRoutes;
let uploadRouter; 
let authMiddleware; 
let preveriGosta; 
let zahtevajPrijavo; 

try {
    authMiddleware = require('./middleware/authMiddleware')(JWT_SECRET_KEY);
    preveriGosta = authMiddleware.preveriGosta; 
    zahtevajPrijavo = authMiddleware.zahtevajPrijavo;

    // 2️⃣ Klic setupPassport - MORA BITI PO TEM, KO JE 'app' DEFINIRAN IN PO PASSPORT.SESSION()
    setupPassport(app); // Sedaj se pokliče TUKAJ, ko so vsi middleware-i nastavljeni

    restavracijaRouter = require('./routes/restavracijaRoutes')(preveriGosta);
    userRoutes = require('./routes/uporabnikRouter')(JWT_SECRET_KEY, preveriGosta, zahtevajPrijavo); 
    uploadRouter = require('./routes/uploadRoutes'); 

} catch (e) {
    console.error("❌ Kritična napaka pri nalaganju routerjev:", e.message);
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
    // 🎉 TUKAJ SE BO SEDAJ NAŠLA RUTA /api/auth/google
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
    test_piskotek_unsigned: nepodpisan ? 'Najden' : 'Ni najden'
  });
});


// 🌟 Strežba statičnih datotek (slike, meniji, CSS, JS)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); 
app.use(express.static(path.join(__dirname, 'Public')));


// ========================================
// 🗄️ POVEZAVA Z MONGODB (RESTAVRACIJE)
// ========================================
const mongoURIReservations = process.env.DB_URI_RESERVATIONS;

mongoose.connect(mongoURIReservations)
  .then(() => console.log('✅ Povezava z MongoDB (Restavracije) je uspešna! Baza: rezervacije_db'))
  .catch(err => console.error('❌ Napaka pri povezovanju z MongoDB (Restavracije):', err));

// Sekundarna povezava za uporabnike se vzpostavi preko dbUsers.js


// 🔹 SPA fallback - postavi ZADNJI, PO API IN STATIČNEM
app.use(fallback({
    index: '/index.html',
    verbose: true
}));

// ========================================
// 🚀 ZAGON STREŽNIKA
// ========================================
app.listen(PORT, () => {
  console.log(`🚀 Strežnik teče na portu ${PORT}`);
});