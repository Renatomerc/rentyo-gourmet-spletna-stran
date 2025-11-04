const jwt = require('jsonwebtoken');

// ⭐ Uvozi shemo in sekundarno povezavo
const UporabnikShema = require('../models/Uporabnik'); 
const dbUsers = require('../dbUsers'); 

// ⭐ KLJUČNO: Inicializiraj Mongoose Model enkrat, povezan s sekundarno povezavo
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
    
    // Pomožna funkcija za varno branje lastnosti iz req.body
    const preberiAnonimnePodatke = (req) => {
        const body = req.body || {}; 
        
        return {
            ime: body.imeGosta || 'Anonimni gost',
            telefon: body.telefon || 'N/A', 
            // Dodatek: Anonimni gost NIKOLI ni prijavljen. KLJUČNO ZA zahtevajPrijavo
            jePrijavljen: false 
        };
    };


    /**
     * Middleware funkcija za preverjanje žetona in dodajanje podatkov uporabnika v req.uporabnik.
     * Vedno kliče 'next()', ne glede na uspeh (uporabnik je bodisi prijavljen ali anonimni gost).
     */
    const preveriGosta = async (req, res, next) => {
        let token;
        
        // 1. POSKUSI BRANJE IZ VARNEGA, PODPISANEGA PIŠKOTKA
        if (req.signedCookies && req.signedCookies.auth_token) {
            token = req.signedCookies.auth_token;
        }
        
        // 2. REZERVA: Poskusi branje iz glave Authorization
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }


        if (token) {
            try {
                const dekodirano = jwt.verify(token, JWT_SECRET);

                // Poiščemo uporabnika po ID-ju iz žetona 
                const uporabnik = await Uporabnik.findById(dekodirano.id).select('-geslo -__v'); 

                if (!uporabnik) {
                    console.log("Neveljaven žeton: Uporabnik ni najden v DB. Nadaljujem kot anonimni klic.");
                    req.uporabnik = preberiAnonimnePodatke(req);
                    return next(); 
                }
                
                // USPEŠNA AVTENTIKACIJA: Shranimo podatke uporabnika
                req.uporabnik = uporabnik.toObject(); 
                req.uporabnik.jePrijavljen = true; // Nastavimo status prijave!
                
                delete req.uporabnik.geslo; 
                req.uporabnik.id = req.uporabnik._id;
                
                next();

            } catch (error) {
                // Žeton je neveljaven (potekel, napačen podpis, 'malformed')
                console.error("Napaka JWT avtentikacije (Žeton):", error.message);
                
                // Izbrišemo neveljaven piškotek
                res.cookie('auth_token', '', { httpOnly: true, expires: new Date(0) }); 

                // Nadaljujemo kot anonimni gost
                req.uporabnik = preberiAnonimnePodatke(req);
                next(); 
            }
        } 
        
        else {
            // Žeton ni prisoten
            req.uporabnik = preberiAnonimnePodatke(req);
            next();
        }
    };
    
    /**
     * NOVA FUNKCIJA: Middleware za prekinitev izvajanja, če uporabnik NI PRIJAVLJEN.
     * To uporabimo za ZAŠČITENE poti (npr. 'Moj profil').
     */
    const zahtevajPrijavo = (req, res, next) => {
        // Če req.uporabnik obstaja IN je jePrijavljen: true (kar pomeni uspešno avtentikacijo zgoraj)
        if (req.uporabnik && req.uporabnik.jePrijavljen === true) {
            next(); // Uporabnik je prijavljen, nadaljuj.
        } else {
            console.log("ZAVRNJENO: Klic na zaščiteno pot brez veljavne seje/žetona. Vračam 401.");
            // 🛑 KLJUČNO: Vrni 401 in NE kliči next(). To ustavi izvajanje.
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'Seja je potekla ali ste neavtorizirani. Prosimo, prijavite se ponovno.' 
            });
        }
    };
    
    // Vrnitev middleware funkcij
    return { preveriGosta, zahtevajPrijavo };
};
