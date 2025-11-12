// ===============================================
// 🚀 Public/app.js - Združitev nalaganja API podatkov, prikaza, filtrov in modalne logike
// ===============================================

// Definirajte bazni URL za vaš API
const API_BASE_URL = 'https://rentyo-gourmet-spletna-stran.onrender.com/api/restavracije';

// ===============================================
// I. GLOBALNE SPREMENLJIVKE IN DOM ELEMENTI
// ===============================================

let allRestavracije = []; // 🔥 Shranjujemo dinamične podatke iz API-ja
let currentFilterKuhinja = ''; // Trenutno aktiven filter kuhinje
let currentRestaurantId = null; // ID restavracije, ki je trenutno v modalu
const WARNING_KEY = 'rentyo_warning_shown'; // Ključ za localStorage

// Povezava na DOM elemente (iz prvega bloka - index.html)
const mrezaKarticDiv = document.getElementById('restavracije-container');
const statusKarticeDiv = document.getElementById('statusKartice');
const gumbiKategorijDiv = document.querySelector('.gumbi-kategorij'); // Za filtre

// Elementi za Izpostavljeno sekcijo
const mrezaIzpostavljenoKarticDiv = document.getElementById('mrezaIzpostavljenoKartic');
const statusIzpostavljenoKarticeDiv = document.getElementById('statusIzpostavljenoKartice');

// Elementi vsebine modala
const restavracijaModal = document.getElementById('restavracijaModal');
const zapriRestavracijaModal = document.getElementById('zapriRestavracijaModal');
const modalSlika = document.getElementById('modalSlika');
const modalIme = document.getElementById('modalIme');
const modalKuhinja = document.getElementById('modalKuhinja');
const modalLokacija = document.getElementById('modalLokacija');
const modalOcena = document.getElementById('modalOcena');
const modalOpis = document.getElementById('modalOpis');

// Novi elementi za zavihke
const modalTabs = document.querySelectorAll('.modal-tab');
const modalMeni = document.getElementById('modalMeni');
const galerijaSlikeDiv = document.getElementById('galerijaSlike');
const modalZemljevid = document.getElementById('modalZemljevid');
const modalAktualnaPonudbaOpis = document.getElementById('modalAktualnaPonudbaOpis');


// ===============================================
// II. POMOŽNE FUNKCIJE
// ===============================================

// Pomožna funkcija za zvezdice
function generateStarsHTML(rating) {
    const fullStar = '★';
    const maxStars = 5;
    // Prepričamo se, da je ocena veljavna številka, sicer uporabimo 0
    const validRating = typeof rating === 'number' ? rating : 0;
    const roundedRating = Math.round(validRating);

    let starsHTML = '';
    for (let i = 1; i <= maxStars; i++) {
        if (i <= roundedRating) {
            starsHTML += `<span style="color: #ff9900;">${fullStar}</span>`;
        } else {
            starsHTML += `<span style="color: #e0e0e0;">${fullStar}</span>`;
        }
    }
    return starsHTML;
}

// Funkcija za logiko zavihkov
modalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');

        // Odstrani 'active' iz vseh zavihkov
        modalTabs.forEach(t => t.classList.remove('active'));
        // Dodaj 'active' trenutnemu zavihku
        tab.classList.add('active');

        // Skrij vso vsebino
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Prikaži ciljno vsebino
        const targetElementId = `tab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`;
        document.getElementById(targetElementId).classList.add('active');
    });
});

// Zapiranje modala (listenerji)
if (zapriRestavracijaModal) {
    zapriRestavracijaModal.addEventListener('click', () => {
        restavracijaModal.classList.remove('active');
        modalZemljevid.src = 'about:blank';
        currentRestaurantId = null; // Resetiramo ID
    });
}

window.addEventListener('click', (e) => {
    if (e.target === restavracijaModal) {
        restavracijaModal.classList.remove('active');
        modalZemljevid.src = 'about:blank';
        currentRestaurantId = null; // Resetiramo ID
    }
});


// ===============================================
// III. LOGIKA PRIKAZA IN INTERAKCIJ (Kartice in Modal)
// ===============================================

// Funkcija, ki napolni modal s podatki in ga odpre (PRILAGOJENO API STRUKTURI)
function prikaziPodrobnosti(restavracija) {
    // 1. Mapiranje podatkov iz API strukture:
    const id = restavracija._id;
    const ime = restavracija.ime || 'Neznano Ime';
    const slika = restavracija.mainImageUrl || 'placeholder.jpg';
    const kuhinja = restavracija.cuisine && restavracija.cuisine.length > 0 ? restavracija.cuisine[0] : 'Razno';
    const lokacija = restavracija.location && restavracija.location.city ? restavracija.location.city : 'Neznana lokacija';
    const ocena_povprecje = restavracija.ocena_povprecje || 0;
    // Predpostavimo, da je slovenski opis pod description.sl
    const opis = restavracija.description && restavracija.description.sl ? restavracija.description.sl : 'Opis ni na voljo.';
    // Predpostavimo, da je ponudba pod specialOffer.sl
    const aktualna_ponudba = restavracija.specialOffer && restavracija.specialOffer.sl ? restavracija.specialOffer.sl : null;
    // Predpostavimo, da so slike galerije pod galleryImageUrls (array)
    const galerija = restavracija.galleryImageUrls || [];
    // Predpostavimo, da so koordinate pod location.coordinates (string 'lat,lng' ali podobno)
    const gps_lokacija = restavracija.location && restavracija.location.coordinates ? restavracija.location.coordinates : null;
    // Predpostavimo, da je meni pod menuItems (array)
    const meni = restavracija.menuItems || [];


    currentRestaurantId = id;

    // Dodamo ID restavracije v skrito polje (za rezervacijo)
    const reservIdField = document.querySelector('[data-reserv-id]');
    if (reservIdField) reservIdField.value = id;

    // 2. Polnjenje Glavnih podrobnosti
    modalSlika.style.backgroundImage = `url(${slika})`;
    modalIme.textContent = ime;
    modalKuhinja.innerHTML = `<i class="fas fa-utensils"></i> ${kuhinja}`;
    modalLokacija.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${lokacija}`;
    modalOcena.innerHTML = `<i class="fas fa-circle"></i> ${ocena_povprecje.toFixed(1)}`;
    modalOpis.textContent = opis;

    // 3. Generiranje Menija (Zavihek Meni)
    modalMeni.innerHTML = '';
    if (meni.length > 0) {
        meni.forEach(item => {
            // Predpostavimo, da so menuItems objekti z j (jed) in p (cena)
            const li = document.createElement('li');
            li.innerHTML = `<strong>${item.j || item.name}</strong> <span>${item.p || item.price}</span>`;
            modalMeni.appendChild(li);
        });
    } else {
        modalMeni.innerHTML = '<li class="text-gray-500"><span data-i18n="modal.no_menu">Meni še ni na voljo.</span></li>';
    }

    // 4. Polnjenje zavihka Aktualna Ponudba
    if (aktualna_ponudba) {
        modalAktualnaPonudbaOpis.textContent = aktualna_ponudba;
        modalAktualnaPonudbaOpis.style.fontStyle = 'normal';
    } else {
        // Predpostavimo, da i18next obstaja in vsebuje ustrezne prevode
        modalAktualnaPonudbaOpis.textContent = window.i18next ? i18next.t('modal.special_offer_default') : 'Trenutno ni posebne ponudbe.';
        modalAktualnaPonudbaOpis.style.fontStyle = 'italic';
    }

    // 5. Generiranje Galerije
    galerijaSlikeDiv.innerHTML = '';
    if (galerija.length > 0) {
        galerija.forEach(galerijskaSlikaUrl => {
            const img = document.createElement('img');
            img.src = galerijskaSlikaUrl;
            img.alt = ime;
            galerijaSlikeDiv.appendChild(img);
        });
    } else {
        galerijaSlikeDiv.innerHTML = '<p class="text-gray-500">Ni dodatnih slik za prikaz.</p>';
    }

    // 6. Vdelan Zemljevid (Google Maps Embed API)
    if (gps_lokacija) {
        // Predpostavljamo format 'latitude, longitude' (npr. '46.056946, 14.505751')
        const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(ime + ', ' + lokacija)}&hl=sl&z=14&t=m&output=embed`;
        modalZemljevid.src = mapUrl;
    } else {
        modalZemljevid.src = 'about:blank';
    }

    // 7. Resetiraj prikaz prostih ur
    const prosteUreDiv = document.getElementById('prosteUreRezultati');
    if (prosteUreDiv) {
        prosteUreDiv.innerHTML = window.i18next ? i18next.t('messages.check_availability_prompt') : 'Proste ure se bodo prikazale, ko kliknete Rezerviraj mizo.';
    }
    // globalSelectedTime = null; // Ponastavimo izbrano uro (predpostavimo, da je globalno definirana)

    // 8. Resetiraj na prvi zavihek (Meni) ob odpiranju
    const meniTab = document.querySelector('.modal-tab[data-tab="meni"]');
    if (meniTab) meniTab.click();

    // 9. Odpri modal
    restavracijaModal.classList.add('active');

    // 10. Posodobi prevode znotraj modala (predpostavljamo, da obstaja `updateContent`)
    if (typeof updateContent === 'function') updateContent();
}

// Funkcija, ki naj bi se sprožila ob kliku na gumb (ali kartico)
function poglejDetajle(restavracijaId) {
    // Poišči restavracijo v dinamično naloženem seznamu
    const restavracija = allRestavracije.find(r => r._id === restavracijaId);

    if (restavracija) {
        prikaziPodrobnosti(restavracija);
    } else {
        console.error("Restavracija ni najdena v dinamičnem seznamu (ID: " + restavracijaId + ")!");
    }
}

// Renderiranje Ene Kartice (ZA GLAVNO MREŽO - PRILAGOJENO API STRUKTURI)
function renderCard(restavracija) {
    const card = document.createElement('div');
    card.className = 'kartica restavracija-kartica';
    card.setAttribute('data-id', restavracija._id);

    const ocena_povprecje = restavracija.ocena_povprecje || 0;
    const ratingDisplay = `${generateStarsHTML(ocena_povprecje)} <span class="ocena-stevilka">(${ocena_povprecje.toFixed(1)})</span>`;

    // Generiranje naključne oddaljenosti med 1.0 km in 15.0 km
    const oddaljenostKm = (Math.random() * 14 + 1).toFixed(1);

    // Pridobivanje statusa (predpostavljamo API strukturo)
    const status = restavracija.availability && restavracija.availability.status;
    const cas = restavracija.availability && restavracija.availability.time;

    let razpolozljivostTextKey;
    let isAvailable = true;

    // Predpostavljamo, da i18next obstaja
    if (status === 'available') {
        razpolozljivostTextKey = window.i18next ? i18next.t('results.available_today', { time: cas }) : `Danes ob ${cas}`;
    } else if (status === 'tomorrow') {
        razpolozljivostTextKey = window.i18next ? i18next.t('results.available_tomorrow', { time: cas }) : `Jutri ob ${cas}`;
    } else {
        razpolozljivostTextKey = window.i18next ? i18next.t('results.unavailable') : 'Ni prosto';
        isAvailable = false;
    }

    const razpolozljivostHTML = `
        <div class="razpolozljivost-ovoj ${!isAvailable ? 'zasedeno' : ''}">
            <p data-i18n-key="status_text">${razpolozljivostTextKey}</p>
        </div>
    `;

    card.innerHTML = `
        <img src="${restavracija.mainImageUrl || 'placeholder.jpg'}" alt="${restavracija.ime}" class="kartica-slika">
        <div class="kartica-vsebina">
            <h3>${restavracija.ime}</h3>
            <div class="info-ocena-oddaljenost">
                <p class="ocena">${ratingDisplay}</p>
                <span class="oddaljenost"><i class="fas fa-location-arrow"></i> ${oddaljenostKm} km</span>
            </div>
            ${razpolozljivostHTML}
            <button onclick="poglejDetajle('${restavracija._id}')" class="gumb-detajli">Poglej detajle</button>
        </div>
    `;

    // Listener za celotno kartico
    card.addEventListener('click', (e) => {
        if (e.target.classList.contains('gumb-detajli')) {
            return;
        }
        poglejDetajle(restavracija._id);
    });

    return card;
}

// Renderiranje Ene Kartice (ZA IZPOSTAVLJENO - POENOSTAVLJENA KARTICA)
function renderFeaturedCard(restavracija) {
    const card = document.createElement('div');
    card.className = 'kartica kartica-izpostavljeno';
    card.setAttribute('data-id', restavracija._id);

    // Listener za celotno kartico
    card.addEventListener('click', () => poglejDetajle(restavracija._id));

    card.innerHTML = `
        <div class="slika-kartice" style="background-image: url('${restavracija.mainImageUrl || 'placeholder.jpg'}')"></div>
        <div class="vsebina-kartice-izpostavljeno">
            <h3>${restavracija.ime}</h3>
        </div>
    `;

    return card;
}


// Filtriranje in Prikaz GLAVNE MREŽE (PRILJUBLJENO)
function filterAndRenderRestavracije() {
    const filtered = allRestavracije.filter(r => {
        if (currentFilterKuhinja === '') return true;
        // Preverimo, ali API seznam kuhinj vsebuje izbrano kuhinjo
        return r.cuisine && r.cuisine.includes(currentFilterKuhinja);
    });

    if (mrezaKarticDiv) mrezaKarticDiv.innerHTML = '';
    if (statusKarticeDiv) statusKarticeDiv.textContent = '';

    if (filtered.length === 0) {
        if (statusKarticeDiv) statusKarticeDiv.textContent = window.i18next ? i18next.t('messages.no_restaurants_found') : 'Ni restavracij, ki ustrezajo kriterijem.';
        return;
    }

    filtered.forEach(restavracija => {
        if (mrezaKarticDiv) mrezaKarticDiv.appendChild(renderCard(restavracija));
    });

    // Posodobimo prevode statusov v karticah po renderju
    if (typeof updateContent === 'function') updateContent();
}


// Prikaz Izpostavljenih Restavracij (Uporabimo prve 3 kot featured)
function renderFeaturedRestavracije() {
    const featuredList = allRestavracije.slice(0, 3); // Izberemo prve tri

    if (mrezaIzpostavljenoKarticDiv) mrezaIzpostavljenoKarticDiv.innerHTML = '';
    if (statusIzpostavljenoKarticeDiv) statusIzpostavljenoKarticeDiv.style.display = 'none';

    if (featuredList.length === 0) {
        if (mrezaIzpostavljenoKarticDiv) mrezaIzpostavljenoKarticDiv.innerHTML = '<div style="text-align: center; grid-column: 1 / -1; padding-top: 20px;">' + (window.i18next ? i18next.t('messages.no_restaurants_found') : 'Ni restavracij za prikaz.') + '</div>';
        return;
    }

    featuredList.forEach(restavracija => {
        if (mrezaIzpostavljenoKarticDiv) mrezaIzpostavljenoKarticDiv.appendChild(renderFeaturedCard(restavracija));
    });

    if (typeof updateContent === 'function') updateContent();
}

// Nastavitev Gumbov za Hitro Iskanje Listenerji (Predpostavljamo, da gumbi obstajajo v HTML-ju)
function setupKuhinjaFiltersListeners() {
    document.querySelectorAll('.gumb-kategorija').forEach(btn => {
        btn.removeEventListener('click', handleFilterClick); // Odstranimo stare
        btn.addEventListener('click', handleFilterClick);
    });
}

function handleFilterClick(e) {
    e.preventDefault();

    document.querySelectorAll('.gumb-kategorija').forEach(b => b.classList.remove('active'));

    const novaKuhinja = this.getAttribute('data-kuhinja'); // Uporaba `this` ali `e.currentTarget`
    if (currentFilterKuhinja === novaKuhinja) {
        currentFilterKuhinja = '';
    } else {
        this.classList.add('active');
        currentFilterKuhinja = novaKuhinja;
    }

    filterAndRenderRestavracije();
}


// ===============================================
// IV. NALAGANJE PODATKOV IN GLAVNI ZAGON
// ===============================================

async function naloziInPrikaziRestavracije() {
    console.log("Začenjam nalaganje restavracij iz API-ja...");

    if (statusKarticeDiv) statusKarticeDiv.textContent = window.i18next ? i18next.t('messages.searching', { criteria: '...' }) : 'Iščem...';
    if (statusIzpostavljenoKarticeDiv) statusIzpostavljenoKarticeDiv.textContent = window.i18next ? i18next.t('messages.searching', { criteria: '...' }) : 'Iščem...';

    // Prikaz nalaganja v glavni mreži
    if (mrezaKarticDiv) mrezaKarticDiv.innerHTML = '<p class="text-center w-full col-span-full">Nalagam restavracije...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/privzeto`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            let errorText;
            try {
                // Poskusimo prebrati telo odgovora kot JSON, če je na voljo
                const errorData = await response.json();
                errorText = errorData.message || JSON.stringify(errorData);
            } catch {
                // Če ni JSON, uporabimo le status
                errorText = response.statusText;
            }
            // 🚨 Izpišemo napako v konzolo za pomoč pri razhroščevanju
            console.error(`Napaka API klice: Status ${response.status}`, errorText);
            throw new Error(`API Napaka ${response.status}: ${errorText}`);
        }

        const restavracije = await response.json();

        // 🔥 KLJUČNO: Shranimo podatke v globalno spremenljivko
        allRestavracije = restavracije;

        console.log("Uspešno naložene restavracije:", allRestavracije.length);

        // Če ni restavracij, to prikažemo.
        if (allRestavracije.length === 0) {
            console.warn("API je vrnil prazen seznam restavracij.");
            if (statusKarticeDiv) statusKarticeDiv.textContent = window.i18next ? i18next.t('messages.no_restaurants_found') : 'Trenutno ni restavracij za prikaz.';
            if (mrezaKarticDiv) mrezaKarticDiv.innerHTML = '';
        }

        // 1. Nastavimo filtre
        setupKuhinjaFiltersListeners();

        // 2. Prikaz glavne mreže (filtrirano)
        filterAndRenderRestavracije();

        // 3. Prikaz izpostavljenih restavracij
        renderFeaturedRestavracije();

        // Skrijemo status nalaganja za izpostavljeno mrežo (če ni napake)
        if (statusIzpostavljenoKarticeDiv) statusIzpostavljenoKarticeDiv.style.display = 'none';

    } catch (error) {
        console.error("Kritična napaka pri Fetch klicu:", error);
        const errorMessage = window.i18next ? i18next.t('messages.search_error') : 'Napaka pri nalaganju restavracij. Preverite konzolo za podrobnosti.';

        // Prikažemo specifično sporočilo na spletni strani
        if (mrezaKarticDiv) mrezaKarticDiv.innerHTML = `<p style="color: red; text-align: center; width: 100%; padding: 20px;">NAPAKA: ${error.message}</p>`;
        if (statusKarticeDiv) statusKarticeDiv.textContent = errorMessage;
        if (statusIzpostavljenoKarticeDiv) statusIzpostavljenoKarticeDiv.textContent = errorMessage;
        if (statusIzpostavljenoKarticeDiv) statusIzpostavljenoKarticeDiv.style.display = 'block';
    }
}


// ===============================================
// V. LOGIKA MODALNEGA OPOZORILA
// ===============================================

function preveriInPrikaziOpozorilo() {
    const modal = document.getElementById('warningModal');
    const closeModalBtn = document.getElementById('closeModalBtn');

    if (modal && closeModalBtn) {
        if (localStorage.getItem(WARNING_KEY) !== 'true') {

            // PRIKAŽITE MODAL
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
// VI. ZAGON APLIKACIJE
// ===============================================

// Zaženemo nalaganje in preverjanje Modala, ko je stran naložena
document.addEventListener('DOMContentLoaded', () => {
    naloziInPrikaziRestavracije();
    preveriInPrikaziOpozorilo();
});