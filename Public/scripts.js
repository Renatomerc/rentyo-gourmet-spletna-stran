// =================================================================
// 0. LOGIKA PREVAJANJA (i18n)
// =================================================================

/**
 * Prevede dinamično vstavljeno in statično vsebino na strani.
 */
const updateContent = () => {
    // 1. Prevede celotno stran z uporabo elementov z atributom data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');

        // Posebno ravnanje za placeholderje ([placeholder]search.key)
        if (key && key.startsWith('[placeholder]')) {
            const placeholderKey = key.replace('[placeholder]', '');
            el.placeholder = i18next.t(placeholderKey);
        } else if (key) {
            // Standardno prevajanje textContent
            el.textContent = i18next.t(key);
        }
    });

    // 2. Posebno ravnanje za opcije za število oseb (pluralizacija)
    const steviloOsebSelect = document.getElementById('stevilo_oseb');
    if (steviloOsebSelect) {
        const selectedValue = steviloOsebSelect.value;
        Array.from(steviloOsebSelect.options).forEach(option => {
            const count = parseInt(option.value);
            if (count > 0) {
                option.textContent = i18next.t('search.persons', { count: count });
            }
        });
        steviloOsebSelect.value = selectedValue;
    }

    // 3. Posodobimo tudi naslov strani
    const titleElement = document.querySelector('title');
    if (titleElement) {
        titleElement.textContent = i18next.t('app.title');
    }

    // 4. POSODOBIMO VSEBINO WARNING MODALA
    if (document.getElementById('warningModal') && typeof posodobiWarningModalVsebino === 'function') {
        posodobiWarningModalVsebino();
    }

    // 5. Posodobi naslov v Modalu Podrobnosti in gumb
    const rezervacijaGumb = document.getElementById('rezervacijaModalGumb');
    if (rezervacijaGumb) {
        rezervacijaGumb.textContent = i18next.t('modal.reserve_button');
    }

    const modalReservationTitle = document.getElementById('modalReservationTitle');
    if (modalReservationTitle) {
        modalReservationTitle.textContent = i18next.t('modal.reservation_title');
    }

    // 6. POSODOBITEV PIKADAY KOLEDARJA (ključno za prevod po menjavi jezika)
    // Klic initModalPicker() uniči staro instanco koledarja in ustvari novo 
    // z nastavitvami za trenutno izbrani jezik.
    if (typeof initModalPicker === 'function') {
        initModalPicker();
    }


    // -------------------------------------------------------------
    // 7. LOGIKA ZA DINAMIČNO PREPISOVANJE LINKOV (HREF)
    // -------------------------------------------------------------
    const currentLang = i18next.language || 'sl'; 
    
    document.querySelectorAll('[data-i18n-href]').forEach(el => {
        const key = el.getAttribute('data-i18n-href');
        const genericPath = i18next.t(key); 

        if (genericPath && genericPath !== key) {
            const dynamicPath = `/${currentLang}${genericPath.startsWith('/') ? genericPath : '/' + genericPath}`;
            el.setAttribute('href', dynamicPath);
        }
    });
}; // Konec funkcije updateContent

/**
 * Nastavi poslušalca za preklop jezika.
 */
const setupLanguageSwitcher = () => {
    const langSelect = document.querySelector('.izbira-jezika');
    if (langSelect) {
        langSelect.value = i18next.language;

        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            localStorage.setItem('lang', newLang);

            i18next.changeLanguage(newLang, (err, t) => {
                if (err) return console.error('Napaka pri menjavi jezika:', err);
                updateContent();
            });
        });
    }
};

/**
 * Inicializira i18next.
 */
const initI18n = (fallbackLang) => {
    i18next
        .use(i18nextHttpBackend) 
        .use(i18nextBrowserLanguageDetector)
        .init({
            detection: {
                order: [
                    'localStorage',
                    'navigator',
                    'querystring', 
                    'cookie',       
                    'htmlTag'
                ],
                lookupLocalStorage: 'lang', 
                caches: ['localStorage'] 
            },
            fallbackLng: fallbackLang, 
            ns: ['translation'],
            backend: {
                loadPath: './i18n/{{lng}}.json'
            },
            debug: false
        }, (err, t) => {
            if (err) return console.error('Napaka pri inicializaciji i18next:', err);
            
            const currentLang = i18next.language || fallbackLang;
            localStorage.setItem('lang', currentLang);

            updateContent();
            setupLanguageSwitcher();
            if (typeof prikaziWarningModal === 'function') {
                prikaziWarningModal();
            }
        });
};

// Zagon prevajanja
const fallbackLang = 'sl'; 
if (typeof i18next !== 'undefined' && typeof i18nextBrowserLanguageDetector !== 'undefined') {
    initI18n(fallbackLang);
} else {
    console.error('Potrebni knjižnici i18next in i18nextBrowserLanguageDetector nista naloženi!');
}


// -------------------------------------------------------------
// 1. GLOBALNA NASTAVITEV IN TOKEN
// -------------------------------------------------------------
const API_BASE_URL = 'https://rentyo-gourmet-spletna-stran.onrender.com/api'; 
const authTokenKey = 'jwtToken'; 

let currentRestaurantId = null;
let globalSelectedTime = null;
let globalSelectedMizaId = null;
let globalSelectedMizaIme = null;

const restavracijaModal = document.getElementById('restavracijaModal');
const durationModal = document.getElementById('durationModal');


/**
 * Pridobi glave z avtentikacijskim žetonom.
 */
const getAuthHeaders = () => {
    const token = localStorage.getItem(authTokenKey);
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

/**
 * Prikazuje sporočila uporabniku.
 */
const prikaziSporocilo = (msg, tip = 'info') => {
    let container = document.getElementById('sporocila-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'sporocila-container';
        container.className = 'fixed top-4 right-4 z-[1000] space-y-2';
        document.body.prepend(container);
    }

    let style = 'bg-blue-100 text-blue-800';
    if (tip === 'error') {
        style = 'bg-red-100 text-red-800';
    } else if (tip === 'success') {
        style = 'bg-green-100 text-green-800';
    }

    const msgElement = document.createElement('div');
    msgElement.className = `p-3 mb-3 text-sm rounded ${style} shadow-md transition-opacity duration-300 opacity-0`;
    msgElement.textContent = msg;
    container.appendChild(msgElement);
    
    // Fade in
    setTimeout(() => msgElement.classList.remove('opacity-0'), 10);

    setTimeout(() => {
        // Fade out
        msgElement.classList.add('opacity-0');
        // Remove after fade out
        msgElement.addEventListener('transitionend', () => msgElement.remove());
    }, 5000); 
};

/**
 * Pomožna funkcija za formatiranje datuma iz Flatpickr (DD. MM. YYYY) v YYYY-MM-DD.
 */
const formatirajDatumZaBackend = (datum) => {
    if (!datum) return '';
    const parts = datum.split('.').map(s => s.trim());
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return datum; 
};

/**
 * Pomožna funkcija za pretvorbo decimalne ure v HH:MM.
 */
const convertDecimalToTime = (decimalHour) => {
    // Zagotovimo, da je ura z zaokroženostjo na 5 minut (0.0833333 = 5/60)
    const nearestFiveMinutes = Math.round(decimalHour * 12) / 12; 
    const totalMinutes = Math.round(nearestFiveMinutes * 60); 
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    return `${formattedHours}:${formattedMinutes}`; 
};


// =================================================================
// 3. KRITIČNA FUNKCIJA HANDLEIZVEDBAREZERVACIJE
// =================================================================
async function handleIzvedbaRezervacije(podatki) {

    const url = `${API_BASE_URL}/restavracije/ustvari_rezervacijo`;

    try {
        prikaziSporocilo(i18next.t('messages.reserving', { cas: podatki.casStart, stevilo: podatki.stevilo_oseb }), 'info');

        const payload = {
            restavracijaId: podatki.restavracijaId,
            mizaId: podatki.mizaId,
            imeGosta: podatki.imeGosta,
            telefon: podatki.telefon,
            stevilo_oseb: parseInt(podatki.stevilo_oseb),
            datum: podatki.datum, 
            casStart: podatki.casStart, 
            trajanjeUr: podatki.trajanjeUr 
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            const casString = convertDecimalToTime(podatki.casStart);
            prikaziSporocilo(i18next.t('messages.reservation_success', { cas: casString }), 'success');
            if(restavracijaModal) restavracijaModal.classList.remove('active');
            if(typeof naloziPrivzeteRestavracije === 'function') naloziPrivzeteRestavracije();
        } else {
            prikaziSporocilo(data.msg || i18next.t('messages.reservation_failed'), 'error');
        }

    } catch (error) {
        console.error('Napaka pri API klicu za rezervacijo:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error_retry'), 'error');
    }
}


// =================================================================
// 4. LOGIKA MODALNEGA OKNA ZA DETALJNO RESTAVRACIJO
// =================================================================

/**
 * Nastavi poslušalce za zapiranje modala in inicializira preklop zavihkov.
 */
function setupRestavracijaModalClosure() {
    const gumbZapriRestavracija = document.getElementById('zapriRestavracijaModal');

    if (gumbZapriRestavracija && restavracijaModal) {
        gumbZapriRestavracija.addEventListener('click', () => {
            restavracijaModal.classList.remove('active');
        });
        window.addEventListener('click', (event) => {
            if (event.target === restavracijaModal) {
                restavracijaModal.classList.remove('active');
            }
        });
    }
}


/**
 * Nastavi poslušalce za preklapljanje zavihkov znotraj detajlnega modala.
 */
function setupRestavracijaTabs() {
    const tabs = document.querySelectorAll('.restavracija-vsebina .modal-tab');
    
    tabs.forEach(tab => {
        tab.removeEventListener('click', handleTabClick); 
        tab.addEventListener('click', handleTabClick);
    });
}

/**
 * Funkcija za obravnavo klika na zavihek.
 */
function handleTabClick(e) {
    const targetElement = e.target.closest('.modal-tab');
    if (!targetElement) return;

    const targetId = targetElement.dataset.tab;
    
    const container = document.getElementById('restavracijaModal');
    if (!container) return;

    const tabs = container.querySelectorAll('.modal-tab');
    const contents = container.querySelectorAll('.modal-vsebina-skrol .tab-content');

    // Odstranimo active z vseh
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    // Aktivivamo tarčni zavihek in vsebino
    targetElement.classList.add('active'); 
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    // Če je Rezervacija, ponovno nastavimo poslušalce in preverimo pogoje
    if (targetId === 'tabRezervacija') {
        setupReservationFormListeners();
    }
}

/**
 * Pripne poslušalce na polja za rezervacijo v modalu (za samodejno preverjanje razpoložljivosti).
 */
function setupReservationFormListeners() {
    const tabRezervacija = document.getElementById('tabRezervacija');
    if (!tabRezervacija) return;

    const restavracijaIdInput = tabRezervacija.querySelector('[data-reserv-id]');
    const datumInput = tabRezervacija.querySelector('[data-reserv-datum]');
    const osebeInput = tabRezervacija.querySelector('[data-reserv-osebe]');
    const gumbPreveri = document.getElementById('rezervacijaModalGumb');
    
    // Poslušalec za gumb (če uporabnik ročno pritisne)
    if (gumbPreveri) {
        gumbPreveri.onclick = null; 
        gumbPreveri.onclick = (e) => {
            e.preventDefault();
            const datumFormated = formatirajDatumZaBackend(datumInput.value);

            if (datumFormated && restavracijaIdInput.value && osebeInput.value) {
                preveriProsteUre({
                    restavracijaId: restavracijaIdInput.value,
                    datum: datumFormated,
                    stevilo_oseb: parseInt(osebeInput.value)
                });
            } else {
                 prikaziSporocilo(i18next.t('messages.required_reservation_fields'), 'error');
            }
        };
    }
    
    // Dodatni poslušalci za spremembo polj, ki sprožijo samodejno preverjanje
    const autoCheck = () => {
        const datumFormated = formatirajDatumZaBackend(datumInput.value);
        if (datumFormated && restavracijaIdInput.value && osebeInput.value) {
            preveriProsteUre({
                restavracijaId: restavracijaIdInput.value,
                datum: datumFormated,
                stevilo_oseb: parseInt(osebeInput.value)
            });
        }
    };
    
    // Za preprečitev dvojnega vezanja poslušalcev:
    datumInput.removeEventListener('change', autoCheck);
    osebeInput.removeEventListener('change', autoCheck);
    
    datumInput.addEventListener('change', autoCheck);
    osebeInput.addEventListener('change', autoCheck);
}


/**
 * Pridobi ID iz kartice, pokliče API in odpre modal s podatki.
 */
async function handleOdpriModalPodrobnosti(e) {
    // Ignoriramo klike, če je cilj gumb za rezervacijo (da preprečimo odpiranje modala)
    if (e.target.closest('[data-rezervacija-gumb]')) {
        return;
    }

    const kartica = e.currentTarget;
    const restavracijaId = kartica.dataset.restavracijaId;

    if (!restavracijaId) return;
    
    currentRestaurantId = restavracijaId;

    try {
        prikaziSporocilo(i18next.t('messages.loading_details'), 'info');

        const url = `${API_BASE_URL}/restavracije/${restavracijaId}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            prikaziModalPodrobnosti(data);
            restavracijaModal.classList.add('active');
            prikaziSporocilo('');
            
            setupRestavracijaTabs();
            
            // KRITIČEN POPRAVEK: Eksplicitno aktiviraj zavihek "Opis"
            const opisTab = document.querySelector('.modal-tab[data-tab="tabOpis"]');
            if (opisTab) {
                // Manually trigger the handler function using the target element
                handleTabClick({ target: opisTab });
            }


        } else {
            prikaziSporocilo(data.msg || i18next.t('messages.search_error'), 'error');
        }
    } catch (error) {
        console.error('Napaka pri pridobivanju detajlov restavracije:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error_retry'), 'error');
    }
}


/**
 * Vstavi podatke v HTML strukturo detajlnega modala.
 */
function prikaziModalPodrobnosti(restavracija) {
    if (!restavracijaModal) return;

    const currentLang = i18next.language;

    const prikazanoIme = restavracija.imeRestavracije || restavracija.ime || restavracija.naziv || i18next.t('messages.unknown_name');
    const opis = restavracija.description ? restavracija.description[currentLang] || restavracija.description.sl : i18next.t('results.na');
    
    // KRITIČEN POPRAVEK: Uporaba galerija_slik za modalno sliko
    const prvaSlika = restavracija.galerija_slik && restavracija.galerija_slik.length > 0 
        ? restavracija.galerija_slik[0] 
        : null; 
        
    const slikaUrl = prvaSlika || restavracija.mainImageUrl || 'https://via.placeholder.com/900x300/CCCCCC/808080?text=Slika+ni+na+voljo';
    
    const rating = restavracija.ocena_povprecje || 0;
    const cenovniRazred = '€'.repeat(restavracija.priceRange || 1);
    
    const googleRating = restavracija.googleRating || 0;
    const googleReviewCount = restavracija.googleReviewCount || 0;
    
    // 1. NAPOLNIMO STATIČNE ELEMENTE MODALA
    document.getElementById('modalSlika').style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.2)), url('${slikaUrl}')`;
    document.getElementById('modalIme').innerHTML = `${prikazanoIme} <span class="ocena-stevilka">(${cenovniRazred})</span>`; 
    
    document.getElementById('modalKuhinja').innerHTML = `<i class="fas fa-utensils"></i> ${restavracija.cuisine.join(', ')}`;
    document.getElementById('modalLokacija').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${restavracija.naslovPodjetja || i18next.t('messages.location_na')}`;
    
    let ocenaHtml = '';
    
    ocenaHtml += `<div class="internal-rating-detail">
        <i class="fas fa-circle"></i> 
        ${rating.toFixed(1)}/5 (${restavracija.st_ocen || 0} ${i18next.t('messages.reviews_internal')})
    </div>`;

    if (googleRating > 0) {
        ocenaHtml += `<div class="google-rating-detail">
            <i class="fab fa-google"></i> 
            ${googleRating.toFixed(1)}/5 (${googleReviewCount} ${i18next.t('messages.reviews_google')})
        </div>`;
    }
    
    document.getElementById('modalOcena').innerHTML = ocenaHtml;
    document.getElementById('modalOpis').textContent = opis;

    // 2. Napolnimo zavihek MENI 
    const tabMeni = document.getElementById('tabMeni');
    if(tabMeni) {
        tabMeni.innerHTML = ustvariMenijaHTML(restavracija.menu, currentLang);
    }

 // 3. Napolnimo zavihek GALERIJA
const tabGalerija = document.getElementById('tabGalerija');

if(tabGalerija) {
    // 🔥 POPRAVEK: Uporaba DEFAULT_LAT/DEFAULT_LON, če koordinate niso na voljo 🔥
    
    const hasCoordinates = restavracija.lokacija && 
                           restavracija.lokacija.coordinates && 
                           restavracija.lokacija.coordinates.length === 2;

    const lat = hasCoordinates 
        ? restavracija.lokacija.coordinates[1] 
        : DEFAULT_LAT; // Uporabi DEFAULT_LAT namesto null
        
    const lng = hasCoordinates 
        ? restavracija.lokacija.coordinates[0] 
        : DEFAULT_LON; // Uporabi DEFAULT_LON namesto null

    // V tem koraku ustvarjamo HTML za zavihek:
    tabGalerija.innerHTML = ustvariGalerijeHTML(restavracija.galleryUrls, lat, lng);
}
    
    // 4. Nastavimo zavihek Rezervacija (resetiramo proste ure)
    const tabRezervacija = document.getElementById('tabRezervacija');
    if (tabRezervacija) {
        const rezultatiContainer = document.getElementById('prosteUreRezultati');
        if (rezultatiContainer) {
            rezultatiContainer.innerHTML = `<p class="p-4 text-center text-gray-500">${i18next.t('messages.enter_date_and_persons')}</p>`;
        }
        
        const restavracijaIdInput = tabRezervacija.querySelector('[data-reserv-id]');
        if (restavracijaIdInput) {
            restavracijaIdInput.value = restavracija._id;
        }
        
    }
    
    updateContent();
}


/**
 * Generira HTML za meni restavracije (lokalizirano).
 */
function ustvariMenijaHTML(meniPodatki, lang) {
    if (!meniPodatki || !meniPodatki[lang] || Object.keys(meniPodatki[lang]).length === 0) {
        return `<p data-i18n="modal.no_menu" class="p-4 text-center text-gray-500">${i18next.t('modal.no_menu')}</p>`;
    }

    const menuLang = meniPodatki[lang];
    let html = '';

    for (const kategorija in menuLang) {
        if (menuLang.hasOwnProperty(kategorija)) {
            const prevedenaKategorija = i18next.t(`menu_categories.${kategorija}`, { defaultValue: kategorija.charAt(0).toUpperCase() + kategorija.slice(1) });

            html += `<h4 class="text-xl font-bold mt-6 mb-3 border-b pb-1 text-gray-700">${prevedenaKategorija}</h4><ul class="meni-seznam space-y-2">`;

            menuLang[kategorija].forEach(jed => {
                html += `
                    <li class="flex justify-between items-center text-gray-600">
                        <strong class="font-semibold">${jed.name}</strong>
                        <span class="font-mono text-lg text-indigo-600">${jed.price.toFixed(2)} €</span>
                    </li>
                `;
            });
            html += `</ul>`;
        }
    }

    return `<div class="meni-seznam">${html}</div>`;
}


/**
 * Generira HTML za galerijo in zemljevid.
 */
function ustvariGalerijeHTML(galerijaUrl, lat, lng) {
    let slikeHtml = `<h4 data-i18n="modal.gallery_title" class="text-xl font-bold mb-3 text-gray-700">${i18next.t('modal.gallery_title')}</h4>`;
    if (galerijaUrl && galerijaUrl.length > 0) {
        slikeHtml += `<div class="grid grid-cols-3 gap-2 mt-4">`;
        galerijaUrl.forEach(url => {
            slikeHtml += `<img src="${url}" alt="Galerija slika" class="w-full h-auto object-cover rounded-lg shadow-md cursor-pointer hover:opacity-80 transition duration-300">`;
        });
        slikeHtml += `</div>`;
    } else {
        slikeHtml += `<p class="p-4 text-center text-gray-500">${i18next.t('modal.no_gallery')}</p>`;
    }

    let zemljevidHtml = `<h4 data-i18n="modal.map_title" class="text-xl font-bold mb-3 mt-6 text-gray-700">${i18next.t('modal.map_title')}</h4>`;
    
    if (lat && lng) {
    // 🔥 NOVI, ČISTEJŠI GOOGLE EMBED URL:
    // Uporabljamo format q=lat,lng za čistejši zemljevid brez dodatnih kontrol
    const embedUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed`; 
    
    // URL za navigacijo ostane enak
    const navigacijskiURL = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`; 
    
    zemljevidHtml += `
        <a href="${navigacijskiURL}" target="_blank" class="block">
            <div class="zemljevid-ovoj rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition duration-300 cursor-pointer relative">
                <iframe
                    src="${embedUrl}" 
                    width="100%"
                    height="400"
                    style="border:0;"
                    allowfullscreen=""
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade">
                </iframe>
                <div class="absolute inset-0 bg-transparent z-10" aria-label="${i18next.t('modal.click_for_navigation')}"></div>
            </div>
        </a>
    `;
} else {
    zemljevidHtml += `<p class="p-4 text-center text-gray-500">${i18next.t('modal.no_map')}</p>`;
}

    return `<div class="galerija-sekcija p-4">${slikeHtml}</div><div class="zemljevid-sekcija p-4">${zemljevidHtml}</div>`;
}


// =================================================================
// 6. LOGIKA ZA WARNING MODAL
// =================================================================

const warningModal = document.getElementById('warningModal');

/**
 * Dinamično napolni vsebino warning modala z lokaliziranim besedilom.
 */
function posodobiWarningModalVsebino() {
    if (!warningModal) return;
    document.getElementById('warningMessage').textContent = i18next.t('warning.default_message');

    const gumbRazumem = document.getElementById('gumbRazumem');
    if (gumbRazumem) {
        gumbRazumem.removeEventListener('click', zapriWarningModal); 
        gumbRazumem.addEventListener('click', zapriWarningModal);
    }
}


/**
 * Prikazuje modal ob zagonu, če uporabnik še ni potrdil branja.
 */
function prikaziWarningModal() {
    if (!warningModal) return;
    const warningPotrjen = localStorage.getItem('warning_potrjen');

    if (warningPotrjen !== 'true') {
        posodobiWarningModalVsebino();
        warningModal.classList.add('active');
    }
}

/**
 * Zapre modal in shrani v localStorage, da se ne prikaže ponovno.
 */
function zapriWarningModal() {
    if (warningModal) {
        warningModal.classList.remove('active');
        localStorage.setItem('warning_potrjen', 'true');
    }
}

// =================================================================
// 6.5 LOGIKA ISKANJA (GLAVNE FUNKCIJE) - KONČNI POPRAVEK: ZANESLJIV PRIKAZ BREZ !IMPORTANT
// =================================================================

/**
 * Pošlje iskalne parametre na API in prikaže rezultate.
 */
async function handleIskanjeRestavracij(e, mesto, datum, cas, stevilo_oseb, kuhinjaKljuc = '') {
    e.preventDefault(); 
    
    const rezultatiContainer = document.getElementById('rezultatiIskanja');
    const searchSection = document.getElementById('rezultatiIskanjaSekcija');
    const defaultSection = document.getElementById('privzeteRestavracijeSekcija');
    const searchTitleElement = document.getElementById('naslovRezultatov'); 

    // 👇 LOGIKA PREKLAPLJANJA SEKCIJ
    if (defaultSection) defaultSection.style.display = 'none'; 
    
    // ⭐ Skrijemo sekcijo:
    if (searchSection) searchSection.style.display = 'none'; 
    if (searchTitleElement) searchTitleElement.style.display = 'none'; 
    
    if (rezultatiContainer) {
        rezultatiContainer.innerHTML = `<div class="p-4 text-center text-blue-500">${i18next.t('messages.searching')}</div>`;
    }

    const searchParams = {
        mesto: mesto, 
        datum: datum,
        cas: cas,
        stevilo_oseb: parseInt(stevilo_oseb),
        kuhinja: kuhinjaKljuc 
    };

    try {
        const url = `${API_BASE_URL}/restavracije/isci`;
        const response = await fetch(url, {
            method: 'POST', 
            headers: getAuthHeaders(),
            body: JSON.stringify(searchParams)
        });

        const data = await response.json();

        if (response.ok) {
            if (data && data.restavracije && data.restavracije.length > 0) {
                prikaziRezultate(data.restavracije);
                
                // 🔥 NOVI POPRAVEK: Prikazemo sekcijo. 
                // Uporaba style.display = 'block' bi morala delovati, ker smo odstranili !important iz CSS-a.
                if (searchSection) searchSection.style.display = 'block';
                if (searchTitleElement) searchTitleElement.style.display = 'block';

            } else {
                rezultatiContainer.innerHTML = `<div class="p-4 text-center text-gray-600">${i18next.t('messages.no_results_found')}</div>`;
            }
        } else {
            console.error('Napaka pri API iskanju:', data.msg);
            rezultatiContainer.innerHTML = `<div class="p-4 text-center text-red-500">${i18next.t('messages.error_fetching_data', { msg: data.msg || 'Neznana napaka' })}</div>`;
        }

    } catch (error) {
        console.error('Napaka pri povezavi s strežnikom:', error);
        if (rezultatiContainer) {
            rezultatiContainer.innerHTML = `<div class="p-4 text-center text-red-500">${i18next.t('messages.server_connection_error_retry')}</div>`;
        }
    }
}


/**
 * Pripravi in prikaže kartice restavracij v vsebniku za iskanje.
 */
function prikaziRezultate(restavracije) {
    const container = document.getElementById('rezultatiIskanja');
    if (!container) return; 

    container.innerHTML = ''; 
    
    let karticeHtml = '';

    restavracije.forEach(restavracija => {
        // ** POPRAVEK: ZARADI MONGO DB SHEME **
        // Dodamo 'restavracija.ime' kot primarno polje za ime
        const ime = restavracija.ime || restavracija.name || restavracija.imeRestavracije || 'Neznano Ime';
        // -------------------------------------
        const lokacija = restavracija.location || restavracija.naslovPodjetja || 'Neznana lokacija';
        const ocena = restavracija.rating || restavracija.ocena_povprecje || 'N/A';
        const stOcen = restavracija.reviewsCount || restavracija.st_ocen || 0;
        
        // Pravilna logika za sliko kartice
        const prvaSlika = restavracija.galerija_slik && restavracija.galerija_slik.length > 0 
            ? restavracija.galerija_slik[0] 
            : null; 
            
        const slikaUrl = prvaSlika || restavracija.imageUrl || restavracija.mainImageUrl || 'https://via.placeholder.com/400x300/CCCCCC/808080?text=Slika+ni+na+voljo';

        karticeHtml += `
            <div class="kartica" data-restavracija-id="${restavracija._id}" onclick="handleOdpriModalPodrobnosti(event, '${restavracija._id}')">
                <img src="${slikaUrl}" alt="${ime}">
                <div class="podrobnosti">
                    <h3>${ime}</h3>
                    <p>${lokacija}</p>
                    <div class="ocena">
                        <span>⭐ ${ocena}</span>
                        <span>(${stOcen} ${i18next.t('messages.reviews_internal')})</span>
                    </div>
                    <button class="gumb-rezervacija" data-rezervacija-gumb>${i18next.t('search.reserve')}</button>
                </div>
            </div>
        `;
    });

    container.insertAdjacentHTML('beforeend', karticeHtml);
    
    // Dodamo poslušalce za klike na kartice
    document.querySelectorAll('#rezultatiIskanja .kartica').forEach(kartica => {
         kartica.removeEventListener('click', handleOdpriModalPodrobnosti);
         kartica.addEventListener('click', handleOdpriModalPodrobnosti);
    });
    
    updateContent(); 
}

// =================================================================
// 6.8 POMOŽNE FUNKCIJE ZA PRIKAZ - OSTALE
// =================================================================

/**
 * Naloži privzete restavracije, ko se stran naloži.
 */
async function naloziPrivzeteRestavracije() {
    const container = document.getElementById('restavracije-container');
    if (!container) return;

    // ... (ostala koda za status in sekcije ostane enaka)

    try {
        const url = `${API_BASE_URL}/restavracije/privzeto`; 
        const response = await fetch(url);
        const rawData = await response.json(); // Uporabimo rawData

        container.innerHTML = ''; 

        // 🎯 KRITIČNI POPRAVEK: Prilagoditev branja podatkov
        let restavracijeZaPrikaz = [];
        
        if (Array.isArray(rawData)) {
            // Možnost 1: API vrne neposredno array (standardna praksa)
            restavracijeZaPrikaz = rawData;
        } else if (rawData && Array.isArray(rawData.restavracije)) {
            // Možnost 2: API vrne objekt z lastnostjo .restavracije
            restavracijeZaPrikaz = rawData.restavracije;
        }
        // Konec kritičnega popravka

        if (response.ok && restavracijeZaPrikaz.length > 0) {
            let karticeHtml = '';
            
            // Sedaj uporabimo pravilno strukturo: restavracijeZaPrikaz
            restavracijeZaPrikaz.forEach(restavracija => {
                
                // ** POPRAVEK IME: Dodana je robustnost **
                const ime = restavracija.ime || restavracija.name || restavracija.title || restavracija.imeRestavracije || 'Neznano Ime';
                // -------------------------------------
                
                const lokacija = restavracija.location || restavracija.naslovPodjetja || 'Neznana lokacija';
                const ocena = restavracija.rating || restavracija.ocena_povprecje || 'N/A';
                const stOcen = restavracija.reviewsCount || restavracija.st_ocen || 0;
                
                // Pravilna logika za sliko kartice
                const prvaSlika = restavracija.galerija_slik && restavracija.galerija_slik.length > 0 
                    ? restavracija.galerija_slik[0] 
                    : null; 
                const slikaUrl = prvaSlika || restavracija.imageUrl || restavracija.mainImageUrl || 'https://via.placeholder.com/400x300/CCCCCC/808080?text=Slika+ni+na+voljo';


                karticeHtml += `
                    <div class="kartica" data-restavracija-id="${restavracija._id}" onclick="handleOdpriModalPodrobnosti(event, '${restavracija._id}')">
                        <img src="${slikaUrl}" alt="${ime}">
                        <div class="podrobnosti">
                            <h3>${ime}</h3>
                            <p>${lokacija}</p>
                            <div class="ocena">
                                <span>⭐ ${ocena}</span>
                                <span>(${stOcen} ${i18next.t('messages.reviews_internal')})</span>
                            </div>
                            <button class="gumb-rezervacija" data-rezervacija-gumb>${i18next.t('search.reserve')}</button>
                        </div>
                    </div>
                `;
            });
            container.insertAdjacentHTML('beforeend', karticeHtml);
            
            // ... (ostala koda za poslušalce ostane enaka)

        } else {
            container.innerHTML = `<div class="p-4 text-center text-gray-600" style="grid-column: 1 / -1;">${i18next.t('messages.no_default_restaurants')}</div>`;
        }

        updateContent(); 
    } catch (error) {
        console.error('Napaka pri nalaganju privzetih restavracij:', error);
        container.innerHTML = `<div class="p-4 text-center text-red-500" style="grid-column: 1 / -1;">${i18next.t('messages.server_connection_error')}</div>`;
    }
}


// =================================================================
// 6.9 NOVA FUNKCIJA: NAZDAJ NA PRIVZETE (GLOBALNA DEFINICIJA)
// =================================================================

/**
 * Pripelje uporabnika nazaj na sekcijo s privzetimi restavracijami.
 */
function handlePrikaziPrivzete() {
    const searchSection = document.getElementById('rezultatiIskanjaSekcija');
    const defaultSection = document.getElementById('privzeteRestavracijeSekcija');
    
    // Skrij iskalne rezultate
    if (searchSection) {
        searchSection.classList.add('hidden');
    }
    
    // Prikaži privzete restavracije
    if (defaultSection) {
        defaultSection.style.display = 'block'; 
    }
    
    // Premakni pogled na vrh
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


// =================================================================
// 9. LOGIKA REZERVACIJE - PREVERJANJE PROSTIH UR
// =================================================================

/**
 * Kliče API end-point za pridobitev prostih ur za izbrani datum/število oseb.
 */
async function preveriProsteUre(rezervacijaPodatki) {
    const { restavracijaId, datum, stevilo_oseb } = rezervacijaPodatki;
    
    const rezultatiContainer = document.getElementById('prosteUreRezultati');
    if (rezultatiContainer) {
        rezultatiContainer.innerHTML = `<p class="p-4 text-center text-blue-500">${i18next.t('messages.checking_availability')}</p>`;
    }

    try {
        const url = `${API_BASE_URL}/restavracije/proste_ure`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ restavracijaId, datum, stevilo_oseb })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.mize && data.mize.length > 0) {
                prikaziProsteUre(data.mize, datum, stevilo_oseb);
            } else {
                rezultatiContainer.innerHTML = `<p class="p-4 text-center text-red-500">${i18next.t('messages.no_tables_found')}</p>`;
            }
        } else {
            prikaziSporocilo(data.msg || i18next.t('messages.availability_check_failed'), 'error');
            if (rezultatiContainer) {
                rezultatiContainer.innerHTML = `<p class="p-4 text-center text-red-500">${data.msg || i18next.t('messages.availability_check_failed')}</p>`;
            }
        }
    } catch (error) {
        console.error('Napaka pri preverjanju prostih ur:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error_retry'), 'error');
        if (rezultatiContainer) {
             rezultatiContainer.innerHTML = `<p class="p-4 text-center text-red-500">${i18next.t('messages.server_connection_error_retry')}</p>`;
        }
    }
}


/**
 * Prikazuje proste ure kot gumbe.
 */
function prikaziProsteUre(mize, datumPrikaz, steviloOseb) {
    const rezultatiContainer = document.getElementById('prosteUreRezultati');
    if (!rezultatiContainer) return;
    
    const danes = new Date();
    const datumDanesPrikaz = flatpickr.formatDate(danes, "d. m. Y"); 
    const trenutnaDecimalnaUra = danes.getHours() + danes.getMinutes() / 60;
    const jeDanes = (datumPrikaz === datumDanesPrikaz);

    const allAvailableTimes = new Map();

    mize.forEach(miza => {
        miza.prosteUre.forEach(uraDecimal => {
            
            const fixedDecimal = Math.round(uraDecimal * 100) / 100;

            // Preverjanje, ali je ura v preteklosti, če je izbran današnji datum
            if (jeDanes && fixedDecimal <= trenutnaDecimalnaUra) {
                return; 
            }

            const mizaData = {
                mizaId: miza.mizaId || 'neznan_id',
                mizaIme: miza.mizaIme,
                kapaciteta: miza.kapaciteta
            };

            if (!allAvailableTimes.has(fixedDecimal)) {
                allAvailableTimes.set(fixedDecimal, []);
            }
            allAvailableTimes.get(fixedDecimal).push(mizaData);
        });
    });

    const sortedTimes = Array.from(allAvailableTimes.keys()).sort((a, b) => {
        return parseFloat(a) - parseFloat(b);
    });
    
    rezultatiContainer.innerHTML = '';
    let html = `<div class="flex flex-wrap gap-2 justify-center">`;
        
    sortedTimes.forEach(uraDecimal => {
        const casString = convertDecimalToTime(uraDecimal);
            
        const prostaMiza = allAvailableTimes.get(uraDecimal)[0];

        html += `
            <button class="gumb-izbira-ure gumb-ura" 
                data-cas-decimal="${uraDecimal}" 
                data-miza-ime="${prostaMiza.mizaIme || ''}" 
                data-miza-id="${prostaMiza.mizaId || ''}" 
                data-datum="${datumPrikaz}"
                data-osebe="${steviloOseb}"
                data-ura-string="${casString}" 
                data-time="${casString}"> 
                ${casString} 
            </button>
        `;
    });
    
    html += `</div>`;
        
    if (sortedTimes.length === 0) {
        html = `<p class="text-center py-4 text-red-600">${i18next.t('messages.no_time_slots_available') || 'Žal nam je, danes ni več prostih terminov.'}</p>`;
    }
        
    rezultatiContainer.innerHTML = html;
        
    document.querySelectorAll('.gumb-izbira-ure').forEach(gumb => {
        gumb.addEventListener('click', odpriPotrditveniModal);
    });
        
    setupTimeSlotListeners();
}

/**
 * Prikazuje finalni potrditveni modal, preden pošlje podatke.
 */
function odpriPotrditveniModal(e) {
    const gumb = e.currentTarget;
    
    const casStartDecimal = parseFloat(gumb.dataset.casDecimal);
    const mizaIme = gumb.dataset.mizaIme; 
    const mizaId = gumb.dataset.mizaId;
    
    if (!mizaId || mizaId === 'neznan_id') {
        console.error("Miza ID ni bil najden.");
        prikaziSporocilo("Napaka: Manjka identifikator mize.", 'error');
        return;
    }

    // SHRANIMO GLOBALNE VREDNOSTI
    window.globalSelectedTime = casStartDecimal;
    window.globalSelectedMizaId = mizaId;
    window.globalSelectedMizaIme = mizaIme;

    // Vizualno označimo izbrano uro
    document.querySelectorAll('.gumb-ura').forEach(btn => btn.classList.remove('selected'));
    gumb.classList.add('selected');

    odpriDurationModal();
}


// =================================================================
// VI. LOGIKA REZERVACIJE IN TRAJANJA
// =================================================================

/**
 * Funkcija za potrditev rezervacije (po kliku na Potrdi Trajanje).
 */
const potrdiRezervacijo = () => {
    
    const modalDatumInput = document.getElementById('tabRezervacija')?.querySelector('[data-reserv-datum]');
    const modalOsebeInput = document.getElementById('tabRezervacija')?.querySelector('[data-reserv-osebe]');
    
    // Zbiranje podatkov iz globalnih spremenljivk (iz prejšnjega klika na uro)
    const casStart = window.globalSelectedTime; 
    const mizaId = window.globalSelectedMizaId; 
    const mizaIme = window.globalSelectedMizaIme; 

    // Zbiranje podatkov iz modalnih inputov
    const datumPrikaz = modalDatumInput ? modalDatumInput.value : null;
    const datumBackend = datumPrikaz ? formatirajDatumZaBackend(datumPrikaz) : null;
    const steviloOseb = modalOsebeInput ? parseInt(modalOsebeInput.value) : null; 
    const izbranoTrajanjeElement = durationModal ? durationModal.querySelector('input[name="duration"]:checked') : null;
    const trajanje = izbranoTrajanjeElement ? parseFloat(izbranoTrajanjeElement.value) : 1.5; 

    if (!currentRestaurantId || !mizaId || !datumBackend || !steviloOseb || !casStart) {
        prikaziSporocilo(i18next.t('messages.required_fields_missing_time_miza') || 'Izpolnite vsa polja in **IZBERITE URO/MIZO** na prejšnjem koraku.', 'error');
        if(durationModal) durationModal.classList.remove('active');
        if(restavracijaModal) restavracijaModal.classList.add('active'); 
        return;
    }

    // Uporabimo privzete gostinske podatke, saj nimamo prijave
    const imeGosta = localStorage.getItem('ime') || 'Spletni Gost'; 
    const telefon = localStorage.getItem('telefon') || '040123456'; 
    
    const rezervacijaPodatki = {
        restavracijaId: currentRestaurantId,
        mizaId, 
        imeGosta, 
        telefon, 
        stevilo_oseb: steviloOseb,
        datum: datumBackend, 
        casStart: casStart,
        trajanjeUr: trajanje,
        mizaIme: mizaIme
    };

    if(durationModal) durationModal.classList.remove('active');
    
    handleIzvedbaRezervacije(rezervacijaPodatki);
}


// =================================================================
// 10. LOGIKA MODALA ZA TRAJANJE
// =================================================================

// Odpre modal za izbiro trajanja
const odpriDurationModal = () => {
    if (!currentRestaurantId || !globalSelectedTime || !globalSelectedMizaId) {
        console.error("Napaka: Ni izbrane restavracije, časa ali mize za rezervacijo.");
        prikaziSporocilo(i18next.t('messages.select_time_and_table_error') || "Napaka: Prosimo, izberite čas in mizo rezervacije.", 'error');
        if(restavracijaModal) restavracijaModal.classList.add('active'); 
        return;
    }

    if(restavracijaModal) restavracijaModal.classList.remove('active');
    if(durationModal) durationModal.classList.add('active');
}

// Zapre modal za izbiro trajanja
const zapriDurationModal = document.getElementById('zapriDurationModal');
if(zapriDurationModal) zapriDurationModal.addEventListener('click', () => {
    if(durationModal) durationModal.classList.remove('active');
    if(restavracijaModal) restavracijaModal.classList.add('active'); 
});

// Zapiranje zunaj okna
if(durationModal) window.addEventListener("click", (e) => {
  if (e.target === durationModal) {
      durationModal.classList.remove("active");
      if(restavracijaModal) restavracijaModal.classList.add('active');
  }
});

// Vizualno označevanje izbrane opcije
const durationOpcije = document.getElementById('durationOpcije');
if(durationOpcije) durationOpcije.querySelectorAll('.duration-opcija').forEach(opcijaDiv => {
    opcijaDiv.addEventListener('click', () => {
        durationOpcije.querySelectorAll('.duration-opcija').forEach(d => d.classList.remove('selected'));
        opcijaDiv.classList.add('selected');
        const radio = opcijaDiv.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
    });
});

// Listenerji za izbrano uro (poskrbi za shranjevanje ID-ja mize)
function setupTimeSlotListeners() {
    const timeButtons = document.querySelectorAll('#prosteUreRezultati .gumb-ura'); 
    timeButtons.forEach(button => {
        // Ponovno vežemo samo na odpriPotrditveniModal
        button.removeEventListener('click', odpriPotrditveniModal);
        button.addEventListener('click', odpriPotrditveniModal);
    });
}

// =================================================================
// 7. ZAGON IN ISKALNA LOGIKA (DOM Content Loaded) - OČIŠČENA VERZIJA
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // A. PRIDOBITEV OSNOVNIH ELEMENTOV
    const isciForm = document.querySelector('.iskalnik');
    const hitraIskanjaGumbi = document.querySelectorAll('.gumb-kategorija');
    
    // B. Nastavitev poslušalcev za ISKANJE
    if (isciForm) {
        isciForm.addEventListener('submit', (e) => {
            e.preventDefault(); 
            
            handleIskanjeRestavracij(e,
                document.getElementById('restavracija_mesto').value,
                document.getElementById('datum').value,
                document.getElementById('cas').value,
                document.getElementById('stevilo_oseb').value
            );
        });
    }

    // C. Nastavitev poslušalcev za HITRA ISKANJA
    hitraIskanjaGumbi.forEach(gumb => {
        gumb.addEventListener('click', (e) => {
            e.preventDefault();

            const kuhinjaKljuc = e.target.getAttribute('data-kuhinja') || e.target.textContent.trim();

            handleIskanjeRestavracij(e,
                document.getElementById('restavracija_mesto').value,
                document.getElementById('datum').value,
                document.getElementById('cas').value,
                document.getElementById('stevilo_oseb').value,
                kuhinjaKljuc 
            );
        });
    });

    // KLIC NA ZAGONU STRANI: Nalaganje privzetih restavracij takoj ob zagonu
    naloziPrivzeteRestavracije();

    // GUMB NAZAJ: Ni potreben poslušalec tukaj, saj se funkcija kliče direktno iz HTML (onclick).
    
    // Nastavitev zapiranja modala za restavracijo
    setupRestavracijaModalClosure();
    
    // POSLUŠALEC ZA GUMB POTRDI TRAJANJE
    const potrdiTrajanjeGumb = document.getElementById('potrdiTrajanjeGumb');

    if (potrdiTrajanjeGumb) {
        potrdiTrajanjeGumb.addEventListener('click', potrdiRezervacijo);
    }
});


