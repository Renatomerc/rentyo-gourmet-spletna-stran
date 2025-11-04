// ========================================
// 🟢 SERVER.JS — Rentyo Gourmet Backend
// ========================================

// 1️⃣ Uvoz potrebnih modulov
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // <--- NOVO: Uvoz za delo s piškotki
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

// 🟢 KLJUČNO: Preverjanje tajnih ključev
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const COOKIE_SECRET = process.env.COOKIE_SECRET; // <--- NOVO: Preberi tajni ključ za piškotke

if (!JWT_SECRET_KEY) {
    console.error("❌ KRITIČNA NAPAKA: JWT_SECRET_KEY ni najden. Preverite .env datoteko!");
}
if (!COOKIE_SECRET) {
    // To je opozorilo, saj bo aplikacija delovala, a podpisovanje (signed cookies) ne.
    console.warn("⚠️ OPOZORILO: COOKIE_SECRET ni najden. Podpisovanje piškotkov ne bo delovalo! Dodajte v .env.");
}

try {
    // 🔥 Uvoz in inicializacija Auth Middleware-a (vrne objekt { preveriGosta })
    authMiddleware = require('./middleware/authMiddleware')(JWT_SECRET_KEY);
    preveriGosta = authMiddleware.preveriGosta; 

    // 👇 restavracijaRoutes.js sedaj pričakuje preveriGosta kot argument!
    restavracijaRouter = require('./routes/restavracijaRoutes')(preveriGosta);
    
    // 🔥 userRoutes sedaj pričakuje ključ in middleware
    userRoutes = require('./routes/uporabnikRouter')(JWT_SECRET_KEY, preveriGosta); 

    // ✅ NOVO: Uvoz upload routerja 
    uploadRouter = require('./routes/uploadRoutes'); 

} catch (e) {
    console.error("❌ Kritična napaka pri nalaganju routerjev:", e.message);
}

// 4️⃣ Inicializacija aplikacije
const app = express();
const PORT = process.env.PORT || 5000;

// 5️⃣ Middleware
app.use(cors()); 
app.use(express.json());

// 🔥 Vključitev Cookie Parserja. Uporablja COOKIE_SECRET za podpisovanje piškotkov.
// Ta middleware mora biti pred vsemi rutami, ki piškotke berejo ali nastavljajo.
app.use(cookieParser(COOKIE_SECRET));


// ========================================
// 🔗 API POTI (PREMAKNJENO NAVZGOR) - ZELO POMEMBNO!
// ========================================
if (restavracijaRouter) app.use('/api/restavracije', restavracijaRouter);
if (userRoutes) app.use('/api/auth', userRoutes); 
if (uploadRouter) app.use('/api/upload', uploadRouter); 


// ========================================
// 🌐 TESTNI ENDPOINT
// ========================================
app.get('/api/test', (req, res) => {
  // Primer branja piškotkov:
  const nepodpisan = req.cookies.some_cookie;
  const podpisan = req.signedCookies.some_signed_cookie;
  
  res.json({ 
    sporocilo: 'Povezava z backendom deluje pravilno ✅',
    test_piskotek_signed: podpisan ? 'Najden' : 'Ni najden',
    test_piskotek_unsigned: nepodpisan ? 'Najden' : 'Ni najden'
  });
});


// 🌟 Strežba statičnih datotek (slike, meniji, CSS, JS) - PREMAKNJENO NAVZDOL
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