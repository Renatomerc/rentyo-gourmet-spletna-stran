// generate_secret.js
const crypto = require('crypto');

// Generiraj naključni niz dolžine 32 bajtov (256 bitov) in ga pretvori v base64.
// To ustvari varen niz dolžine cca. 44 znakov.
const secret = crypto.randomBytes(32).toString('base64');

console.log("-----------------------------------------------------------------");
console.log("➡️ Vaš varno generiran COOKIE_SECRET ključ (Base64, 32 bajtov):");
console.log(secret);
console.log("-----------------------------------------------------------------");
console.log("⭐ NASVET: Kopirajte zgornji niz in ga dodajte v svojo .env datoteko ter na Render.");

// Dodatna generacija ključa za JWT, če ga potrebujete
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log("\nDodatni ključ za JWT (izbirno, 64 bajtov, Hex):");
console.log(jwtSecret);
console.log("-----------------------------------------------------------------");
