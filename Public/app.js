// ===============================================
// 🚀 Public/app.js - Združitev nalaganja, prikaza in modalne logike
// ===============================================

// Definirajte bazni URL za vaš API
const API_BASE_URL = 'https://rentyo-gourmet-spletna-stran.onrender.com/api/restavracije';

// GLOBALNE SPREMENLJIVKE
let allRestavracije = []; // 🔥 Shranjujemo dinamične podatke iz API-ja
let currentRestaurantId = null; // ID restavracije, ki je trenutno v modalu
const WARNING_KEY = 'rentyo_warning_shown'; // Ključ za localStorage

// ===============================================
// I. FUNKCIJE ZA MODALNE KARTICE (Prikaz in Detajli)
// ===============================================

// Funkcija, ki naj bi se sprožila ob kliku na kartico
function poglejDetajle(restavracijaId) {
    // 1. Poišči restavracijo v dinamično naloženem seznamu
    const restavracija = allRestavracije.find(r => r._id === restavracijaId); 

    if (restavracija) {
        console.log(`Prikazujem detajle za restavracijo ID: ${restavracijaId}`);
        // 2. KLIC FUNKCIJE, KI NAPOLNI MODAL (Tu potrebujete funkcijo iz vaše index.html, npr. prikaziPodrobnosti)
        // Predpostavka: ta funkcija obstaja v scope-u (ali je vključena iz druge datoteke)
        if (typeof prikaziPodrobnosti === 'function') {
             prikaziPodrobnosti(restavracija); // Uporabite pravo funkcijo za polnjenje modala
        } else {
             // Če funkcija 'prikaziPodrobnosti' ni definirana, jo je treba vključiti
             console.error("Funkcija 'prikaziPodrobnosti' ni najdena! Prepustite jo tej datoteki.");
             // Zaenkrat le log
        }
    } else {
        console.error("Restavracija ni najdena v dinamičnem seznamu!");
    }
}


// Funkcija za generiranje HTML-ja kartic in vstavljanje v DOM
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
        // Opomba: predpostavimo, da je 'cuisine' array
        const kuhinja = restavracija.cuisine && restavracija.cuisine.length > 0 ? restavracija.cuisine.join(', ') : 'Razno';
        
        // Prikaz opisa za slovenski jezik (sl)
        const opis = restavracija.description && restavracija.description.sl 
                     ? restavracija.description.sl.substring(0, 100) + '...' 
                     : 'Opis ni na voljo.';
        
        const slikaUrl = restavracija.mainImageUrl || 'placeholder.jpg'; 

        // 🔥 KLJUČNO: ID iz API-ja je _id
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
    
    // 🔥 Po prikazu moramo inicializirati listenerje za filtre in ostalo
    if (typeof setupKuhinjaFiltersListeners === 'function') {
        setupKuhinjaFiltersListeners(); 
    }
    // Tukaj bi se klicala funkcija za prikaz Izpostavljenih Restavracij (če ni v ločeni datoteki)
    
}


// ===============================================
// II. NALAGANJE PODATKOV IN GLAVNI ZAGON
// ===============================================

async function naloziInPrikaziRestavracije() {
    console.log("Začenjam nalaganje restavracij iz API-ja...");
    const container = document.getElementById('restavracije-container'); 
    
    if (container) {
        // Uporabite element za status kartice, če obstaja
        container.innerHTML = '<p>Nalagam...</p>';
    }

    try {
        const response = await fetch(`${API_BASE_URL}/privzeto`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            throw new Error(`Napaka: ${response.statusText} (${response.status})`);
        }

        const restavracije = await response.json();
        
        // 🔥 KLJUČNO: Shranimo podatke v globalno spremenljivko za kasnejši dostop do detajlov
        allRestavracije = restavracije; 

        console.log("Uspešno naložene restavracije:", restavracije);

        // Prikaz kartic na strani (uporabimo funkcijo zgoraj)
        prikaziRestavracije(allRestavracije, container);

    } catch (error) {
        console.error("Kritična napaka pri Fetch klicu:", error);
        if (container) {
            container.innerHTML = `<p style="color: red;">Napaka pri nalaganju restavracij: ${error.message}</p>`;
        }
    }
}


// ===============================================
// III. LOGIKA MODALNEGA OPOZORILA (Enkraten prikaz)
// ===============================================

function preveriInPrikaziOpozorilo() {
    // 🎯 ID-ji morajo ustrezati vašemu HTML-ju!
    const modal = document.getElementById('warningModal'); 
    const closeModalBtn = document.getElementById('closeModalBtn'); 

    if (modal && closeModalBtn) {
        if (localStorage.getItem(WARNING_KEY) !== 'true') {
            
            // PRIKAŽITE MODAL (popravite, če se vaš modal skriva drugače, npr. z razredom 'hidden')
            modal.style.display = 'block'; 
            
            closeModalBtn.addEventListener('click', () => {
                // SKRIJTE MODAL
                modal.style.display = 'none'; 
                
                // Shrani status v localStorage, da se ne bo ponovno prikazal
                localStorage.setItem(WARNING_KEY, 'true');
            });
        }
    }
}

// ===============================================
// IV. ZAGON APLIKACIJE
// ===============================================

// Zaženemo nalaganje in preverjanje Modala, ko je stran naložena
document.addEventListener('DOMContentLoaded', () => {
    naloziInPrikaziRestavracije();
    preveriInPrikaziOpozorilo();
});