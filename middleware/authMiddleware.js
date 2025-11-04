// V tej datoteki morate spremeniti, kako se žeton bere.

const jwt = require('jsonwebtoken');

// ⭐ Uvozi shemo in sekundarno povezavo
const UporabnikShema = require('../models/Uporabnik'); 
const dbUsers = require('../dbUsers'); 

// ⭐ KLJUČNO: Inicializiraj Mongoose Model enkrat, povezan s sekundarno povezavo
// Dodajanje robustnega načina inicializacije, da se izognemo "OverwriteModelError"
let Uporabnik;
try {
    // Poskusimo dobiti že obstoječi model, če je bil registriran
    Uporabnik = dbUsers.model('Uporabnik');
} catch (e) {
    // Če model še ne obstaja, ga registriramo
    Uporabnik = dbUsers.model('Uporabnik', UporabnikShema);
}


// Middleware sedaj sprejme TAJNI KLJUČ kot parameter!
module.exports = (JWT_SECRET_KEY) => {

    // 🔑 KLJUČNO: Uporabimo prejeti ključ
    const JWT_SECRET = JWT_SECRET_KEY; 

    if (!JWT_SECRET) {
         console.error("❌ KRITIČNA NAPAKA: JWT_SECRET_KEY ni bil prenesen v authMiddleware. Klic zavrnjen.");
         // Če ni ključa, se ne moremo avtenticirati.
    }

    /**
     * Middleware funkcija za preverjanje žetona (iz piškotka ali glave) in dodajanje podatkov
     * uporabnika (gosta) v req.uporabnik.
     */
    const preveriGosta = async (req, res, next) => {
        let token;
        
        // 1. POSKUSI BRANJE IZ VARNEGA, PODPISANEGA PIŠKOTKA (cookie-parser omogoči req.signedCookies)
        if (req.signedCookies && req.signedCookies.auth_token) {
            token = req.signedCookies.auth_token;
            // console.log("DEBUG: Žeton najden v PIŠKOTKU.");
        }
        
        // 2. REZERVA: Poskusi branje iz glave Authorization (za združljivost/stare klice)
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
            // console.log("DEBUG: Žeton najden v GLAVI.");
        }


        // =========================================================================
        // 3. LOGIKA ZA PREVERJANJE ŽETONA (ČE JE NAJDEN)
        // =========================================================================
        if (token) {
            try {
                // 🔥 Uporabimo prejeti JWT_SECRET
                const dekodirano = jwt.verify(token, JWT_SECRET);

                // Poiščemo uporabnika po ID-ju iz žetona 
                const uporabnik = await Uporabnik.findById(dekodirano.id).select('-geslo -__v'); 

                if (!uporabnik) {
                    // Žeton veljaven, a uporabnik v DB ne obstaja več
                    console.log("Neveljaven žeton: Uporabnik ni najden v DB. Nadaljujem kot anonimni klic.");
                    
                    // Nastavimo uporabnika na anonimnega
                    req.uporabnik = { ime: 'Anonimni gost (Avt. napaka)', telefon: req.body.telefon || 'N/A' };
                    return next(); 
                }
                
                // USPEŠNA AVTENTIKACIJA: Shranimo podatke uporabnika
                // ⭐ KLJUČNI POPRAVEK: Uporaba .toObject() namesto .toJSON() za čisto JS objekt
                req.uporabnik = uporabnik.toObject(); 
                
                // Izbrišemo geslo in dodamo id
                delete req.uporabnik.geslo; 
                req.uporabnik.id = req.uporabnik._id;
                
                next();

            } catch (error) {
                // Žeton je neveljaven (potekel, napačen podpis)
                console.error("Napaka JWT avtentikacije (Žeton):", error.message);
                
                // NE POZABI: V primeru napake izbrišemo piškotek, če je bil uporabljen.
                res.cookie('auth_token', '', { httpOnly: true, expires: new Date(0) }); 

                // Nadaljujemo kot anonimni gost
                req.uporabnik = { ime: 'Anonimni gost (Avt. napaka)', telefon: req.body.telefon || 'N/A' };
                next(); 
            }
        } 
        
        // =========================================================================
        // 4. LOGIKA ZA ANONIMNEGA GOSTA (ČE ŽETON NI NAJDEN)
        // =========================================================================
        else {
            // Če žeton ni prisoten (anonimna rezervacija ali neprijavljeni uporabnik):
            // console.log("Anonimni klic: Nadaljujem z osnovnimi podatki.");
            
            // Nastavimo osnovne podatke gosta iz telesa zahteve
            req.uporabnik = {
                ime: req.body.imeGosta || 'Anonimni gost',
                telefon: req.body.telefon || 'N/A'
            };
            next();
        }
    };
    
    // Vrnitev middleware funkcije
    return { preveriGosta };
};
