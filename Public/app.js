// ===============================================
// 🚀 Public/app.js - Združitev nalaganja API podatkov, prikaza, filtrov in modalne logike
// ===============================================

// Definirajte bazni URL za vaš API
// API_BASE_URL: https://rentyo-gourmet-spletna-stran.onrender.com/api/restavracije
const API_BASE_URL = 'https://rentyo-gourmet-spletna-stran.onrender.com/api/restavracije';

// 🔥 NOVO: Bazni URL za Avtentikacijo (Potrebno za ponastavitev gesla)
// Predpostavljamo, da je vaš Auth API na isti osnovni domeni, le s potjo /api/auth
const AUTH_API_URL = 'https://rentyo-gourmet-spletna-stran.onrender.com/api/auth';


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
const modalSlika = document.getElementById('modalSlika'); // To je verjetno div/element z background-image
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

// 🔥 Element za zavihek Ocene
const tabOcene = document.getElementById('tabOcene');

// Elementi za Formular Iskanja (Predpostavimo, da obstaja FORM z ID="search-form")
const searchForm = document.getElementById('search-form');
const mestoInput = document.getElementById('mesto');
const datumInput = document.getElementById('datum');
const casInput = document.getElementById('cas');
const steviloOsebInput = document.getElementById('stevilo_oseb');
const kuhinjaInput = document.getElementById('kuhinja');

// 🔥 NOVO: Elementi za Formular Ponastavitve Gesla
// Predpostavimo, da imate v HTML-ju formular/vmesnik z naslednjimi ID-ji:
const resetPasswordForm = document.getElementById('reset-password-form');
const resetEmailInput = document.getElementById('reset-email');
const otpCodeInput = document.getElementById('otp-code'); // Vnos PIN kode
const newPasswordInput = document.getElementById('new-password');
const resetSubmitButton = document.getElementById('reset-submit-button'); // Gumb za ponastavitev
const resetMessageDiv = document.getElementById('reset-message'); // Prostor za sporočila o uspehu/napaki
const otpContainer = document.getElementById('otp-container'); // Ovoj za PIN in Novo geslo
const emailContainer = document.getElementById('email-container'); // Ovoj za Email vnos


// ===============================================
// II. POMOŽNE FUNKCIJE
// ===============================================

// Pomožna funkcija za zvezdice
function generateStarsHTML(rating) {
    const fullStar = '★';
    const maxStars = 5;
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

// 🔥 NOVO: Pomožna funkcija za formatiranje datuma
function formatDatum(datumNiz) {
    try {
        const datum = new Date(datumNiz);
        return datum.toLocaleDateString('sl-SI', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch {
        return 'Neznan datum';
    }
}
// -------------------------------------------------------------

// 🔥 LOGIKA PRIKAZA OCEN
function renderReviews(reviews) {
    if (!tabOcene) return; 

    tabOcene.innerHTML = ''; // Počisti prejšnje ocene
    
    if (!reviews || reviews.length === 0) {
        const noReviewsText = window.i18next ? i18next.t('modal.no_reviews') : 'Ta restavracija še nima ocen.';
        tabOcene.innerHTML = `<p class="p-4 text-center text-gray-500" data-i18n="modal.no_reviews">${noReviewsText}</p>`;
        if (typeof updateContent === 'function') updateContent();
        return;
    }
    
    reviews.forEach((review, index) => {
        const reviewElement = document.createElement('div');
        
        reviewElement.className = 'review-card pb-4'; 
        
        if (index < reviews.length - 1) {
            reviewElement.classList.add('review-separator', 'mb-4'); 
        } else {
            reviewElement.classList.add('mb-4');
        }
        
        const validOcena = typeof review.ocena === 'number' ? review.ocena : 0;
        const ratingHtml = generateStarsHTML(validOcena);
        
        // Uporabljamo ključ 'uporabniskoIme' iz API mappinga (mapiraniKomentarji)
        const ime = review.ime || (window.i18next ? i18next.t('modal.anonymous_user') : 'Neznan Uporabnik');

        // Robustna obravnava datuma
        let datumPrikaz;
        try {
            datumPrikaz = new Date(review.datum).toLocaleDateString('sl-SI', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (e) {
            datumPrikaz = 'Neznan datum';
        }
        
        reviewElement.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <strong class="text-lg">${ime}</strong>
                <span class="text-sm text-gray-500">${datumPrikaz}</span>
            </div>
            <div class="flex items-center mb-2">
                <span class="star-rating mr-2">${ratingHtml}</span>
                <span class="text-sm font-semibold text-gray-700">(${validOcena.toFixed(1)})</span>
            </div>
            <p class="review-text text-gray-800">${review.komentar || (window.i18next ? i18next.t('modal.no_comment_provided') : '')}</p>
        `;
        
        tabOcene.appendChild(reviewElement);
    });
    
    if (typeof updateContent === 'function') updateContent();
}
// -------------------------------------------------------------

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
    
    const ime = restavracija.ime || restavracija.name || restavracija.title || 'Neznano Ime'; 
    
    let slikaUrlZaModal = 'placeholder.jpg';
    if (restavracija.galerija_slik && restavracija.galerija_slik.length > 0) {
        slikaUrlZaModal = restavracija.galerija_slik[0]; // Vzemi prvo sliko iz galerije
    } else if (restavracija.urlSlike) {
         slikaUrlZaModal = restavracija.urlSlike;
    } else if (restavracija.mainImageUrl) {
         slikaUrlZaModal = restavracija.mainImageUrl;
    }
    
    const kuhinja = restavracija.cuisine && restavracija.cuisine.length > 0 ? restavracija.cuisine[0] : 'Razno';
    const lokacija = (restavracija.lokacija && restavracija.lokacija.mesto) || (restavracija.location && restavracija.location.city) || 'Neznana lokacija';
    const ocena_povprecje = restavracija.ocena_povprecje || 0;
    const opis = restavracija.description && restavracija.description.sl ? restavracija.description.sl : 'Opis ni na voljo.';
    const aktualna_ponudba = restavracija.specialOffer && restavracija.specialOffer.sl ? restavracija.specialOffer.sl : null;
    const galerija = restavracija.galerija_slik || [];
    
    const gps_lokacija = (restavracija.lokacija && restavracija.lokacija.coordinates) || (restavracija.location && restavracija.location.coordinates) || null;
    
    const meni = restavracija.menuItems || [];
    
    const komentarji = restavracija.komentarji || [];


    currentRestaurantId = id;

    // Dodamo ID restavracije v skrito polje (za rezervacijo)
    const reservIdField = document.querySelector('[data-reserv-id]');
    if (reservIdField) reservIdField.value = id;

    // 2. Polnjenje Glavnih podrobnosti
    modalSlika.style.backgroundImage = `url(${slikaUrlZaModal})`;
    modalIme.textContent = ime;
    modalKuhinja.innerHTML = `<i class="fas fa-utensils"></i> ${kuhinja}`;
    modalLokacija.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${lokacija}`;
    modalOcena.innerHTML = `<i class="fas fa-circle"></i> ${ocena_povprecje.toFixed(1)}`;
    modalOpis.textContent = opis;

    // 3. Generiranje Menija (Zavihek Meni)
    modalMeni.innerHTML = '';
    if (meni.length > 0) {
        meni.forEach(item => {
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
    
    // 6. Generiranje Komentarjev in Ocen (Zavihek Ocene)
    if (tabOcene) {
        // console.log("Prejeti komentarji iz API-ja (komentarji):", komentarji); 

        const mapiraniKomentarji = komentarji.map(komentar => ({
            ocena: komentar.ocena || komentar.rating || 0,
            komentar: komentar.komentar || komentar.comment || '',
            datum: komentar.datum || komentar.date,
            // Uporabimo ime iz komentarja, če obstaja (ki je izvedeno iz uporabnika v authControllerju)
            ime: komentar.uporabniskoIme || komentar.ime, 
        }));
        
        // console.log("Mapirani komentarji (poslani v renderReviews):", mapiraniKomentarji);

        renderReviews(mapiraniKomentarji);
    }
    // -------------------------------------------------------------

    // 7. Vdelan Zemljevid (Google Maps Embed API)
    if (gps_lokacija) {
        const lat = gps_lokacija[1];
        const lon = gps_lokacija[0];
        
        // Uporabljamo standardni Google Maps Embed API format, s popravljenim URL-jem.
        const mapUrl = `https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(lat)},${encodeURIComponent(lon)}&key=YOUR_GOOGLE_MAPS_API_KEY&zoom=14`;
        
        modalZemljevid.src = mapUrl;
    } else {
        modalZemljevid.src = 'about:blank';
    }

    // 8. Resetiraj prikaz prostih ur
    const prosteUreDiv = document.getElementById('prosteUreRezultati');
    if (prosteUreDiv) {
        prosteUreDiv.innerHTML = window.i18next ? i18next.t('messages.check_availability_prompt') : 'Proste ure se bodo prikazale, ko kliknete Rezerviraj mizo.';
    }

    // 9. Resetiraj na prvi zavihek (Meni) ob odpiranju
    const meniTab = document.querySelector('.modal-tab[data-tab="meni"]');
    if (meniTab) meniTab.click();

    // 10. Odpri modal
    restavracijaModal.classList.add('active');

    // 11. Posodobi prevode znotraj modala (predpostavljamo, da obstaja `updateContent`)
    if (typeof updateContent === 'function') updateContent();
}

// Funkcija, ki naj bi se sprožila ob kliku na gumb (ali kartico)
function poglejDetajle(restavracijaId) {
    const restavracija = allRestavracije.find(r => r._id === restavracijaId);

    if (restavracija) {
        prikaziPodrobnosti(restavracija);
    } else {
        console.error("Restavracija ni najdena v dinamičnem seznamu (ID: " + restavracijaId + ")!");
    }
}

// Renderiranje Ene Kartice (ZA GLAVNO MREŽO)
function renderCard(restavracija) {
    const card = document.createElement('div');
    card.className = 'kartica restavracija-kartica';
    card.setAttribute('data-id', restavracija._id);

    const imeRestavracije = restavracija.ime || restavracija.name || restavracija.title || 'Neznano Ime';
    
    let slikaUrl;
    if (restavracija.galerija_slik && restavracija.galerija_slik.length > 0) {
        slikaUrl = restavracija.galerija_slik[0];
    } else {
        slikaUrl = restavracija.urlSlike || restavracija.mainImageUrl || 'https://via.placeholder.com/300x200?text=Slika+ni+na+voljo';
    }
    
    const ocena_povprecje = restavracija.ocena_povprecje || 0;
    const ratingDisplay = `${generateStarsHTML(ocena_povprecje)} <span class="ocena-stevilka">(${ocena_povprecje.toFixed(1)})</span>`;

    const oddaljenostKm = (Math.random() * 14 + 1).toFixed(1);

    const status = restavracija.availability && restavracija.availability.status;
    const cas = restavracija.availability && restavracija.availability.time;

    let razpolozljivostTextKey;
    let isAvailable = true;

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
        <img src="${slikaUrl}" alt="${imeRestavracije}" class="kartica-slika">
        <div class="kartica-vsebina">
            <h3>${imeRestavracije}</h3>
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

// Renderiranje Ene Kartice (ZA IZPOSTAVLJENO)
function renderFeaturedCard(restavracija) {
    const card = document.createElement('div');
    card.className = 'kartica kartica-izpostavljeno';
    card.setAttribute('data-id', restavracija._id);

    const imeRestavracije = restavracija.ime || restavracija.name || restavracija.title || 'Neznano Ime';
    
    let slikaUrl;
    if (restavracija.galerija_slik && restavracija.galerija_slik.length > 0) {
        slikaUrl = restavracija.galerija_slik[0];
    } else {
        slikaUrl = restavracija.urlSlike || restavracija.mainImageUrl || 'https://via.placeholder.com/300x200?text=Slika+ni+na+voljo';
    }
    
    // Listener za celotno kartico
    card.addEventListener('click', () => poglejDetajle(restavracija._id));

    card.innerHTML = `
        <div class="slika-kartice" style="background-image: url('${slikaUrl}')"></div>
        <div class="vsebina-kartice-izpostavljeno">
            <h3>${imeRestavracije}</h3>
        </div>
    `;

    return card;
}


// Filtriranje in Prikaz GLAVNE MREŽE (PRILJUBLJENO)
function filterAndRenderRestavracije() {
    const filtered = allRestavracije.filter(r => {
        if (currentFilterKuhinja === '') return true;
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

    if (typeof updateContent === 'function') updateContent();
}


// Prikaz Izpostavljenih Restavracij (Uporabimo prve 3 kot featured)
function renderFeaturedRestavracije() {
    const featuredList = allRestavracije.filter(r => !!r.featured || !!r.izpostavljeno);

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

    const novaKuhinja = this.getAttribute('data-kuhinja');
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
    console.log("Začenjam nalaganje restavracij iz API-ja (/privzeto)...");

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
                const errorData = await response.json();
                errorText = errorData.message || JSON.stringify(errorData);
            } catch {
                errorText = response.statusText;
            }
            console.error(`Napaka API klice /privzeto: Status ${response.status}`, errorText);
            throw new Error(`API Napaka ${response.status}: ${errorText}`);
        }

        const restavracije = await response.json(); 

        allRestavracije = restavracije;

        console.log("Uspešno naložene restavracije:", allRestavracije.length);

        if (allRestavracije.length === 0) {
            console.warn("API je vrnil prazen seznam restavracij.");
            if (statusKarticeDiv) statusKarticeDiv.textContent = window.i18next ? i18next.t('messages.no_restaurants_found') : 'Trenutno ni restavracij za prikaz.';
            if (mrezaKarticDiv) mrezaKarticDiv.innerHTML = '';
        }

        setupKuhinjaFiltersListeners();
        filterAndRenderRestavracije();
        renderFeaturedRestavracije();

        if (statusIzpostavljenoKarticeDiv) statusIzpostavljenoKarticeDiv.style.display = 'none';

    } catch (error) {
        console.error("Kritična napaka pri Fetch klicu /privzeto:", error);
        const errorMessage = window.i18next ? i18next.t('messages.search_error') : 'Napaka pri nalaganju restavracij. Preverite konzolo za podrobnosti.';

        if (mrezaKarticDiv) mrezaKarticDiv.innerHTML = `<p style="color: red; text-align: center; width: 100%; padding: 20px;">NAPAKA: ${error.message}</p>`;
        if (statusKarticeDiv) statusKarticeDiv.textContent = errorMessage;
        if (statusIzpostavljenoKarticeDiv) statusIzpostavljenoKarticeDiv.textContent = errorMessage;
        if (statusIzpostavljenoKarticeDiv) statusIzpostavljenoKarticeDiv.style.display = 'block';
    }
}

// ===============================================
// V. FUNKCIJA ZA ISKANJE
// ===============================================

async function obdelajIskanje(searchData) {
    console.log("Začenjam iskanje restavracij z API-jem (/isci)...");

    if (statusKarticeDiv) statusKarticeDiv.textContent = window.i18next ? i18next.t('messages.searching', { criteria: searchData.mesto || '' }) : `Iščem ${searchData.mesto}...`;
    if (mrezaKarticDiv) mrezaKarticDiv.innerHTML = '<p class="text-center w-full col-span-full">Iščem restavracije...</p>';
    if (mrezaIzpostavljenoKarticDiv) mrezaIzpostavljenoKarticDiv.innerHTML = ''; 

    try {
        const response = await fetch(`${API_BASE_URL}/isci`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchData)
        });

        if (!response.ok) {
            let errorText;
            try {
                const errorData = await response.json();
                errorText = errorData.msg || errorData.message || JSON.stringify(errorData);
            } catch {
                errorText = response.statusText;
            }
            console.error(`Napaka API klice /isci: Status ${response.status}`, errorText);
            throw new Error(`API Napaka ${response.status}: ${errorText}`);
        }

        const rawResult = await response.json();
        
        let rezultati;
        if (Array.isArray(rawResult)) {
            rezultati = rawResult;
        } else if (rawResult && typeof rawResult === 'object') {
            rezultati = [rawResult];
        } else {
            rezultati = [];
        }

        allRestavracije = rezultati;
        currentFilterKuhinja = '';

        console.log("Uspešno iskanje. Najdeno restavracij:", allRestavracije.length);

        filterAndRenderRestavracije();
        
        if (allRestavracije.length === 0) {
             if (statusKarticeDiv) statusKarticeDiv.textContent = window.i18next ? i18next.t('messages.no_restaurants_found') : 'Žal nismo našli restavracij, ki bi ustrezale vašim kriterijem.';
        } else {
            if (statusKarticeDiv) statusKarticeDiv.textContent = window.i18next ? i18next.t('messages.search_results_found', { count: allRestavracije.length }) : `Najdeno ${allRestavracije.length} restavracij.`;
        }


    } catch (error) {
        console.error("Kritična napaka pri Fetch klicu /isci:", error);
        if (mrezaKarticDiv) mrezaKarticDiv.innerHTML = `<p style="color: red; text-align: center; width: 100%; padding: 20px;">NAPAKA PRI ISKANJU: ${error.message}</p>`;
        if (statusKarticeDiv) statusKarticeDiv.textContent = window.i18next ? i18next.t('messages.search_error') : 'Napaka pri iskanju restavracij.';
    }
}


// ===============================================
// VI. LOGIKA MODALNEGA OPOZORILA
// ===============================================

function preveriInPrikaziOpozorilo() {
    const modal = document.getElementById('warningModal');
    const closeModalBtn = document.getElementById('closeModalBtn');

    if (modal && closeModalBtn) {
        if (localStorage.getItem(WARNING_KEY) !== 'true') {

            modal.style.display = 'block';

            closeModalBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                localStorage.setItem(WARNING_KEY, 'true');
            });
        }
    }
}

// ===============================================
// VII. ZAGON APLIKACIJE IN LISTENERJI
// ===============================================

// Zaženemo nalaganje in preverjanje Modala, ko je stran naložena
document.addEventListener('DOMContentLoaded', () => {
    naloziInPrikaziRestavracije();
    preveriInPrikaziOpozorilo();
    
    // Listener za Formular Iskanja (Če Formular Obstaja)
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            
            const searchData = {
                mesto: mestoInput ? mestoInput.value.trim() : '',
                datum: datumInput ? datumInput.value.trim() : '',
                cas: casInput ? casInput.value.trim() : '',
                stevilo_oseb: steviloOsebInput ? parseInt(steviloOsebInput.value) : 1,
                kuhinja: kuhinjaInput ? kuhinjaInput.value.trim() : ''
            };
            
            obdelajIskanje(searchData);
        });
    }

    // 🔥 NOVO: Listener za Formular Ponastavitve Gesla (Glavna logika)
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Določimo, katero fazo izvajamo: 
            // 1. Zahteva za kodo (če je vidno samo polje za email)
            // 2. Ponastavitev (če so vidni PIN in Novo geslo)

            if (emailContainer && emailContainer.classList.contains('active') && resetEmailInput.value) {
                // Faza 1: Pošlji zahtevo za PIN kodo
                requestPasswordResetOtp(resetEmailInput.value.trim());
            } else if (otpContainer && otpContainer.classList.contains('active') && otpCodeInput.value && newPasswordInput.value) {
                // Faza 2: Ponastavi geslo s PIN kodo
                resetPasswordWithOtp(resetEmailInput.value.trim(), otpCodeInput.value.trim(), newPasswordInput.value);
            } else {
                displayResetMessage('Prosimo, vnesite vsa obvezna polja.', 'error');
            }
        });
    }

    // 🔥 NOVO: Začetni prikaz formularja (samo Email polje)
    if (emailContainer && otpContainer) {
        emailContainer.classList.add('active'); // Prikaži Email vnos
        otpContainer.classList.remove('active'); // Skrij vnos PIN in gesla
        if (resetSubmitButton) resetSubmitButton.textContent = 'Zahtevaj kodo';
    }
});


// ===============================================
// VIII. LOGIKA PONASTAVITVE GESLA (OTP) - KLIENT
// ===============================================

/**
 * Prikazuje sporočilo o uspehu ali napaki na uporabniškem vmesniku
 * @param {string} message 
 * @param {string} type 'success' ali 'error'
 */
function displayResetMessage(message, type) {
    if (resetMessageDiv) {
        resetMessageDiv.textContent = message;
        resetMessageDiv.className = `reset-message ${type === 'error' ? 'text-red-600' : 'text-green-600'}`;
        // Posodobimo prevode, če so na voljo (za prevode napak/uspeha)
        if (typeof updateContent === 'function') updateContent();
    }
}

/**
 * Faza 1: Pošlje zahtevo za PIN kodo na strežnik.
 * @param {string} email 
 */
async function requestPasswordResetOtp(email) {
    displayResetMessage('Pošiljam zahtevo za kodo...', 'info');
    if (resetSubmitButton) resetSubmitButton.disabled = true;

    try {
        const response = await fetch(`${AUTH_API_URL}/request-password-reset-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });

        const data = await response.json();
        
        if (response.ok) {
            // USPEH: Preklopimo na vnos kode
            displayResetMessage(data.message || 'Koda je bila uspešno poslana na vaš e-mail. Preverite pošto.', 'success');
            
            // Preklop prikaza:
            if (emailContainer) emailContainer.classList.remove('active');
            if (otpContainer) otpContainer.classList.add('active');
            if (resetSubmitButton) resetSubmitButton.textContent = 'Ponastavi geslo';
            
            // Email Input hranimo skrit, da ga lahko pošljemo v naslednjem koraku
            resetEmailInput.setAttribute('disabled', 'true'); 

        } else {
            // NAPAKA: Ostanemo na prvem koraku
            displayResetMessage(data.error || data.message || 'Napaka pri zahtevi za kodo. Poskusite znova.', 'error');
        }

    } catch (error) {
        console.error("Kritična napaka pri klicu OTP zahteve:", error);
        displayResetMessage('Prišlo je do kritične napake. Preverite konzolo.', 'error');
    } finally {
        if (resetSubmitButton) resetSubmitButton.disabled = false;
    }
}


/**
 * Faza 2: Potrdi PIN kodo in nastavi novo geslo.
 * @param {string} email 
 * @param {string} code 
 * @param {string} newPassword 
 */
async function resetPasswordWithOtp(email, code, newPassword) {
    displayResetMessage('Ponastavljam geslo...', 'info');
    if (resetSubmitButton) resetSubmitButton.disabled = true;

    // Hitro preverjanje dolžine gesla (minimalna varnost)
    if (newPassword.length < 8) {
        displayResetMessage('Novo geslo mora vsebovati vsaj 8 znakov.', 'error');
        if (resetSubmitButton) resetSubmitButton.disabled = false;
        return;
    }

    try {
        const response = await fetch(`${AUTH_API_URL}/reset-password-with-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: email, // Email pošljemo za iskanje uporabnika
                code: code, // PIN kodo pošljemo za preverjanje
                newPassword: newPassword 
            })
        });

        const data = await response.json();

        if (response.ok) {
            // KONČNI USPEH
            displayResetMessage(data.message || 'Geslo je bilo uspešno ponastavljeno. Sedaj se lahko prijavite.', 'success');
            
            // Počistimo formular in se vrnemo na Fazo 1 (Email vnos)
            if (otpCodeInput) otpCodeInput.value = '';
            if (newPasswordInput) newPasswordInput.value = '';
            
            if (emailContainer) {
                emailContainer.classList.add('active');
                resetEmailInput.removeAttribute('disabled');
                resetEmailInput.value = '';
            }
            if (otpContainer) otpContainer.classList.remove('active');
            if (resetSubmitButton) resetSubmitButton.textContent = 'Zahtevaj kodo';

        } else {
            // NAPAKA PRI PONASTAVITVI
            displayResetMessage(data.error || data.message || 'Napaka pri ponastavitvi gesla. Preverite kodo in poskusite znova.', 'error');
        }

    } catch (error) {
        console.error("Kritična napaka pri klicu ponastavitve gesla:", error);
        displayResetMessage('Prišlo je do kritične napake. Preverite konzolo.', 'error');
    } finally {
        if (resetSubmitButton) resetSubmitButton.disabled = false;
    }
}