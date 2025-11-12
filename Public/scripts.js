// =================================================================
// 0. LOGIKA PREVAJANJA (i18n) - DODATEK
// =================================================================
// TUKAJ JE VPISAN VAŠ DEL KODE 0. LOGIKA PREVAJANJA

const updateContent = () => {
    // 1. Prevede celotno stran z uporabo elementov z atributom data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');

        // Posebno ravnanje za placeholderje ([placeholder]search.key)
        if (key.startsWith('[placeholder]')) {
            const placeholderKey = key.replace('[placeholder]', '');
            el.placeholder = i18next.t(placeholderKey);
        } else {
            // Standardno prevajanje textContent
            el.textContent = i18next.t(key);
        }
    });

    // 2. Posebno ravnanje za opcije za število oseb (pluralizacija)
    const steviloOsebSelect = document.getElementById('stevilo_oseb');
    if (steviloOsebSelect) {
        // Shranimo trenutno izbrano vrednost, da jo ohranimo po prevodu
        const selectedValue = steviloOsebSelect.value;

        Array.from(steviloOsebSelect.options).forEach(option => {
            const count = parseInt(option.value);
            if (count > 0) {
                // Uporaba standardnega pluralizacijskega ključa "search.persons"
                option.textContent = i18next.t('search.persons', { count: count });
            }
        });

        // Obnovimo izbrano vrednost, če jo je uporabnik spremenil
        steviloOsebSelect.value = selectedValue;
    }

    // 3. Posodobimo tudi naslov strani
    const titleElement = document.querySelector('title');
    if (titleElement) {
        titleElement.textContent = i18next.t('app.title');
    }

    // 4. POSODOBIMO VSEBINO WARNING MODALA PO PREVODU
    if (document.getElementById('warningModal')) {
        // Ta funkcija mora biti definirana drugje, kjer je Warning Modal.
        // Če ni definirana, boste dobili napako ReferenceError.
        if (typeof posodobiWarningModalVsebino === 'function') {
            posodobiWarningModalVsebino();
        }
    }

    // Prevajanje vsebine v modalnem oknu, ki je dinamično ustvarjena
    const rezervacijaGumb = document.getElementById('rezervacijaModalGumb');
    if (rezervacijaGumb) {
        rezervacijaGumb.textContent = i18next.t('modal.reserve_button');
    }

    // 5. Posodobi naslov v Modalu Podrobnosti (ki je sedaj fiksno v HTML)
    const modalReservationTitle = document.getElementById('modalReservationTitle');
    if (modalReservationTitle) {
        modalReservationTitle.textContent = i18next.t('modal.reservation_title');
    }

    // -------------------------------------------------------------
    // 6. LOGIKA ZA DINAMIČNO PREPISOVANJE LINKOV (HREF)
    // -------------------------------------------------------------
    const currentLang = i18next.language || 'sl'; 
    
    document.querySelectorAll('[data-i18n-href]').forEach(el => {
        const key = el.getAttribute('data-i18n-href');
        
        // i18next.t() dobi generično pot (npr. '/o-nas.html')
        const genericPath = i18next.t(key); 

        // 1. Preverimo, ali je pot veljavna in se razlikuje od ključa
        if (genericPath && genericPath !== key) {
            
            // 2. ZGRADIMO PRAVILNO ABSOLUTNO POT
            // Uporaba trenutnega jezika, ki ga je nastavil i18next
            const dynamicPath = `/${currentLang}${genericPath.startsWith('/') ? genericPath : '/' + genericPath}`;
            
            el.setAttribute('href', dynamicPath);
        } else if (genericPath === key) {
             console.warn(`Ključ poti ni najden v JSON: ${key}. Preverite datoteko i18n/${currentLang}.json.`);
        }
    });
}; // Konec funkcije updateContent

const setupLanguageSwitcher = () => {
    const langSelect = document.querySelector('.izbira-jezika');
    if (langSelect) {
        // Nastavimo select na trenutni jezik, ki ga je določil i18next
        langSelect.value = i18next.language;

        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            // Shranimo izbiro v localStorage za naslednji obisk (visoka prioriteta)
            localStorage.setItem('lang', newLang);

            // Zamenjamo jezik in prevedemo vsebino
            i18next.changeLanguage(newLang, (err, t) => {
                if (err) return console.error('Napaka pri menjavi jezika:', err);
                updateContent();
            });
        });
    }
};

// 🚨 POSODOBLJENA FUNKCIJA initI18n ZA SAMODEJNO ZAZNAVANJE 🚨
const initI18n = (fallbackLang) => {
    i18next
        .use(i18nextHttpBackend) 
        .use(i18nextBrowserLanguageDetector) // 👈 Dodamo detektor jezika
        .init({
            // Konfiguracija, kako detektor išče jezik
            detection: {
                // Vrstni red iskanja:
                order: [
                    'localStorage', // 1. Uporabniška izbira ima prednost
                    'navigator',    // 2. Nastavitev brskalnika
                    'querystring', 
                    'cookie',       
                    'htmlTag'
                ],
                // Ime ključa, ki ga preverja v localStorage
                lookupLocalStorage: 'lang', 
                caches: ['localStorage'] 
            },
            
            // Jezik, ki se uporabi, če detektor ne najde podprtega jezika
            fallbackLng: fallbackLang, 
            ns: ['translation'],
            backend: {
                loadPath: './i18n/{{lng}}.json'
            },
            debug: false
        }, (err, t) => {
            if (err) return console.error('Napaka pri inicializaciji i18next:', err);
            
            // Po nalaganju shranimo dejanski jezik, ki ga je izbral i18next (lahko je iz brskalnika)
            const currentLang = i18next.language || fallbackLang;
            localStorage.setItem('lang', currentLang);

            // Po uspešnem nalaganju prevedemo stran in nastavimo poslušalca
            updateContent();
            setupLanguageSwitcher();
            // Po prevajanju se prikaže warning modal, če ga še nismo videli
            // Funkcija prikaziWarningModal() mora biti definirana drugje.
            if (typeof prikaziWarningModal === 'function') {
                prikaziWarningModal();
            }
        });
};

// 🚨 POSODOBLJEN ZAGON PREVAJANJA 🚨
// i18nextBrowserLanguageDetector bo sedaj izbral jezik, 'sl' je samo rezervni jezik.
const fallbackLang = 'sl'; 
if (typeof i18next !== 'undefined' && typeof i18nextBrowserLanguageDetector !== 'undefined') {
    initI18n(fallbackLang);
} else if (typeof i18nextBrowserLanguageDetector === 'undefined') {
    console.error('i18nextBrowserLanguageDetector knjižnica ni naložena! Preverite HTML vključitev.');
} else {
    console.error('i18next knjižnica ni naložena!');
}

// -------------------------------------------------------------
// 1. GLOBALNA NASTAVITEV IN TOKEN
// -------------------------------------------------------------
// 🔥 KRITIČEN POPRAVEK: API_BASE_URL mora biti celoten URL Render servisa, 
const API_BASE_URL = 'https://rentyo-gourmet-spletna-stran.onrender.com/api'; 
const authTokenKey = 'jwtToken'; // Ključ za shranjevanje žetona

// Pridobi avtentikacijski žeton iz localStorage
const getAuthHeaders = () => {
    const token = localStorage.getItem(authTokenKey);
    return {
        'Content-Type': 'application/json',
        // Če obstaja, dodamo Authorizacija glavo (za zaščitene poti)
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

// Funkcija za prikaz sporočila uporabniku
const prikaziSporocilo = (msg, tip = 'info') => {
    let container = document.getElementById('sporocila-container');
    if (!container) {
        // Če container ne obstaja, ga ustvarimo
        container = document.createElement('div');
        container.id = 'sporocila-container';
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.prepend(container);
        } else {
            document.body.prepend(container);
        }
    }

    // Določitev barve in stila
    let style = 'bg-blue-100 text-blue-800';
    if (tip === 'error') {
        style = 'bg-red-100 text-red-800';
    } else if (tip === 'success') {
        style = 'bg-green-100 text-green-800';
    }

    // Uporaba ustvarjenega sporočila
    container.innerHTML = `<div class="p-3 mb-3 text-sm rounded ${style} shadow-md transition-opacity duration-300">${msg}</div>`;

    // Samodejno skrivanje sporočila
    setTimeout(() => {
        container.innerHTML = '';
    }, 5000); // Sporočilo izgine po 5 sekundah
};

// Pomožna funkcija za formatiranje datuma iz Flatpickr v YYYY-MM-DD
const formatirajDatumZaBackend = (datum) => {
    if (!datum) return '';
    // Predpostavljamo format DD. MM. YYYY (npr. 01. 11. 2025)
    // OPOMBA: Flatpickr pogosto vrača že formatiran ISO datum. Preverite to!
    const parts = datum.split('.').map(s => s.trim());
    if (parts.length === 3) {
        // Obrnemo v YYYY-MM-DD
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    // Če je že v ISO formatu, ga vrnemo (Flatpickr ga včasih avtomatično nastavi)
    return datum; 
};


// -------------------------------------------------------------
// 🔥 KRITIČNI GLOBALNI SPREMENLJIVKI (POTREBNI ZA POTEK REZERVACIJE)
// -------------------------------------------------------------
// Te spremenljivke so bile prej lokalne ali niso bile definirane globalno.
let currentRestaurantId = null;
let globalSelectedTime = null;
let globalSelectedMizaId = null;
let globalSelectedMizaIme = null;

const restavracijaModal = document.getElementById('restavracijaModal');
const durationModal = document.getElementById('durationModal'); // Mora biti dostopna!


// =================================================================
// 🔥🔥🔥 DEL 3: KRITIČNA FUNKCIJA HANDLEIZVEDBAREZERVACIJE (POPRAVEK DOSEGA) 🔥🔥🔥
// Premaknjena na začetek, da je dosegljiva vsem ostalim funkcijam!
// =================================================================

/**
 * Pošlje dejansko rezervacijo na backend.
 * 🔥 POSODOBLJENO: Uporablja nov end-point: /restavracije/ustvari_rezervacijo
 */
async function handleIzvedbaRezervacije(podatki) {

    // Popravek end-pointa
    const url = `${API_BASE_URL}/restavracije/ustvari_rezervacijo`;

    try {
        prikaziSporocilo(i18next.t('messages.reserving', { cas: podatki.casStart, stevilo: podatki.stevilo_oseb }), 'info');

        // Pripravimo payload, ki ga zahteva backend
        const payload = {
            restavracijaId: podatki.restavracijaId,
            mizaId: podatki.mizaId,
            imeGosta: podatki.imeGosta,
            telefon: podatki.telefon,
            stevilo_oseb: podatki.stevilo_oseb,
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
            prikaziSporocilo(i18next.t('messages.reservation_success', { miza: podatki.mizaIme, cas: podatki.casStart }), 'success');
            // Zapri modal
            document.getElementById('restavracijaModal').classList.remove('active');
        } else {
            prikaziSporocilo(data.msg || i18next.t('messages.reservation_failed'), 'error');
        }

    } catch (error) {
        console.error('Napaka pri API klicu za rezervacijo:', error);
        prikaziSporocilo(i18next.t('messages.server_connection_error_retry'), 'error');
    }
}


// =================================================================
// 4. LOGIKA MODALNEGA OKNA ZA DETALJNO RESTAVRACIJO (Vključuje funkcije iz 5. dela)
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
    // Opomba: Te elemente je treba po vsakem odpiranju modala znova najti!
    const tabs = document.querySelectorAll('.restavracija-vsebina .modal-tab');
    const contents = document.querySelectorAll('.restavracija-vsebina .modal-vsebina-skrol .tab-content');

    tabs.forEach(tab => {
        tab.removeEventListener('click', handleTabClick); // Preprečimo podvajanje
        tab.addEventListener('click', handleTabClick);
    });
}

/**
 * Funkcija za obravnavo klika na zavihek.
 */
function handleTabClick(e) {
    const targetId = e.target.dataset.tab;

    const tabs = document.querySelectorAll('.restavracija-vsebina .modal-tab');
    const contents = document.querySelectorAll('.restavracija-vsebina .modal-vsebina-skrol .tab-content');

    // Odstrani aktivnost vsem tabom in vsebini
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    // Aktivira izbrani tab in vsebino
    e.target.classList.add('active');
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    // 🔥 KLJUČNO: Če se odpre zavihek Rezervacija, priključimo poslušalce za preverjanje
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
        // Odstranimo prejšnje poslušalce, da preprečimo podvajanje
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
    
    // Odstranimo prejšnje in dodamo nove poslušalce na polja
    datumInput.onchange = autoCheck;
    osebeInput.onchange = autoCheck;
}


/**
 * Pridobi ID iz kartice, pokliče API in odpre modal s podatki.
 */
async function handleOdpriModalPodrobnosti(e) {
    // Preveri, ali smo kliknili na gumb za rezervacijo znotraj kartice
    if (e.target.closest('[data-rezervacija-gumb]')) {
        // Če je bil klik na gumbu, se to obdela v handlePripravaRezervacije
        return;
    }

    const kartica = e.currentTarget;
    const restavracijaId = kartica.dataset.restavracijaId;

    if (!restavracijaId) return;
    
    // 🔥 KLJUČNO: Nastavimo ID restavracije kot globalno, da ga lahko uporabi potrdiRezervacijoTrajanje!
    currentRestaurantId = restavracijaId;

    try {
        prikaziSporocilo(i18next.t('messages.loading_details'), 'info');

        const url = `${API_BASE_URL}/restavracije/${restavracijaId}`; // Uporabljamo GET /:id
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            prikaziModalPodrobnosti(data);
            restavracijaModal.classList.add('active');
            prikaziSporocilo(''); // Počisti sporočilo
            
            // 🔥 KLJUČNO: Nastavimo poslušalce za zavihke in rezervacijo takoj
            setupRestavracijaTabs();
            // Če je privzet aktivni zavihek Rezervacija, priključimo poslušalce
            const activeTab = document.querySelector('.modal-tab.active');
            if (activeTab && activeTab.dataset.tab === 'tabRezervacija') {
                setupReservationFormListeners();
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

    // 🔥 POPRAVEK: Dobi ime restavracije z najširšo možno preverbo (imeRestavracije, ime, naziv)
    const prikazanoIme = restavracija.imeRestavracije || restavracija.ime || restavracija.naziv || i18next.t('messages.unknown_name');

    // Lokalizacija podatkov
    const opis = restavracija.description ? restavracija.description[currentLang] || restavracija.description.sl : i18next.t('results.na');
    const slikaUrl = restavracija.mainImageUrl || '';
    const rating = restavracija.ocena_povprecje || 0;
    const cenovniRazred = '€'.repeat(restavracija.priceRange || 1);
    
    // --- NOVO: Pridobi Google ocene iz objekta restavracije ---
    const googleRating = restavracija.googleRating || 0;
    const googleReviewCount = restavracija.googleReviewCount || 0;
    // -------------------------------------------------------------

    // 1. NAPOLNIMO STATIČNE ELEMENTE MODALA
    document.getElementById('modalSlika').style.backgroundImage = `url('${slikaUrl}')`;
    // 🔥 POPRAVLJENA VRSTICA: Uporaba nove spremenljivke prikazanoIme
    document.getElementById('modalIme').innerHTML = `${prikazanoIme} <span class="ocena-stevilka">(${cenovniRazred})</span>`; 
    
    document.getElementById('modalKuhinja').innerHTML = `<i class="fas fa-utensils"></i> ${restavracija.cuisine.join(', ')}`;
    document.getElementById('modalLokacija').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${restavracija.naslovPodjetja || i18next.t('messages.location_na')}`;
    
    // 🔥 POPRAVEK: Posodobitev prikaza ocene, da vključi Google oceno
    let ocenaHtml = '';
    
    // Prikaži interno oceno
    ocenaHtml += `<div class="internal-rating-detail">
        <i class="fas fa-circle"></i> 
        ${rating.toFixed(1)}/5 (${restavracija.st_ocen || 0} ${i18next.t('messages.reviews_internal')})
    </div>`;

    // Prikaži Google oceno (če obstaja)
    if (googleRating > 0) {
        ocenaHtml += `<div class="google-rating-detail">
            <i class="fab fa-google"></i> 
            ${googleRating.toFixed(1)}/5 (${googleReviewCount} ${i18next.t('messages.reviews_google')})
        </div>`;
    }
    
    document.getElementById('modalOcena').innerHTML = ocenaHtml;
    // -------------------------------------------------------------
    
    document.getElementById('modalOpis').textContent = opis;

    // 2. Napolnimo zavihek MENI (Dinamična vsebina)
    const tabMeni = document.getElementById('tabMeni');
    if(tabMeni) {
        tabMeni.innerHTML = ustvariMenijaHTML(restavracija.menu, currentLang);
    }

    // 3. Napolnimo zavihek GALERIJA
    const tabGalerija = document.getElementById('tabGalerija');
    if(tabGalerija) {
        // Opomba: Uporabite restavracija.lokacija.coordinates[1] za lat, [0] za lng, če je v GeoJSON formatu
        const lat = restavracija.lokacija && restavracija.lokacija.coordinates ? restavracija.lokacija.coordinates[1] : null;
        const lng = restavracija.lokacija && restavracija.lokacija.coordinates ? restavracija.lokacija.coordinates[0] : null;

        tabGalerija.innerHTML = ustvariGalerijeHTML(restavracija.galleryUrls, lat, lng);
    }
    
    // 4. Počistimo rezultate prostih ur (ker nismo še preverili)
    const tabRezervacija = document.getElementById('tabRezervacija');
    if (tabRezervacija) {
        const rezultatiContainer = document.getElementById('prosteUreRezultati');
        if (rezultatiContainer) {
            rezultatiContainer.innerHTML = `<p class="p-4 text-center text-gray-500">${i18next.t('messages.enter_date_and_persons')}</p>`;
        }
        
        // Povežemo ID restavracije v skrit input v obrazcu rezervacije
        const restavracijaIdInput = tabRezervacija.querySelector('[data-reserv-id]');
        if (restavracijaIdInput) {
            restavracijaIdInput.value = restavracija._id;
        }
        
    }

    // 5. Ponovno prevajanje (za vsebino modala)
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

    // Iteracija čez kategorije
    for (const kategorija in menuLang) {
        if (menuLang.hasOwnProperty(kategorija)) {
            const prevedenaKategorija = i18next.t(`menu_categories.${kategorija}`, { defaultValue: kategorija.charAt(0).toUpperCase() + kategorija.slice(1) });

            html += `<h4 class="text-xl font-bold mt-6 mb-3 border-b pb-1 text-gray-700">${prevedenaKategorija}</h4><ul class="meni-seznam space-y-2">`;

            // Iteracija čez jedi v kategoriji
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
        // ... (galerija koda ostane nespremenjena)
    } else {
        slikeHtml += `<p class="p-4 text-center text-gray-500">${i18next.t('modal.no_gallery')}</p>`;
    }

    let zemljevidHtml = `<h4 data-i18n="modal.map_title" class="text-xl font-bold mb-3 mt-6 text-gray-700">${i18next.t('modal.map_title')}</h4>`;
    
    if (lat && lng) {
        const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&hl=sl&z=15&output=embed`;
        
        // Povezava za PREUSMERITEV NA NAVIGACIJO, ki ovija zemljevid
        const navigacijskiURL = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`; 
        
        zemljevidHtml += `
            <a href="${navigacijskiURL}" target="_blank" class="block">
                <div class="zemljevid-ovoj rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition duration-300 cursor-pointer relative">
                    <iframe
                        src="${embedUrl}" 
                        width="100%"
                        height="400"
                        style="border:0;"
                        allowfullscreen=""
                        loading="lazy">
                    </iframe>
                    <div class="absolute inset-0 bg-transparent z-10" aria-label="Kliknite za navigacijo"></div>
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

    // Ker koda v index.html že vsebuje statičen warning modal, posodobimo samo besedilo
    document.getElementById('warningMessage').textContent = i18next.t('warning.default_message');

    // Poslušalec na gumb je potrebno priključiti samo enkrat ob zagonu
    const gumbRazumem = document.getElementById('gumbRazumem');
    if (gumbRazumem) {
        gumbRazumem.removeEventListener('click', zapriWarningModal); // Odstranimo, če obstaja
        gumbRazumem.addEventListener('click', zapriWarningModal);
    }
}


/**
 * Prikazuje modal ob zagonu, če uporabnik še ni potrdil branja.
 */
function prikaziWarningModal() {
    if (!warningModal) return;

    // 1. Preveri, ali je uporabnik že potrdil
    const warningPotrjen = localStorage.getItem('warning_potrjen');

    if (warningPotrjen !== 'true') {
        // 2. Poskrbi za prevod
        posodobiWarningModalVsebino();

        // 3. Prikaži modal
        warningModal.classList.add('active');
    }
}

/**
 * Zapre modal in shrani v localStorage, da se ne prikaže ponovno.
 */
function zapriWarningModal() {
    if (warningModal) {
        // Dodamo class, da lahko kontroliramo vidnost s CSS
        warningModal.classList.remove('active');
        // Shrani, da je opozorilo potrjeno
        localStorage.setItem('warning_potrjen', 'true');
    }
}

// =================================================================
// 7. ZAGON IN ISKALNA LOGIKA (IZ 2. DELA)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // A. PRIDOBITEV OSNOVNIH ELEMENTOV
    const isciForm = document.querySelector('.iskalnik'); // Uporabljamo class
    const hitraIskanjaGumbi = document.querySelectorAll('.gumb-kategorija');

    // B. Nastavitev poslušalcev za ISKANJE
    if (isciForm) {
        // Uporabimo ID-je iz vašega HTML-ja
        isciForm.addEventListener('submit', (e) => {
            // 🔥 POPRAVEK: Prepreči privzeto delovanje formularja (osvežitev strani)
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

            const dataI18nKey = e.target.getAttribute('data-i18n');
            const kuhinjaKljuc = dataI18nKey ? dataI18nKey.split('.').pop() : e.target.textContent.trim();

            // Preusmerimo na glavno iskalno funkcijo s polji iz iskalnega obrazca
            handleIskanjeRestavracij(e,
                document.getElementById('restavracija_mesto').value,
                document.getElementById('datum').value,
                document.getElementById('cas').value,
                document.getElementById('stevilo_oseb').value,
                kuhinjaKljuc // Dodamo nepreveden ključ kuhinje kot parameter
            );
        });
    });

    // KLIC NA ZAGONU STRANI: Nalaganje privzetih restavracij takoj ob zagonu
    naloziPrivzeteRestavracije();

    // Nastavitev zapiranja modala za restavracijo (iz dela 2)
    setupRestavracijaModalClosure();
    
    // 🔥 KLJUČNO POPRAVEK: POSLUŠALEC ZA GUMB POTRDI TRAJANJE
    const potrdiTrajanjeGumb = document.getElementById('potrdiTrajanjeGumb');

    if (potrdiTrajanjeGumb) {
        potrdiTrajanjeGumb.addEventListener('click', (e) => {
            e.preventDefault(); 
            // Kličemo popravljeno funkcijo potrdiRezervacijoTrajanje
            potrdiRezervacijoTrajanje(); 
        });
        
    } else {
        console.warn("Opozorilo: Gumb za potrditev rezervacije (ID 'potrdiTrajanjeGumb') ni najden v DOM-u ali je izven dosega!");
    }


}); // Konec DOMContentLoaded


// ... (NaloziPrivzeteRestavracije, handleIskanjeRestavracij, prikaziRezultate - brez sprememb)

// =================================================================
// 8. LOGIKA ISKANJA (IZ DELA 1)
// =================================================================

// ... (KODA ZA NALOZI PRIVZETE, HANDLE ISKANJE, PRIKAZI REZULTATE, HANDLEPRIPRAVAREZERVACIJE, PREVERIPROSTEU RE, PRIKAZIPROSTEURE - brez sprememb)
// =================================================================
// 9. LOGIKA REZERVACIJE (IZ DELA 1)
// =================================================================


/**
 * Kliče API end-point za pridobitev prostih ur za izbrani datum/število oseb.
 */
async function preveriProsteUre(rezervacijaPodatki) {
    const { restavracijaId, datum, stevilo_oseb } = rezervacijaPodatki;
    
    // Vizualna posodobitev med nalaganjem
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
 * Prikazuje proste ure kot gumbe, razvrščene po mizi.
 * Implementirano:
 * 1. Filtriranje ur v preteklosti za današnji dan.
 * 2. Sortiranje vseh prostih ur od najmanjše do največje, ne glede na mizo.
 */
function prikaziProsteUre(mize, datum, steviloOseb) {
    const rezultatiContainer = document.getElementById('prosteUreRezultati');
    if (!rezultatiContainer) return;
    
    // --- Pomožna funkcija za zanesljivo pretvorbo (decimalna ura -> HH:MM) ---
    const convertDecimalToTime = (decimalHour) => {
        // ... (Ostane nespremenjeno)
        const roundedDecimalHour = Math.round(decimalHour * 10) / 10;
        const totalMinutes = Math.round(roundedDecimalHour * 60); 
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const formattedHours = String(hours).padStart(2, '0');
        const formattedMinutes = String(minutes).padStart(2, '0');
        return `${formattedHours}:${formattedMinutes}`; 
    };
    // ------------------------------------------------

    // 🔑 NOVA LOGIKA: Določitev trenutne ure in datuma
    const danes = new Date();
    // Uporabljamo flatpickr za formatiranje datuma
    const datumDanesPrikaz = flatpickr.formatDate(danes, "d. m. Y"); 
    const trenutnaDecimalnaUra = danes.getHours() + danes.getMinutes() / 60;
    const jeDanes = (datum === datumDanesPrikaz);

    // 🔑 NOVA STRUKTURA: Združimo vse proste termine in shranimo podatke o mizi.
    // Ključ: decimalna ura, Vrednost: Polje miza objektov.
    const allAvailableTimes = new Map();

    mize.forEach(miza => {
        miza.prosteUre.forEach(uraDecimal => {
            
            // 1. Ohranimo samo cele ure
            const fixedDecimal = Math.round(uraDecimal * 100) / 100;
            if (fixedDecimal % 1 !== 0) {
                return; 
            }
            
            // 2. FILTRIRANJE UR V PRETEKLOSTI (če je danes)
            // Dodajamo termin samo, če je STROGO po trenutnem času
            if (jeDanes && fixedDecimal <= trenutnaDecimalnaUra) {
                return; 
            }

            // Pripravimo objekt mize z njenimi podatki
            const mizaData = {
                mizaId: miza.mizaId || 'neznan_id',
                mizaIme: miza.mizaIme,
                kapaciteta: miza.kapaciteta
            };

            // Dodamo mizo k decimalni uri v Map
            if (!allAvailableTimes.has(fixedDecimal)) {
                allAvailableTimes.set(fixedDecimal, []);
            }
            allAvailableTimes.get(fixedDecimal).push(mizaData);
        });
    });

    // 🔑 NOVA LOGIKA: Sortiramo ključe (ure) od najmanjše do največje
// POPRAVEK: Uporabimo parseFloat(), da zagotovimo pravilno ŠTEVILČNO sortiranje.
const sortedTimes = Array.from(allAvailableTimes.keys()).sort((a, b) => {
    return parseFloat(a) - parseFloat(b);
});
    
rezultatiContainer.innerHTML = '';
let html = `<div class="flex flex-wrap gap-2 justify-center">`;
    
// Iteriramo čez SORTIRANO polje ur
sortedTimes.forEach(uraDecimal => {
    const casString = convertDecimalToTime(uraDecimal); // Npr. '18:00'
        
    // Poberemo PRVO prosto mizo za ta čas
    const prostaMiza = allAvailableTimes.get(uraDecimal)[0];

    // 🔥 POPRAVEK: Miza ID odstranimo, saj bo mizo poiskal backend.
    html += `
        <button class="gumb-izbira-ure gumb-ura" 
            data-cas-decimal="${uraDecimal}" 
            data-miza-ime="" // Pustimo prazno ali odstranimo
            data-miza-id="" // ODSTRANJENO!
            data-datum="${datum}"
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
    
// Nastavimo poslušalce za izbiro ure (ki sproži potrditveni modal)
document.querySelectorAll('.gumb-izbira-ure').forEach(gumb => {
    // Opomba: OdpriPotrditveniModal bo uporabil data-ura-string/data-cas-decimal
    gumb.addEventListener('click', odpriPotrditveniModal);
});
    
// Inicializiramo Listener za trajanje
setupTimeSlotListeners();
}

/**
 * Prikazuje finalni potrditveni modal, preden pošlje podatke.
 * ⚠️ POPRAVEK: Odstranjena prepovedana funkcija confirm().
 */
function odpriPotrditveniModal(e) {
    const gumb = e.currentTarget;
    
    // 1. Poberemo vse potrebne podatke 
    const casStartDecimal = parseFloat(gumb.dataset.casDecimal);
    const mizaIme = gumb.dataset.mizaIme; 
    const datum = gumb.dataset.datum;
    const steviloOseb = parseInt(gumb.dataset.osebe);
    const casString = gumb.dataset.uraString;
    const mizaId = gumb.dataset.mizaId; // 🔥 Sedaj je na voljo
    
    // Dobimo ID restavracije iz skritega polja v modalu
    const restavracijaId = document.getElementById('tabRezervacija').querySelector('[data-reserv-id]').value;
    
    // Če mizaId ni definiran, se ustavi!
    if (!mizaId || mizaId === 'neznan_id') {
        console.error("Miza ID ni bil najden v data-atributih gumba.");
        prikaziSporocilo("Napaka: Manjka identifikator mize.", 'error');
        return;
    }

    // 🔥 KLJUČNO: SHRANIMO GLOBALNE VREDNOSTI ZA POTRDITEV TRAJANJA
    globalSelectedTime = casStartDecimal;
    globalSelectedMizaId = mizaId;
    globalSelectedMizaIme = mizaIme;
    currentRestaurantId = restavracijaId; // Čeprav bi moral biti že nastavljen

    // ----------------------------------------------------------------------------------
    // 🔥🔥 NAMENOMA OPUSČAMO TAKOJŠNJO REZERVACIJO, da lahko odpremo Duration Modal
    // ----------------------------------------------------------------------------------
    // Namesto takojšne rezervacije, odpremo Duration Modal
    odpriDurationModal();
}


// =================================================================
// VI. LOGIKA REZERVACIJE IN TRAJANJA
// =================================================================

/**
 * Pošlje dejansko rezervacijo na backend.
 * 🔥 TA FUNKCIJA JE MANJKALA IN JE BILA VZROK ZA ReferenceError.
 */
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
            const mizaIme = podatki.mizaIme || 'izbrana miza';
            prikaziSporocilo(i18next.t('messages.reservation_success', { miza: mizaIme, cas: podatki.casStart }), 'success');
            if(restavracijaModal) restavracijaModal.classList.remove('active');
            loadRestavracije();
        } else {
            prikaziSporocilo(data.msg || i18next.t('messages.reservation_failed'), 'error');
        }

    } catch (error) {
        console.error('Napaka pri API klicu za rezervacijo:', error);
        prikaziSporočilo(i18next.t('messages.server_connection_error_retry'), 'error');
    }
}


/**
 * Popravljena funkcija za potrditev rezervacije (Potek B - po kliku na Potrdi Trajanje).
 * Preimenovana iz potrdiRezervacijoTrajanje v potrdiRezervacijo, da se ujema z listenerji.
 */
const potrdiRezervacijo = () => {
    
    // 🔥 OPOMBA: Spremembjivke modalDatumInput, modalOsebeInput in durationModal
    // morajo biti definirane v globalnem obsegu ali pa pridobljene v tej funkciji.
    const modalDatumInput = document.getElementById('tabRezervacija')?.querySelector('[data-reserv-datum]');
    const modalOsebeInput = document.getElementById('tabRezervacija')?.querySelector('[data-reserv-osebe]');
    
    // Zbiranje podatkov iz globalnih spremenljivk
    const casStart = window.globalSelectedTime; 
    const mizaId = window.globalSelectedMizaId; 
    const mizaIme = window.globalSelectedMizaIme; 

    // Zbiranje podatkov iz modalnih inputov
    const datumPrikaz = modalDatumInput ? modalDatumInput.value : null;
    const datumBackend = datumPrikaz ? formatirajDatumZaBackend(datumPrikaz) : null;
    const steviloOseb = modalOsebeInput ? parseInt(modalOsebeInput.value) : null; 
    const izbranoTrajanjeElement = durationModal ? durationModal.querySelector('input[name="duration"]:checked') : null;
    const trajanje = izbranoTrajanjeElement ? parseFloat(izbranoTrajanjeElement.value) : 1.5; 

    // 🔥 POPRAVEK LOGIKE MANJKAJOČE MIZE/URE (dodano iz prejšnjih korakov za boljše opozorilo)
    if (!currentRestaurantId || !mizaId || !datumBackend || !steviloOseb || !casStart) {
        // Uporabimo novo, bolj specifično sporočilo
        prikaziSporočilo(i18next.t('messages.required_fields_missing_time_miza') || 'Izpolnite vsa polja in **IZBERITE URO/MIZO** na prejšnjem koraku.', 'error');
        if(durationModal) durationModal.classList.remove('active');
        if(restavracijaModal) restavracijaModal.classList.add('active'); 
        return;
    }

    // Simulirani/Privzeti podatki (uporabljamo localStorage, če je nastavljen)
    // 🔥 POPRAVLJENO: Poskusimo pridobiti ime pod 'ime' in 'imeGosta'.
    const imeGosta = localStorage.getItem('ime') || localStorage.getItem('imeGosta') || 'Spletni Gost'; 
    
    // 🔥 POPRAVLJENO: Poskusimo pridobiti telefon in v skrajnem primeru nastavimo 
    // na veljaven format (brez presledkov), ki ga backend ne bo zavrnil kot neveljavnega.
    const telefon = localStorage.getItem('telefon') || localStorage.getItem('telefonGosta') || '040123456'; 
    
    const rezervacijaPodatki = {
        restavracijaId: currentRestaurantId,
        mizaId, 
        imeGosta, 
        telefon, // Sedaj bi morala biti v veljavnem formatu, če je gost neprijavljen
        stevilo_oseb: steviloOseb,
        datum: datumBackend, // Uporabljamo format za Backend
        casStart: casStart,
        trajanjeUr: trajanje,
        mizaIme: mizaIme
    };

    if(durationModal) durationModal.classList.remove('active');
    
    // Takojšna izvedba rezervacije
    handleIzvedbaRezervacije(rezervacijaPodatki);
}


// =================================================================
// 10. LOGIKA MODALA ZA TRAJANJE (DODATNO - prilagojeno)
// =================================================================

// Odpre modal za izbiro trajanja
const odpriDurationModal = () => { // Preimenovano v const, da se izognemo window.odpriDurationModal v globalnem obsegu
    if (!currentRestaurantId || !globalSelectedTime || !globalSelectedMizaId) {
        console.error("Napaka: Ni izbrane restavracije, časa ali mize za rezervacijo.");
        prikaziSporočilo("Napaka: Prosimo, izberite čas in mizo rezervacije.", 'error');
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
});

// Zapiranje zunaj okna
if(durationModal) window.addEventListener("click", (e) => {
  if (e.target === durationModal) durationModal.classList.remove("active");
});

// Vizualno označevanje izbrane opcije in izbira radio gumba
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
    const timeButtons = document.querySelectorAll('#prosteUreRezultati .gumb-ura'); // Spremenjeno v .gumb-ura za konsistenco
    timeButtons.forEach(button => {
        // Uporabljamo skupni listener za shranjevanje časa/mize in odpiranje Duration modala
        button.removeEventListener('click', odpriDurationModalHandler); // Odstranimo, če obstaja
        button.addEventListener('click', odpriDurationModalHandler);
    });
}
// 🔥 Handler za izbiro ure (mora biti definiran izven setupTimeSlotListeners)
const odpriDurationModalHandler = (e) => {
    const button = e.target;
    const timeButtons = document.querySelectorAll('#prosteUreRezultati .gumb-ura');
    timeButtons.forEach(btn => btn.classList.remove('selected'));
    
    window.globalSelectedTime = button.getAttribute('data-time'); 
    window.globalSelectedMizaId = button.getAttribute('data-miza-id'); 
    window.globalSelectedMizaIme = button.getAttribute('data-miza-ime'); 
    button.classList.add('selected');
    odpriDurationModal(); 
};

// =================================================================
// LOGIKA ZA PERIODIČNO OSVEŽEVANJE PODATKOV (Polling - za proste mize)
// =================================================================

// FUNKCIJA, KI POSODOBI PRIKAZ MIZ V HTML-ju (Morate jo dopolniti!)
function posodobiPrikazMiz(mize) {
    // Vstavite logiko, ki na podlagi JSON objekta 'mize'
    // preveri prikazane mize na strani in jim spremeni status/barvo.
    // To je zelo odvisno od strukture vašega HTML-ja in prikaza miz.
    
    // Primer logike (ki ga boste morali prilagoditi):
    /*
    mize.forEach(miza => {
        const mizaElement = document.getElementById(`miza-id-${miza._id}`); // Predpostavka
        if (mizaElement) {
            // Predpostavimo, da je status mize npr. 'zasedena' ali 'prosta'
            if (miza.status === 'zasedena') { 
                mizaElement.classList.add('zasedena');
                mizaElement.classList.remove('prosta');
            } else {
                mizaElement.classList.add('prosta');
                mizaElement.classList.remove('zasedena');
            }
        }
    });
    */
    console.log("Mize uspešno osvežene. Potrebna je logika posodobitve prikaza v posodobiPrikazMiz().");
}

// FUNKCIJA ZA PERIODIČNI API KLIC
function osveziRazpolozljivostMiz() {
    // POZOR: Prepričajte se, da je '/api/restavracija/mize' pravilen in delujoč endpoint!
    fetch('/api/restavracija/mize') 
        .then(response => {
            if (!response.ok) throw new Error('API klic za mize ni uspel');
            return response.json();
        })
        .then(mize => {
            // Pokličemo funkcijo, ki posodobi HTML
            posodobiPrikazMiz(mize); 
        })
        .catch(error => console.error('Napaka pri osveževanju miz:', error));
}

// 1. Takojšnji zagon funkcije ob nalaganju skripte
osveziRazpolozljivostMiz();

// 2. Periodično osveževanje vsakih 5 sekund (5000ms)
setInterval(osveziRazpolozljivostMiz, 5000);