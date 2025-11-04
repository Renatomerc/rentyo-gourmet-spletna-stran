// app.js (v mapi Public)

// Definirajte bazni URL za vaš API
const API_BASE_URL = 'https://rentyo-gourmet-spletna-stran.onrender.com/api/restavracije';

// Funkcija za zagon pridobivanja podatkov
async function naloziRestavracije() {
    console.log("Začenjam nalaganje restavracij...");
    const container = document.getElementById('restavracije-container'); // Predpostavljamo, da imate ta ID v HTML-ju
    
    // Počistimo prejšnjo statično vsebino (če obstaja)
    if (container) {
        container.innerHTML = '<p>Nalagam...</p>';
    }

    try {
        // Klic GET /api/restavracije/privzeto
        const response = await fetch(`${API_BASE_URL}/privzeto`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Če bi pošiljali avtentikacijo, bi dodali tudi 'Authorization' header, 
                // vendar za GET /privzeto to ni potrebno
            },
        });

        if (!response.ok) {
            throw new Error(`Napaka: ${response.statusText} (${response.status})`);
        }

        const restavracije = await response.json();
        console.log("Uspešno naložene restavracije:", restavracije);

        // Prikaz na strani
        prikaziRestavracije(restavracije, container);

    } catch (error) {
        console.error("Kritična napaka pri Fetch klicu:", error);
        if (container) {
            container.innerHTML = `<p style="color: red;">Napaka pri nalaganju restavracij: ${error.message}</p>`;
        }
    }
}

// Funkcija za generiranje HTML-ja in vstavljanje v DOM
function prikaziRestavracije(restavracije, container) {
    if (!container) return;

    if (restavracije.length === 0) {
        container.innerHTML = '<p>Žal mi je, trenutno ni aktivnih restavracij za prikaz.</p>';
        return;
    }

    container.innerHTML = restavracije.map(restavracija => {
        // Uporabljamo podatke iz vašega Modela!
        const ime = restavracija.ime;
        const ocena = restavracija.ocena_povprecje ? restavracija.ocena_povprecje.toFixed(1) : 'N/A';
        const kuhinja = restavracija.cuisine ? restavracija.cuisine.join(', ') : 'Razno';
        
        // Prikaz opisa za slovenski jezik (sl)
        const opis = restavracija.description && restavracija.description.sl 
                     ? restavracija.description.sl.substring(0, 100) + '...' 
                     : 'Opis ni na voljo.';
        
        // Predpostavimo, da je `mainImageUrl` url za sliko
        const slikaUrl = restavracija.mainImageUrl || 'placeholder.jpg'; 

        return `
            <div class="restavracija-kartica" data-id="${restavracija._id}">
                <img src="${slikaUrl}" alt="${ime}" class="kartica-slika">
                <div class="kartica-telo">
                    <h3>${ime}</h3>
                    <p class="ocena">⭐ ${ocena}</p>
                    <p class="kuhinja">${kuhinja}</p>
                    <p class="opis">${opis}</p>
                    <button onclick="poglejDetajle('${restavracija._id}')" class="gumb-detajli">Poglej detajle</button>
                </div>
            </div>
        `;
    }).join('');
}

// Funkcija za preusmeritev ali prikaz modala (za kasneje)
function poglejDetajle(restavracijaId) {
    // Tukaj boste kasneje preusmerili na stran z detajli: 
    // window.location.href = `/detajli.html?id=${restavracijaId}`;
    console.log(`Želite detajle restavracije z ID: ${restavracijaId}`);
}


// Zaženemo nalaganje, ko je stran naložena
document.addEventListener('DOMContentLoaded', naloziRestavracije);