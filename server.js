// ========================================
// 🟢 SERVER.JS — Rentyo Gourmet Backend
// ========================================

// 1️⃣ Uvoz potrebnih modulov
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config(); 
const path = require('path');
const fallback = require('connect-history-api-fallback'); 

// 2️⃣ Uvoz sekundarne povezave (uporabniki)
const dbUsers = require('./dbUsers');

// 3️⃣ Uvoz routerjev in middleware-a
let restavracijaRouter;
let userRoutes;
let uploadRouter; 
let authMiddleware; 
let preveriGosta; 
// ⭐ NOVO: Uvozimo tudi zahtevajPrijavo
let zahtevajPrijavo; 

// 🟢 KLJUČNO: Preverjanje tajnih ključev
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
// 🔥 POPRAVLJENO: Zagotovimo, da COOKIE_SECRET ni null/undefined (dodamo fallback vrednost)
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'fallback_secret_for_cookies'; 

if (!JWT_SECRET_KEY) {
    console.error("❌ KRITIČNA NAPAKA: JWT_SECRET_KEY ni najden. Preverite .env datoteko!");
}

try {
    authMiddleware = require('./middleware/authMiddleware')(JWT_SECRET_KEY);
    preveriGosta = authMiddleware.preveriGosta; 
    // ⭐ KLJUČNO POPRAVILO: Uvozimo zahtevajPrijavo
    zahtevajPrijavo = authMiddleware.zahtevajPrijavo;

    restavracijaRouter = require('./routes/restavracijaRoutes')(preveriGosta);
    // ⭐ KLJUČNO POPRAVILO: Posredujemo zahtevajPrijavo uporabnikRouterju
    userRoutes = require('./routes/uporabnikRouter')(JWT_SECRET_KEY, preveriGosta, zahtevajPrijavo); 
    uploadRouter = require('./routes/uploadRoutes'); 

} catch (e) {
    console.error("❌ Kritična napaka pri nalaganju routerjev:", e.message);
}

// 4️⃣ Inicializacija aplikacije
const app = express();
const PORT = process.env.PORT || 5000;

// ========================================
// 🟢 5️⃣ Middleware in POPRAVLJEN CORS
// ========================================

// 🔥 Dovoljeni izvori za CORS
const allowedOrigins = [
    // Opomba: Ta seznam ni več kritičen zaradi origin: true, a je ohranjen za lažjo vrnitev k varnosti.
    'https://www.rentyo.eu', // Tvoja primarna domena (Frontend)
    'http://www.rentyo.eu',  // Dodan tudi HTTP (čeprav bi moralo biti HTTPS)
    'https://rentyo-gourmet-spletna-stran.onrender.com', // Tvoj Render URL
    'http://localhost:5000' // Za lokalni razvoj
];

app.use(cors({
    // 🔥 KLJUČNI POPRAVEK ZA TESTIRANJE: NASTAVIMO ORIGIN NA TRUE.
    origin: true,
    credentials: true // Nujno, ker uporabljate piškotke (JWT)
})); 

app.use(express.json());

// 🔥 Vključitev Cookie Parserja (uporaba COOKIE_SECRET z zagotovljeno vrednostjo)
app.use(cookieParser(COOKIE_SECRET));


// ========================================
// 🔗 API POTI
// ========================================
if (restavracijaRouter) app.use('/api/restavracije', restavracijaRouter);
if (userRoutes) app.use('/api/auth', userRoutes); 
if (uploadRouter) app.use('/api/upload', uploadRouter); 


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