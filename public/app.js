// Global state
let allBooks = [];
let filteredBooks = [];
let currentViewMode = 'list';
let currentBookId = null;
let currentPage = 1;
let itemsPerPage = 12;
let filters = {
    collana: '',
    owned: false,
    notOwned: false,
    read: false,
    notRead: false,
    digital: false,
    search: '',
    searchNumber: ''
};

// Funzione per normalizzare i caratteri accentati
function normalizeSearchText(text) {
    if (!text) return text;
    return text
        .replace(/[àá]/gi, (match) => match === match.toLowerCase() ? "a'" : "A'")
        .replace(/[èé]/gi, (match) => match === match.toLowerCase() ? "e'" : "E'")
        .replace(/[ìí]/gi, (match) => match === match.toLowerCase() ? "i'" : "I'")
        .replace(/[òó]/gi, (match) => match === match.toLowerCase() ? "o'" : "O'")
        .replace(/[ùú]/gi, (match) => match === match.toLowerCase() ? "u'" : "U'");
}

// DOM Elements
const booksList = document.getElementById('books-list');
const searchInput = document.getElementById('search-input');
const numberSearchInput = document.getElementById('number-search-input');
const collanaFilter = document.getElementById('collana-filter');
const ownedFilter = document.getElementById('owned-filter');
const notOwnedFilter = document.getElementById('not-owned-filter');
const readFilter = document.getElementById('read-filter');
const notReadFilter = document.getElementById('not-read-filter');
const digitalFilter = document.getElementById('digital-filter');
const resetFiltersBtn = document.getElementById('reset-filters');
const viewListBtn = document.getElementById('view-list');
const viewGridBtn = document.getElementById('view-grid');
const booksListSection = document.getElementById('books-list-section');
const bookDetailSection = document.getElementById('book-detail-section');
const backBtn = document.getElementById('back-btn');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const createModal = document.getElementById('create-modal');
const createForm = document.getElementById('create-form');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const closeSidebar = document.getElementById('close-sidebar');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const newBookBtn = document.getElementById('new-book-btn');
const createSaveBtn = document.getElementById('create-save-btn');
const createCancelBtn = document.getElementById('create-cancel-btn');
const closeCreateModalBtn = document.getElementById('close-create-modal');
const createUseNewCollana = document.getElementById('create-use-new-collana');
const createCollanaSelect = document.getElementById('create-collana-select');
const newCollanaFields = document.getElementById('new-collana-fields');
const totalBooksSpan = document.getElementById('total-books');
const totalOwnedSpan = document.getElementById('total-owned');
const totalReadSpan = document.getElementById('total-read');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const firstPageBtn = document.getElementById('first-page');
const lastPageBtn = document.getElementById('last-page');
const pageInput = document.getElementById('page-input');
const totalPagesSpan = document.getElementById('total-pages');
const prevPageBtnTop = document.getElementById('prev-page-top');
const nextPageBtnTop = document.getElementById('next-page-top');
const firstPageBtnTop = document.getElementById('first-page-top');
const lastPageBtnTop = document.getElementById('last-page-top');
const pageInputTop = document.getElementById('page-input-top');
const totalPagesSpanTop = document.getElementById('total-pages-top');
const itemsPerPageSelect = document.getElementById('items-per-page');
const reloadBtn = document.getElementById('reload-btn');
const hardReloadBtn = document.getElementById('hard-reload-btn');
const importWebBtn = document.getElementById('import-web-btn');
const deleteBookBtn = document.getElementById('delete-book-btn');
const importCalibreBtn = document.getElementById('import-calibre-btn');
const calibreModal = document.getElementById('calibre-modal');
const closeCalibreModalBtn = document.getElementById('close-calibre-modal');
const closeCalibreBtn = document.getElementById('calibre-cancel-btn');
const calibreSearchInput = document.getElementById('calibre-search-input');
const calibreSearchBtn = document.getElementById('calibre-search-btn');
const calibreStatusMsg = document.getElementById('calibre-status-msg');
const calibreResultsContainer = document.getElementById('calibre-results-container');
const calibreResultsList = document.getElementById('calibre-results-list');
const calibreResultsTitle = document.getElementById('calibre-results-title');
const calibreFormContainer = document.getElementById('calibre-form-container');
const calibreBackBtn = document.getElementById('calibre-back-btn');
const calibreImportSubmitBtn = document.getElementById('calibre-import-submit-btn');
const calibreImportForm = document.getElementById('calibre-import-form');
const calibreCollanaSelect = document.getElementById('calibre-collana-select');

// State management for localStorage
function saveState() {
    const state = {
        collana: collanaFilter.value,
        viewMode: currentViewMode,
        currentPage: currentPage,
        itemsPerPage: itemsPerPage,
        search: filters.search || '',
        searchNumber: filters.searchNumber || ''
    };
    localStorage.setItem('bookAppState', JSON.stringify(state));
}

function restoreState() {
    const savedState = localStorage.getItem('bookAppState');
    if (savedState) {
        try {
            const state = JSON.parse(savedState);
            
            // Restore collana filter
            if (state.collana !== undefined && state.collana !== null) {
                collanaFilter.value = state.collana;
            }
            // Restore view mode
            if (state.viewMode === 'grid') {
                currentViewMode = 'grid';
                booksList.classList.add('grid-view');
                viewGridBtn.classList.add('active');
                viewListBtn.classList.remove('active');
            }
            // Restore pagination settings
            itemsPerPage = state.itemsPerPage || 12;
            itemsPerPageSelect.value = itemsPerPage;
            
            // Restore search filter
            if (state.search) {
                searchInput.value = state.search;
                filters.search = state.search;
            }
            if (state.searchNumber) {
                if (numberSearchInput) numberSearchInput.value = state.searchNumber;
                filters.searchNumber = state.searchNumber;
            }
            
            // Restore filters (without triggering loadBooks yet)
            filters = {
                collana: collanaFilter.value,
                owned: ownedFilter.checked,
                read: readFilter.checked,
                digital: digitalFilter.checked,
                search: state.search || '',
                searchNumber: state.searchNumber || ''
            };
            
            
            // Restore current page
            currentPage = state.currentPage || 1;
            pageInput.value = currentPage;
            pageInputTop.value = currentPage;
        } catch (error) {
            console.error('Error restoring state:', error);
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    await loadCollane();
    restoreState();
    attachEventListeners();
    attachMobileMenuListeners();
    await loadBooks();
});

function attachMobileMenuListeners() {
    // Menu toggle button
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
    
    // Close sidebar button
    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }
    
    // Close sidebar when clicking on a filter
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            // Check if it's not the close button
            if (e.target.id !== 'close-sidebar' && !e.target.closest('.close-btn')) {
                // Close on small screens (mobile)
                if (window.innerWidth <= 768) {
                    setTimeout(() => {
                        sidebar.classList.remove('open');
                    }, 100);
                }
            }
        });
    }
}

function attachEventListeners() {
    searchInput.addEventListener('input', (e) => {
        filters.search = normalizeSearchText(e.target.value);
        currentPage = 1; // Reset to first page when searching
        pageInput.value = currentPage;
        pageInputTop.value = currentPage;
        saveState();
        applyFilters();
    });
    
    // Number search input
    if (numberSearchInput) {
        numberSearchInput.addEventListener('input', (e) => {
            filters.searchNumber = e.target.value.trim();
            currentPage = 1;
            pageInput.value = currentPage;
            pageInputTop.value = currentPage;
            saveState();
            applyFilters();
        });

        const clearNumberBtn = document.getElementById('clear-number-btn');
        if (clearNumberBtn) {
            clearNumberBtn.addEventListener('click', () => {
                numberSearchInput.value = '';
                filters.searchNumber = '';
                currentPage = 1;
                pageInput.value = currentPage;
                pageInputTop.value = currentPage;
                saveState();
                applyFilters();
            });
        }
    }
    
    // Clear search button
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            filters.search = '';
            currentPage = 1;
            pageInput.value = currentPage;
            pageInputTop.value = currentPage;
            saveState();
            applyFilters();
        });
    }
    
    collanaFilter.addEventListener('change', () => {
        saveState();
        applyFilters();
    });
    
    ownedFilter.addEventListener('change', () => {
        if (ownedFilter.checked) {
            notOwnedFilter.checked = false;
        }
        applyFilters();
    });
    
    notOwnedFilter.addEventListener('change', () => {
        if (notOwnedFilter.checked) {
            ownedFilter.checked = false;
        }
        applyFilters();
    });
    
    readFilter.addEventListener('change', () => {
        if (readFilter.checked) {
            notReadFilter.checked = false;
        }
        applyFilters();
    });
    
    notReadFilter.addEventListener('change', () => {
        if (notReadFilter.checked) {
            readFilter.checked = false;
        }
        applyFilters();
    });
    digitalFilter.addEventListener('change', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    viewListBtn.addEventListener('click', () => switchViewMode('list'));
    viewGridBtn.addEventListener('click', () => switchViewMode('grid'));
    backBtn.addEventListener('click', showBooksList);
    closeEditModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', saveBook);
    if (newBookBtn) {
        newBookBtn.addEventListener('click', openCreateModal);
    }
    if (importWebBtn) {
        importWebBtn.addEventListener('click', importBookFromWeb);
    }
    if (deleteBookBtn) {
        deleteBookBtn.addEventListener('click', deleteCurrentBook);
    }
    if (createSaveBtn) {
        createSaveBtn.addEventListener('click', saveNewBook);
    }
    if (createCancelBtn) {
        createCancelBtn.addEventListener('click', closeCreateModal);
    }
    if (closeCreateModalBtn) {
        closeCreateModalBtn.addEventListener('click', closeCreateModal);
    }
    if (createUseNewCollana) {
        createUseNewCollana.addEventListener('change', toggleNewCollanaFields);
    }
    if (importCalibreBtn) {
        importCalibreBtn.addEventListener('click', openCalibreModal);
    }
    if (closeCalibreModalBtn) {
        closeCalibreModalBtn.addEventListener('click', closeCalibreModal);
    }
    if (closeCalibreBtn) {
        closeCalibreBtn.addEventListener('click', closeCalibreModal);
    }
    if (calibreSearchBtn) {
        calibreSearchBtn.addEventListener('click', handleCalibreSearch);
    }
    if (calibreSearchInput) {
        calibreSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCalibreSearch();
            }
        });
    }
    if (calibreBackBtn) {
        calibreBackBtn.addEventListener('click', showCalibreResults);
    }
    if (calibreImportSubmitBtn) {
        calibreImportSubmitBtn.addEventListener('click', submitCalibreImport);
    }
    if (calibreCollanaSelect) {
        calibreCollanaSelect.addEventListener('change', handleCalibreCollanaChange);
    }
    itemsPerPageSelect.addEventListener('change', () => {
        const oldItemsPerPage = itemsPerPage;
        let newValue = parseInt(itemsPerPageSelect.value);
        
        // Valida il valore nell'intervallo 2-32
        if (isNaN(newValue) || newValue < 2) {
            newValue = 2;
            itemsPerPageSelect.value = 2;
        } else if (newValue > 32) {
            newValue = 32;
            itemsPerPageSelect.value = 32;
        }
        
        itemsPerPage = newValue;
        
        // Calcola il primo libro della pagina corrente
        const firstBookIndex = (currentPage - 1) * oldItemsPerPage;
        
        // Calcola la nuova pagina che contiene quel libro
        currentPage = Math.floor(firstBookIndex / itemsPerPage) + 1;
        
        pageInput.value = currentPage;
        pageInputTop.value = currentPage;
        saveState();
        loadBooks();
    });
    
    // Bottom pagination
    firstPageBtn.addEventListener('click', () => {
        goToFirstPage();
        saveState();
    });
    prevPageBtn.addEventListener('click', () => {
        goToPreviousPage();
        saveState();
    });
    nextPageBtn.addEventListener('click', () => {
        goToNextPage();
        saveState();
    });
    lastPageBtn.addEventListener('click', () => {
        goToLastPage();
        saveState();
    });
    pageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            goToPage(parseInt(pageInput.value));
            saveState();
        }
    });
    
    // Top pagination
    firstPageBtnTop.addEventListener('click', () => {
        goToFirstPage();
        saveState();
    });
    prevPageBtnTop.addEventListener('click', () => {
        goToPreviousPage();
        saveState();
    });
    nextPageBtnTop.addEventListener('click', () => {
        goToNextPage();
        saveState();
    });
    lastPageBtnTop.addEventListener('click', () => {
        goToLastPage();
        saveState();
    });
    pageInputTop.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            goToPage(parseInt(pageInputTop.value));
            saveState();
        }
    });
    
reloadBtn.addEventListener('click', async () => {
        await loadBooks();
        await loadCollane(true);
        restoreState();
        showSuccess('Database ricaricato correttamente');
    });


    // Hard reload button: clear disk cache + local state
    hardReloadBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/cache', { method: 'DELETE' });
        } catch (err) {
            console.error('Errore durante la cancellazione cache su disco', err);
        }
        localStorage.removeItem('collaneCache');
        localStorage.removeItem('bookAppState');
        allBooks = [];
        filteredBooks = [];
        await loadBooks();
        await loadCollane(true);
        restoreState();
        showSuccess('Hard reload completato con successo');
    });
}

// Load books for current page
async function loadBooks() {
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage,
            _ts: Date.now(), // cache buster per evitare risposte stale
            ...(filters.search && { search: filters.search }),
            ...(filters.searchNumber && { searchNumber: filters.searchNumber }),
            ...(filters.collana && { collana: filters.collana }),
            ...(filters.owned && { owned: 'true' }),
            ...(filters.notOwned && { notOwned: 'true' }),
            ...(filters.read && { read: 'true' }),
            ...(filters.notRead && { notRead: 'true' }),
            ...(filters.digital && { digital: 'true' })
        });
        
        const response = await fetch(`/api/books?${params}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load books');
        const data = await response.json();
        
        // Handle both old and new response formats
        const books = data.books || (Array.isArray(data) ? data : []);
        const totalBooks = data.total || books.length;
        const totalPages = data.pages || 1;
        
        allBooks = books;
        
        updateStats();
        displayBooksWithData(books, totalBooks, totalPages);
    } catch (error) {
        console.error('Error loading books:', error);
        showError('Errore nel caricamento dei libri');
    }
}

async function importBookFromWeb() {
    const collanaId = parseInt(collanaFilter.value, 10);
    if (!Number.isInteger(collanaId) || collanaId <= 0) {
        showError('Seleziona prima una collana dai filtri');
        return;
    }

    const sourceUrl = window.prompt('Inserisci l\'URL della pagina HTML da importare');
    if (!sourceUrl || !sourceUrl.trim()) {
        return;
    }

    const loaderOverlay = document.getElementById('save-loader-overlay');
    const loaderText = loaderOverlay ? loaderOverlay.querySelector('.loader-text') : null;
    const previousLoaderText = loaderText ? loaderText.textContent : '';

    if (loaderText) {
        loaderText.textContent = 'Importazione in corso...';
    }
    if (loaderOverlay) {
        loaderOverlay.style.display = 'flex';
    }

    try {
        const response = await fetch('/api/import/web', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: sourceUrl.trim(),
                collanaId
            })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Errore durante l\'importazione');
        }

        filters.collana = String(collanaId);
        collanaFilter.value = String(collanaId);
        currentPage = 1;
        pageInput.value = currentPage;
        pageInputTop.value = currentPage;
        saveState();

        await loadBooks();

        if (result.book?.id) {
            allBooks = [result.book, ...allBooks.filter(book => book.id !== result.book.id)];
            await showBookDetail(result.book.id);
        }

        showSuccess(`Libro importato: ${result.book?.title_ita || result.book?.title_orig || 'senza titolo'}`);
    } catch (error) {
        console.error('Error importing book from web:', error);
        showError(error.message || 'Errore durante l\'importazione');
    } finally {
        if (loaderText) {
            loaderText.textContent = previousLoaderText;
        }
        if (loaderOverlay) {
            loaderOverlay.style.display = 'none';
        }
    }
}

async function deleteCurrentBook() {
    if (!currentBookId) {
        showError('Nessun libro selezionato');
        return;
    }

    const confirmed = window.confirm('Eliminare definitivamente questo libro dal database? Verranno rimossi anche i dati collegati.');
    if (!confirmed) {
        return;
    }

    const bookIdToDelete = currentBookId;
    const loaderOverlay = document.getElementById('save-loader-overlay');
    const loaderText = loaderOverlay ? loaderOverlay.querySelector('.loader-text') : null;
    const previousLoaderText = loaderText ? loaderText.textContent : '';

    if (loaderText) {
        loaderText.textContent = 'Eliminazione in corso...';
    }
    if (loaderOverlay) {
        loaderOverlay.style.display = 'flex';
    }

    try {
        const response = await fetch(`/api/books/${bookIdToDelete}`, {
            method: 'DELETE'
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Errore durante l\'eliminazione');
        }

        allBooks = allBooks.filter(book => book.id !== bookIdToDelete);
        if (allBooks.length === 0 && currentPage > 1) {
            currentPage -= 1;
        }

        await showBooksList();
        updateStats();
        showSuccess('Libro eliminato con successo');
    } catch (error) {
        console.error('Error deleting book:', error);
        showError(error.message || 'Errore durante l\'eliminazione del libro');
    } finally {
        if (loaderText) {
            loaderText.textContent = previousLoaderText;
        }
        if (loaderOverlay) {
            loaderOverlay.style.display = 'none';
        }
    }
}

// Display books with pagination data from server
function displayBooksWithData(books, total, totalPages) {
    booksList.innerHTML = '';
    
    books = books || [];

    if (books.length === 0) {
        booksList.innerHTML = '<div class="empty-state"><p>Nessun libro trovato</p></div>';
        updatePagination(0);
        return;
    }

    books.forEach(book => {
        const bookItem = createBookElement(book);
        booksList.appendChild(bookItem);
    });

    updatePagination(totalPages);
}

function populateCollanaOptions(collane) {
    const selectedFilterValue = collanaFilter.value;
    const selectedCreateValue = createCollanaSelect ? createCollanaSelect.value : '';
    const selectedCalibreValue = calibreCollanaSelect ? calibreCollanaSelect.value : '';

    collanaFilter.innerHTML = '<option value="">Tutte le collane</option>';
    if (createCollanaSelect) {
        createCollanaSelect.innerHTML = '<option value="">Seleziona una collana</option>';
    }
    if (calibreCollanaSelect) {
        calibreCollanaSelect.innerHTML = '<option value="">Seleziona una collana</option>';
    }

    collane.forEach(collana => {
        const filterOption = document.createElement('option');
        filterOption.value = collana.id;
        filterOption.textContent = collana.nome;
        collanaFilter.appendChild(filterOption);

        if (createCollanaSelect) {
            const createOption = document.createElement('option');
            createOption.value = collana.id;
            createOption.textContent = collana.nome;
            createCollanaSelect.appendChild(createOption);
        }

        if (calibreCollanaSelect) {
            const calibreOption = document.createElement('option');
            calibreOption.value = collana.id;
            calibreOption.textContent = collana.nome;
            calibreCollanaSelect.appendChild(calibreOption);
        }
    });

    if ([...collanaFilter.options].some(option => option.value === selectedFilterValue)) {
        collanaFilter.value = selectedFilterValue;
    }

    if (createCollanaSelect && [...createCollanaSelect.options].some(option => option.value === selectedCreateValue)) {
        createCollanaSelect.value = selectedCreateValue;
    }

    if (calibreCollanaSelect && [...calibreCollanaSelect.options].some(option => option.value === selectedCalibreValue)) {
        calibreCollanaSelect.value = selectedCalibreValue;
    }
}

// Load collections
async function loadCollane(forceRefresh = true) {
    try {
        let collane;
        
        if (!forceRefresh) {
            // Try to get collane from localStorage
            const cachedCollane = localStorage.getItem('collaneCache');
            if (cachedCollane) {
                collane = JSON.parse(cachedCollane);
            } else {
                // Fetch from server and cache
                const response = await fetch('/api/collane');
                if (!response.ok) throw new Error('Failed to load collections');
                collane = await response.json();
                localStorage.setItem('collaneCache', JSON.stringify(collane));
            }
        } else {
            // Force refresh from server
            const response = await fetch('/api/collane');
            if (!response.ok) throw new Error('Failed to load collections');
            collane = await response.json();
            localStorage.setItem('collaneCache', JSON.stringify(collane));
        }
        populateCollanaOptions(collane);
        return collane;
    } catch (error) {
        console.error('Error loading collections:', error);
        return [];
    }
}

// Apply filters
function applyFilters() {
    filters = {
        collana: collanaFilter.value,
        owned: ownedFilter.checked,
        notOwned: notOwnedFilter.checked,
        read: readFilter.checked,
        notRead: notReadFilter.checked,
        digital: digitalFilter.checked,
        search: filters.search,
        searchNumber: filters.searchNumber
    };

    currentPage = 1;
    pageInput.value = 1;
    pageInputTop.value = 1;
    loadBooks();
}

// Reset filters
function resetFilters() {
    searchInput.value = '';
    if (numberSearchInput) numberSearchInput.value = '';
    collanaFilter.value = '';
    ownedFilter.checked = false;
    notOwnedFilter.checked = false;
    readFilter.checked = false;
    notReadFilter.checked = false;
    digitalFilter.checked = false;
    filters.search = '';
    filters.searchNumber = '';
    applyFilters();
}

// Display books
function displayBooks(books) {
    booksList.innerHTML = '';

    if (books.length === 0) {
        booksList.innerHTML = '<div class="empty-state"><p>Nessun libro trovato</p></div>';
        updatePagination(0);
        return;
    }

    const totalPages = Math.ceil(books.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const booksToDisplay = books.slice(startIndex, endIndex);

    booksToDisplay.forEach(book => {
        const bookItem = createBookElement(book);
        booksList.appendChild(bookItem);
    });

    updatePagination(totalPages);
}

// Generate inline stars widget for editing
function generateInlineStarsWidget(starsValue) {
    const stars = parseInt(starsValue) || 0;
    let html = '';
    
    // Clear button
    html += '<span class="inline-star inline-star-clear" data-value="0" title="Nessuna valutazione">✕</span>';
    
    // Star buttons (10 to 50)
    for (let i = 1; i <= 5; i++) {
        const value = i * 10;
        const isActive = stars >= value;
        html += `<span class="inline-star ${isActive ? 'active' : ''}" data-value="${value}" title="${i} stelle">⭐</span>`;
    }
    
    return html;
}

// Format stars with half stars
function formatStars(starsValue) {
    if (!starsValue) return 'Nessuna valutazione';
    
    const stars = Math.min(5, parseFloat(starsValue) / 10);
    const fullStars = Math.floor(stars);
    const hasHalfStar = (stars - fullStars) >= 0.5;
    
    let html = '<span class="stars-display">';
    
    // Create all 5 star positions
    for (let i = 1; i <= 5; i++) {
        html += '<span class="star-wrapper">';
        
        // Gray background star (always)
        html += '<span class="star-background">⭐</span>';
        
        // Colored star on top
        if (i <= fullStars) {
            // Full star
            html += '<span class="star-foreground full-star">⭐</span>';
        } else if (i === fullStars + 1 && hasHalfStar) {
            // Half star
            html += '<span class="star-foreground half-star">⭐</span>';
        }
        
        html += '</span>';
    }
    
    html += '</span>';
    return html;
}

// Create book element
function createBookElement(book) {
    const div = document.createElement('div');
    div.className = 'book-item';
    div.onclick = () => showBookDetail(book.id);

    const cover = document.createElement('div');
    cover.className = 'book-cover';
    
    // Try to load cover image from database
    const coverImg = document.createElement('img');
    coverImg.src = `/api/books/${book.id}/cover?t=${Date.now()}`;
    coverImg.alt = book.title_ita || book.title_orig || 'Copertina';
    coverImg.style.display = 'block';
    coverImg.loading = 'lazy';
    
    coverImg.onerror = () => {
        // Fallback to emoji if image not found
        cover.innerHTML = '<div class="book-cover-fallback">📖</div>';
    };
    
    coverImg.onload = () => {
        cover.innerHTML = '';
        cover.appendChild(coverImg);
    };
    
    cover.appendChild(coverImg);

    const info = document.createElement('div');
    info.className = 'book-info';

    const title = document.createElement('div');
    title.className = 'book-title';
    title.textContent = book.title_ita || book.title_orig || 'Senza titolo';

    const author = document.createElement('div');
    author.className = 'book-author';
    author.textContent = book.author || 'Autore sconosciuto';

    const meta = document.createElement('div');
    meta.className = 'book-meta';
    meta.textContent = `${book.number || ''} - ${book.editore || ''} (${book.date_pub || 'N/A'})`.trim();

    const badges = document.createElement('div');
    badges.className = 'book-badges';

    // Icona collezione - sempre visibile
    badges.innerHTML += `<span class="badge badge-icon owned ${!book.owned ? 'inactive' : ''}" title="${book.owned ? 'Nella collezione' : 'Non nella collezione'}">📚</span>`;
    
    // Icona letto - sempre visibile
    badges.innerHTML += `<span class="badge badge-icon read ${!book.read ? 'inactive' : ''}" title="${book.read ? 'Letto' : 'Non letto'}">👁️</span>`;
    
    // Icona digitale - sempre visibile
    badges.innerHTML += `<span class="badge badge-icon digital ${!book.digital ? 'inactive' : ''}" title="${book.digital ? 'Digitale' : 'Non digitale'}">💻</span>`;

    // Mostra sempre il badge stelle, anche se vuoto
    badges.innerHTML += `<span class="badge stars">${formatStars(book.stars)}</span>`;

    info.appendChild(title);
    info.appendChild(author);
    info.appendChild(meta);
    info.appendChild(badges);

    div.appendChild(cover);
    div.appendChild(info);

    return div;
}

// Attach inline edit handlers
function attachInlineEditHandlers(book) {
    // Handle checkboxes
    const checkboxes = document.querySelectorAll('.inline-checkbox input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const field = e.target.dataset.field;
            const value = e.target.checked;
            const label = e.target.nextElementSibling;
            
            // Update label text
            label.textContent = value ? '✓ Sì' : '✗ No';
            
            // Save to database
            await saveInlineEdit(field, value);
        });
    });
    
    // Handle stars
    const starsWidget = document.querySelector('.inline-stars-widget');
    if (starsWidget) {
        const stars = starsWidget.querySelectorAll('.inline-star');
        stars.forEach(star => {
            star.addEventListener('click', async (e) => {
                const value = parseInt(e.target.dataset.value);
                
                // Update UI
                stars.forEach(s => {
                    const starValue = parseInt(s.dataset.value);
                    if (starValue === 0) return; // Skip clear button
                    if (starValue <= value) {
                        s.classList.add('active');
                    } else {
                        s.classList.remove('active');
                    }
                });
                
                // Update data attribute
                starsWidget.dataset.value = value;
                
                // Save to database
                await saveInlineEdit('stars', value);
            });
        });
    }
}

// Save inline edit to database
async function saveInlineEdit(field, value) {
    if (!currentBookId) return;
    
    // Show loader
    const loaderOverlay = document.getElementById('save-loader-overlay');
    loaderOverlay.style.display = 'flex';
    
    try {
        const response = await fetch(`/api/books/${currentBookId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ [field]: value })
        });
        
        if (!response.ok) throw new Error('Failed to update book');
        
        // Update local data
        const bookIndex = allBooks.findIndex(b => b.id === currentBookId);
        if (bookIndex !== -1) {
            allBooks[bookIndex][field] = value;
        }
        
        // Update stats if necessary
        if (['owned', 'read'].includes(field)) {
            updateStats();
        }
        
        showSuccess('Modifica salvata con successo');
    } catch (error) {
        console.error('Error saving inline edit:', error);
        showError('Errore nel salvataggio della modifica');
    } finally {
        // Hide loader
        loaderOverlay.style.display = 'none';
    }
}

// Switch view mode
function switchViewMode(mode) {
    currentViewMode = mode;
    if (mode === 'list') {
        booksList.classList.remove('grid-view');
        viewListBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
    } else {
        booksList.classList.add('grid-view');
        viewListBtn.classList.remove('active');
        viewGridBtn.classList.add('active');
    }
    saveState();
}

// Show book detail
async function showBookDetail(bookId) {
    // Salva lo stato corrente prima di navigare
    saveState();
    
    currentBookId = bookId;
    try {
        const response = await fetch(`/api/books/${bookId}`);

        
        if (!response.ok) throw new Error('Failed to load book');
        const book = await response.json();
        console.log( book );

        const detailContent = document.getElementById('book-detail-content');
        
        let coverImageHtml = '';
        if (book.cover_image) {
            coverImageHtml = `<div class="detail-cover-image" id="cover-container-${book.id}">
                <img src="/api/books/${book.id}/cover?t=${Date.now()}" alt="Copertina" class="cover-detail-img">
            </div>`;
        }
        
        let synopsisImageHtml = '';
        if (book.synopsis_image) {
            synopsisImageHtml = `<div class="detail-synopsis-image" id="synopsis-container-${book.id}">
                <img src="/api/books/${book.id}/synopsis-image?t=${Date.now()}" alt="Immagine Sinossi" class="synopsis-detail-img">
            </div>`;
        }

        detailContent.innerHTML = `
            <div class="detail-header">
                <h2>${book.title_ita || book.title_orig || 'Senza titolo'}</h2>
            </div>
            
            <div class="detail-main-container">
                ${coverImageHtml}
                
                <div class="detail-info-container">
                    <div class="detail-section">
                        <div class="detail-row">
                            <span class="detail-label">Numero:</span>
                            <span class="detail-value">${book.number || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Autore:</span>
                            <span class="detail-value">${book.author || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Titolo Originale:</span>
                            <span class="detail-value">${book.title_orig || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Editore:</span>
                            <span class="detail-value">${book.editoreNome || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Collana:</span>
                            <span class="detail-value">${book.collanaNome || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Data Pubblicazione:</span>
                            <span class="detail-value">${book.date_pub || 'N/A'}</span>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h3>Informazioni Lettura</h3>
                        <div class="detail-row editable-row">
                            <span class="detail-label">Valutazione:</span>
                            <div class="detail-value-editable">
                                <div class="inline-stars-widget" data-field="stars" data-value="${book.stars || 0}">
                                    ${generateInlineStarsWidget(book.stars || 0)}
                                </div>
                            </div>
                        </div>
                        <div class="detail-row editable-row">
                            <span class="detail-label">Nella collezione:</span>
                            <div class="detail-value-editable">
                                <label class="inline-checkbox">
                                    <input type="checkbox" data-field="owned" ${book.owned ? 'checked' : ''}>
                                    <span class="checkbox-label">${book.owned ? '✓ Sì' : '✗ No'}</span>
                                </label>
                            </div>
                        </div>
                        <div class="detail-row editable-row">
                            <span class="detail-label">Letto:</span>
                            <div class="detail-value-editable">
                                <label class="inline-checkbox">
                                    <input type="checkbox" data-field="read" ${book.read ? 'checked' : ''}>
                                    <span class="checkbox-label">${book.read ? '✓ Sì' : '✗ No'}</span>
                                </label>
                            </div>
                        </div>
                        <div class="detail-row editable-row">
                            <span class="detail-label">Digitale:</span>
                            <div class="detail-value-editable">
                                <label class="inline-checkbox">
                                    <input type="checkbox" data-field="digital" ${book.digital ? 'checked' : ''}>
                                    <span class="checkbox-label">${book.digital ? '✓ Sì' : '✗ No'}</span>
                                </label>
                            </div>
                        </div>
                        <div class="detail-row editable-row">
                            <span class="detail-label">Ristampa:</span>
                            <div class="detail-value-editable">
                                <label class="inline-checkbox">
                                    <input type="checkbox" data-field="reprint" ${book.reprint ? 'checked' : ''}>
                                    <span class="checkbox-label">${book.reprint ? '✓ Sì' : '✗ No'}</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            ${(book.synopsis || book.synopsis_image) ? `
            <div class="detail-section">
                <h3>Sinossi</h3>
                ${book.synopsis ? `<p>${book.synopsis}</p>` : ''}
                ${synopsisImageHtml}
            </div>
            ` : ''}

            ${book.comment ? `
            <div class="detail-section">
                <h3>Commento</h3>
                <p>${book.comment}</p>
            </div>
            ` : ''}

            <div class="detail-section">
                <h3>Dettagli Copertina</h3>
                <div class="detail-row">
                    <span class="detail-label">Autore Copertina:</span>
                    <span class="detail-value">${book.cover_author || 'N/A'}</span>
                </div>
            </div>

            <div id="indexes-section"></div>
        `;

        // Attach inline edit handlers
        attachInlineEditHandlers(book);
        
        // Attach navigation handlers
        const prevBtn = document.getElementById('prev-book-btn');
        const nextBtn = document.getElementById('next-book-btn');
        
        // Build filter params for navigation
        const navParams = new URLSearchParams({
            ...(filters.collana && { collana: filters.collana }),
            ...(filters.owned && { owned: 'true' }),
            ...(filters.notOwned && { notOwned: 'true' }),
            ...(filters.read && { read: 'true' }),
            ...(filters.notRead && { notRead: 'true' }),
            ...(filters.digital && { digital: 'true' })
        });
        
        // Fetch and setup prev button
        if (prevBtn) {
            fetch(`/api/books/${bookId}/prev?${navParams}`)
                .then(res => {
                    if (res.ok) {
                        return res.json();
                    }
                    throw new Error('No previous book');
                })
                .then(prevBook => {
                    prevBtn.disabled = false;
                    prevBtn.onclick = () => showBookDetail(prevBook.id);
                })
                .catch(() => {
                    prevBtn.disabled = true;
                });
        }
        
        // Fetch and setup next button
        if (nextBtn) {
            fetch(`/api/books/${bookId}/next?${navParams}`)
                .then(res => {
                    if (res.ok) {
                        return res.json();
                    }
                    throw new Error('No next book');
                })
                .then(nextBook => {
                    nextBtn.disabled = false;
                    nextBtn.onclick = () => showBookDetail(nextBook.id);
                })
                .catch(() => {
                    nextBtn.disabled = true;
                });
        }

        // Load indexes/additional information
        fetch(`/api/indexes/${bookId}`)
            .then(res => res.json())
            .then(indexes => {
                const indexesSection = document.getElementById('indexes-section');
                if (indexes && indexes.length > 0) {
                    let indexesHtml = '<div class="detail-section"><h3>Contenuti Aggiuntivi</h3><div class="indexes-list">';
                    indexes.forEach(index => {
                        indexesHtml += '<div class="index-item">';
                        if (index.type) indexesHtml += `<span class="index-type">${index.type}</span>`;
                        if (index.title) indexesHtml += `<div class="index-title">${index.title}</div>`;
                        if (index.author) indexesHtml += `<div class="index-author">di ${index.author}</div>`;
                        if (index.page) indexesHtml += `<div class="index-page">Pagina ${index.page}</div>`;
                        if (index.description) indexesHtml += `<div class="index-description">${index.description}</div>`;
                        indexesHtml += '</div>';
                    });
                    indexesHtml += '</div></div>';
                    indexesSection.innerHTML = indexesHtml;
                } else {
                    indexesSection.innerHTML = '';
                }
            })
            .catch(err => {
                console.error('Error loading indexes:', err);
            });

        // Attach error handlers for images
        if (book.cover_image) {
            const coverImg = detailContent.querySelector('.cover-detail-img');
            if (coverImg) {
                coverImg.onerror = function() {
                    const container = document.getElementById(`cover-container-${book.id}`);
                    if (container) {
                        container.innerHTML = '<div class="no-image">Nessuna immagine di copertina disponibile</div>';
                    }
                };
            }
        }

        if (book.synopsis_image) {
            const synopsisImg = detailContent.querySelector('.synopsis-detail-img');
            if (synopsisImg) {
                synopsisImg.onerror = function() {
                    const container = document.getElementById(`synopsis-container-${book.id}`);
                    if (container) {
                        container.innerHTML = '<div class="no-image">Immagine sinossi non disponibile</div>';
                    }
                };
            }
        }

        booksListSection.style.display = 'none';
        bookDetailSection.style.display = 'block';
    } catch (error) {
        console.error('Error loading book detail:', error);
        showError('Errore nel caricamento del dettaglio');
    }
}

// Open edit modal
function openEditModal() {
    const book = allBooks.find(b => b.id === currentBookId);
    if (!book) return;

    document.getElementById('edit-title-ita').value = book.title_ita || '';
    document.getElementById('edit-title-orig').value = book.title_orig || '';
    document.getElementById('edit-author').value = book.author || '';
    document.getElementById('edit-date-pub').value = book.date_pub || '';
    document.getElementById('edit-cover-author').value = book.cover_author || '';
    document.getElementById('edit-editore').value = book.editore || '';
    document.getElementById('edit-collana').value = book.collana || '';
    document.getElementById('edit-synopsis').value = book.synopsis || '';
    document.getElementById('edit-comment').value = book.comment || '';
    document.getElementById('edit-stars').value = book.stars || 0;
    document.getElementById('edit-owned').checked = !!book.owned;
    document.getElementById('edit-read').checked = !!book.read;
    document.getElementById('edit-digital').checked = !!book.digital;
    document.getElementById('edit-reprint').checked = !!book.reprint;

    // Initialize stars widget
    initializeStarsWidget(Math.floor((book.stars || 0) / 10));

    editModal.style.display = 'flex';
}

function openCreateModal() {
    createForm.reset();
    toggleNewCollanaFields();

    if (filters.collana && createCollanaSelect) {
        createCollanaSelect.value = filters.collana;
    }

    createModal.style.display = 'flex';
}

// Initialize stars widget with clickable stars (supports half stars)
function initializeStarsWidget(currentRating) {
    const widget = document.getElementById('edit-stars-widget');
    widget.innerHTML = '';

    // Clear button to set rating to 0
    const clearBtn = document.createElement('span');
    clearBtn.className = 'star';
    clearBtn.title = 'Azzera valutazione';
    clearBtn.textContent = '✕';
    clearBtn.addEventListener('click', () => {
        const input = document.getElementById('edit-stars');
        input.value = 0;
        updateStarsWidget(0);
    });
    widget.appendChild(clearBtn);
    
    for (let i = 1; i <= 5; i++) {
        const starContainer = document.createElement('span');
        starContainer.className = 'star-container';
        starContainer.style.position = 'relative';
        starContainer.style.cursor = 'pointer';
        starContainer.style.display = 'inline-block';
        
        const fullStar = document.createElement('span');
        fullStar.textContent = '⭐';
        fullStar.className = 'star full-star';
        fullStar.style.position = 'relative';
        fullStar.style.zIndex = '1';
        
        const halfStar = document.createElement('span');
        halfStar.textContent = '⭐';
        halfStar.className = 'star half-star-widget';

        
        starContainer.appendChild(fullStar);
        starContainer.appendChild(halfStar);
        
        // Set initial state
        if (currentRating >= i) {
            fullStar.classList.add('active');
            halfStar.style.display = 'none';
        } else if (currentRating >= i - 0.5) {
            halfStar.classList.add('active');
        } else {
            fullStar.classList.remove('active');
            halfStar.style.display = 'none';
        }
        
        // Click handlers
        starContainer.addEventListener('click', (e) => {
            const rect = starContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const isLeftHalf = x < rect.width / 2;
            
            const newRating = isLeftHalf ? i - 0.5 : i;
            const starsValue = Math.round(newRating * 10);
            const input = document.getElementById('edit-stars');
            input.value = starsValue;
            updateStarsWidget(newRating);
        });
        
        // Hover handlers
        starContainer.addEventListener('mouseover', (e) => {
            const rect = starContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const isLeftHalf = x < rect.width / 2;
            
            const hoverRating = isLeftHalf ? i - 0.5 : i;
            updateStarsWidgetPreview(hoverRating);
        });
        
        widget.appendChild(starContainer);
    }
    
    widget.addEventListener('mouseleave', () => {
        // Read current value from hidden input
        const currentValue = parseInt(document.getElementById('edit-stars').value) || 0;
        const rating = currentValue / 10;
        updateStarsWidget(rating);
    });
}

// Update stars widget visual with half-star support
function updateStarsWidget(rating) {
    const widget = document.getElementById('edit-stars-widget');
    const containers = widget.querySelectorAll('.star-container');
    
    containers.forEach((container, index) => {
        const starIndex = index + 1;
        const fullStar = container.querySelector('.full-star');
        const halfStar = container.querySelector('.half-star-widget');
        
        if (rating >= starIndex) {
            fullStar.classList.add('active');
            halfStar.style.display = 'none';
        } else if (rating >= starIndex - 0.5) {
            fullStar.classList.remove('active');
            halfStar.classList.add('active');
            halfStar.style.display = 'block';
        } else {
            fullStar.classList.remove('active');
            halfStar.classList.remove('active');
            halfStar.style.display = 'none';
        }
    });
}

// Update stars widget visual for hover preview
function updateStarsWidgetPreview(rating) {
    const widget = document.getElementById('edit-stars-widget');
    const containers = widget.querySelectorAll('.star-container');
    
    containers.forEach((container, index) => {
        const starIndex = index + 1;
        const fullStar = container.querySelector('.full-star');
        const halfStar = container.querySelector('.half-star-widget');
        
        if (rating >= starIndex) {
            fullStar.classList.add('active');
            halfStar.style.display = 'none';
        } else if (rating >= starIndex - 0.5) {
            fullStar.classList.remove('active');
            halfStar.classList.add('active');
            halfStar.style.display = 'block';
        } else {
            fullStar.classList.remove('active');
            halfStar.classList.remove('active');
            halfStar.style.display = 'none';
        }
    });
}

// Close modal
function closeModal() {
    editModal.style.display = 'none';
    editForm.reset();
    // Nascondi il loader overlay se ancora visibile
    const loaderOverlay = document.getElementById('save-loader-overlay');
    if (loaderOverlay) loaderOverlay.style.display = 'none';
}

function closeCreateModal() {
    createModal.style.display = 'none';
    createForm.reset();
    toggleNewCollanaFields();
    const loaderOverlay = document.getElementById('save-loader-overlay');
    if (loaderOverlay) loaderOverlay.style.display = 'none';
}

function toggleNewCollanaFields() {
    const useNewCollana = !!(createUseNewCollana && createUseNewCollana.checked);

    if (newCollanaFields) {
        newCollanaFields.style.display = useNewCollana ? 'block' : 'none';
    }

    if (createCollanaSelect) {
        createCollanaSelect.disabled = useNewCollana;
    }
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Errore durante la lettura dell\'immagine'));
        reader.readAsDataURL(file);
    });
}

async function saveNewBook() {
    const coverFile = document.getElementById('create-cover-image').files[0];
    const starsValue = parseInt(document.getElementById('create-stars').value, 10);
    const useNewCollana = !!document.getElementById('create-use-new-collana').checked;

    const formData = {
        number: parseInt(document.getElementById('create-number').value, 10),
        title_ita: document.getElementById('create-title-ita').value.trim(),
        title_orig: document.getElementById('create-title-orig').value.trim(),
        author: document.getElementById('create-author').value.trim(),
        date_pub: document.getElementById('create-date-pub').value || null,
        cover_author: document.getElementById('create-cover-author').value.trim(),
        synopsis: document.getElementById('create-synopsis').value.trim(),
        comment: document.getElementById('create-comment').value.trim(),
        stars: Number.isFinite(starsValue) ? starsValue : 0,
        owned: document.getElementById('create-owned').checked,
        read: document.getElementById('create-read').checked,
        digital: document.getElementById('create-digital').checked,
        reprint: document.getElementById('create-reprint').checked,
        useNewCollana
    };

    if (useNewCollana) {
        formData.newCollanaName = document.getElementById('create-new-collana-name').value.trim();
        formData.newEditoreName = document.getElementById('create-new-editore-name').value.trim();
    } else {
        formData.collanaId = parseInt(document.getElementById('create-collana-select').value, 10);
    }

    const loaderOverlay = document.getElementById('save-loader-overlay');
    const loaderText = loaderOverlay ? loaderOverlay.querySelector('.loader-text') : null;
    const previousLoaderText = loaderText ? loaderText.textContent : '';

    if (loaderText) {
        loaderText.textContent = 'Creazione libro in corso...';
    }
    if (loaderOverlay) {
        loaderOverlay.style.display = 'flex';
    }

    try {
        if (coverFile) {
            formData.coverImage = await readFileAsDataUrl(coverFile);
        }

        const response = await fetch('/api/books', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Errore durante la creazione del libro');
        }

        await loadCollane(true);

        if (result.book?.collana) {
            filters.collana = String(result.book.collana);
            collanaFilter.value = String(result.book.collana);
        }

        currentPage = 1;
        pageInput.value = currentPage;
        pageInputTop.value = currentPage;
        saveState();

        closeCreateModal();
        await loadBooks();

        if (result.book?.id) {
            allBooks = [result.book, ...allBooks.filter(book => book.id !== result.book.id)];
            await showBookDetail(result.book.id);
        }

        showSuccess('Libro creato con successo');
    } catch (error) {
        console.error('Error creating book:', error);
        showError(error.message || 'Errore durante la creazione del libro');
    } finally {
        if (loaderText) {
            loaderText.textContent = previousLoaderText;
        }
        if (loaderOverlay) {
            loaderOverlay.style.display = 'none';
        }
    }
}

// Save book
async function saveBook() {
    // IMPORTANTE: Leggi il valore SUBITO, prima di qualsiasi operazione asincrona
    const starsInput = document.getElementById('edit-stars');
    const starsValue = parseInt(starsInput.value) || 0;
    
    const formData = {
        title_ita: document.getElementById('edit-title-ita').value,
        title_orig: document.getElementById('edit-title-orig').value,
        author: document.getElementById('edit-author').value,
        date_pub: document.getElementById('edit-date-pub').value,
        cover_author: document.getElementById('edit-cover-author').value,
        editore: document.getElementById('edit-editore').value,
        collana: document.getElementById('edit-collana').value,
        synopsis: document.getElementById('edit-synopsis').value,
        comment: document.getElementById('edit-comment').value,
        stars: starsValue,
        owned: document.getElementById('edit-owned').checked,
        read: document.getElementById('edit-read').checked,
        digital: document.getElementById('edit-digital').checked,
        reprint: document.getElementById('edit-reprint').checked
    };

    // Mostra il loader overlay
    const loaderOverlay = document.getElementById('save-loader-overlay');
    loaderOverlay.style.display = 'flex';

    try {
        const response = await fetch(`/api/books/${currentBookId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Failed to update book');

        // Update local data
        const bookIndex = allBooks.findIndex(b => b.id === currentBookId);
        if (bookIndex !== -1) {
            allBooks[bookIndex] = { ...allBooks[bookIndex], ...formData };
        }

        closeModal();
        showBookDetail(currentBookId);
        updateStats();
        // Ricarica la pagina corrente per sincronizzare la lista
        loadBooks();
        showSuccess('Libro aggiornato con successo');
    } catch (error) {
        console.error('Error saving book:', error);
        showError('Errore nel salvataggio del libro');
    } finally {
        // Nascondi il loader overlay
        loaderOverlay.style.display = 'none';
    }
}

// Update statistics
async function updateStats() {
    try {
        const response = await fetch('/api/books?page=1&limit=1');
        if (!response.ok) throw new Error('Failed to get stats');
        const data = await response.json();
        
        totalBooksSpan.textContent = data.total;
        
        // Get owned count
        const ownedResponse = await fetch('/api/books?page=1&limit=1&owned=true');
        const ownedData = await ownedResponse.json();
        totalOwnedSpan.textContent = ownedData.total;
        
        // Get read count
        const readResponse = await fetch('/api/books?page=1&limit=1&read=true');
        const readData = await readResponse.json();
        totalReadSpan.textContent = readData.total;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Error and success messages
function showError(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        padding: 15px 20px;
        border-radius: 5px;
        border: 1px solid #f5c6cb;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 4000);
}

function showSuccess(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d4edda;
        color: #155724;
        padding: 15px 20px;
        border-radius: 5px;
        border: 1px solid #c3e6cb;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 4000);
}

// Add slide-in animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// Update pagination
function updatePagination(totalPages) {
    const maxPage = Math.max(1, totalPages);
    pageInput.max = maxPage;
    pageInput.value = currentPage;
    pageInputTop.max = maxPage;
    pageInputTop.value = currentPage;
    totalPagesSpan.textContent = maxPage;
    totalPagesSpanTop.textContent = maxPage;
    
    firstPageBtn.disabled = currentPage <= 1;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= maxPage;
    lastPageBtn.disabled = currentPage >= maxPage;
    
    firstPageBtnTop.disabled = currentPage <= 1;
    prevPageBtnTop.disabled = currentPage <= 1;
    nextPageBtnTop.disabled = currentPage >= maxPage;
    lastPageBtnTop.disabled = currentPage >= maxPage;
}

// Go to first page
function goToFirstPage() {
    goToPage(1);
}

// Go to previous page
function goToPreviousPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

// Go to next page
function goToNextPage() {
    const maxPage = parseInt(totalPagesSpan.textContent);
    if (currentPage < maxPage) {
        goToPage(currentPage + 1);
    }
}

// Go to last page
function goToLastPage() {
    const maxPage = parseInt(totalPagesSpan.textContent);
    goToPage(maxPage);
}

// Go to specific page
function goToPage(pageNumber) {
    const maxPage = parseInt(totalPagesSpan.textContent) || 1;
    const validPage = Math.max(1, Math.min(pageNumber, maxPage));
    
    if (validPage !== currentPage) {
        currentPage = validPage;
        pageInput.value = currentPage;
        pageInputTop.value = currentPage;
        loadBooks();
    }
}

// Show books list
async function showBooksList() {
    // Ripristina lo stato salvato (pagina, filtri, ecc.)
    restoreState();
    
    booksListSection.style.display = 'block';
    bookDetailSection.style.display = 'none';
    
    // Ricarica la lista per mostrare la pagina corretta con i filtri ripristinati
    await loadBooks();
    
    currentBookId = null;
}

// ============================================
// CALIBRE-WEB IMPORT CONTROLLER
// ============================================

let currentCalibreBooksList = [];
let currentSelectedCalibreBook = null;

function setCalibreStatus(message, type = 'info') {
    if (!calibreStatusMsg) return;
    if (!message) {
        calibreStatusMsg.style.display = 'none';
        calibreStatusMsg.textContent = '';
        calibreStatusMsg.className = 'calibre-status-msg';
        return;
    }
    calibreStatusMsg.textContent = message;
    calibreStatusMsg.className = `calibre-status-msg ${type}`;
    calibreStatusMsg.style.display = 'block';
}

async function openCalibreModal() {
    if (!calibreModal) return;

    if (calibreSearchInput) calibreSearchInput.value = '';
    setCalibreStatus('');
    showCalibreResults();

    if (filters.collana && calibreCollanaSelect) {
        calibreCollanaSelect.value = filters.collana;
    }

    calibreModal.style.display = 'flex';
    await loadCalibreBooks('');
}

function closeCalibreModal() {
    if (!calibreModal) return;
    calibreModal.style.display = 'none';
    if (calibreImportForm) calibreImportForm.reset();
    currentSelectedCalibreBook = null;
    setCalibreStatus('');
}

function showCalibreResults() {
    if (calibreFormContainer) calibreFormContainer.style.display = 'none';
    if (calibreResultsContainer) calibreResultsContainer.style.display = 'block';
    if (calibreImportSubmitBtn) calibreImportSubmitBtn.style.display = 'none';
    setCalibreStatus('');
}

async function handleCalibreSearch() {
    const rawQuery = calibreSearchInput ? calibreSearchInput.value.trim() : '';
    if (!rawQuery) {
        await loadCalibreBooks('');
        return;
    }

    // Check if input is a Calibre-Web URL
    const urlMatch = rawQuery.match(/\/book\/(\d+)/i);
    if (urlMatch) {
        const bookId = parseInt(urlMatch[1], 10);
        await selectCalibreBook(bookId);
        return;
    }

    // Check if input is purely digits
    if (/^\d+$/.test(rawQuery)) {
        await loadCalibreBooks(rawQuery);
        return;
    }

    await loadCalibreBooks(rawQuery);
}

async function loadCalibreBooks(query = '') {
    if (!calibreResultsList) return;
    setCalibreStatus('');

    calibreResultsList.innerHTML = '<div class="calibre-loading">Caricamento libreria Calibre...</div>';
    if (calibreResultsTitle) {
        calibreResultsTitle.textContent = query ? `Risultati per: "${query}"` : 'Libri recenti in Calibre:';
    }

    try {
        const response = await fetch(`/api/calibre/books?q=${encodeURIComponent(query)}&limit=30`);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Impossibile connettersi alla libreria Calibre');
        }

        const books = await response.json();
        currentCalibreBooksList = books;
        renderCalibreResults(books);
    } catch (err) {
        console.error('Error loading Calibre books:', err);
        calibreResultsList.innerHTML = `<div class="calibre-loading" style="color: #dc3545;">⚠️ ${err.message}</div>`;
        setCalibreStatus(err.message, 'error');
    }
}

function renderCalibreResults(books) {
    if (!calibreResultsList) return;

    if (!Array.isArray(books) || books.length === 0) {
        calibreResultsList.innerHTML = '<div class="calibre-loading">Nessun libro trovato in Calibre per questa ricerca.</div>';
        return;
    }

    calibreResultsList.innerHTML = '';

    books.forEach(book => {
        const item = document.createElement('div');
        item.className = 'calibre-book-item';

        const thumbSrc = book.hasCover ? `/api/calibre/books/${book.id}/cover` : '';
        const formatsBadges = (book.formats || []).map(f => `<span class="index-type">${f}</span>`).join(' ');
        const importedBadge = book.alreadyImported
            ? '<span class="calibre-badge-imported">Già presente</span>'
            : '';

        item.innerHTML = `
            <div class="calibre-book-item-left">
                ${thumbSrc 
                    ? `<img class="calibre-book-thumb" src="${thumbSrc}" alt="cover" loading="lazy" onerror="this.style.display='none'">` 
                    : '<div class="calibre-book-thumb" style="display:flex;align-items:center;justify-content:center;color:#999;font-size:10px;">No Cover</div>'
                }
                <div class="calibre-book-meta">
                    <div class="calibre-book-title" title="${book.title}">${book.title}</div>
                    <div class="calibre-book-author">${book.author}</div>
                    <div class="calibre-book-sub">
                        ${book.pubdate ? `<span>📅 ${book.pubdate}</span>` : ''}
                        ${book.series ? `<span>📚 ${book.series} #${book.seriesIndex}</span>` : ''}
                        ${book.publisher ? `<span>🏢 ${book.publisher}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="calibre-book-item-right">
                ${importedBadge}
                ${formatsBadges}
                <button type="button" class="btn-primary btn-sm">Seleziona</button>
            </div>
        `;

        item.addEventListener('click', () => selectCalibreBook(book.id));
        calibreResultsList.appendChild(item);
    });
}

async function selectCalibreBook(bookIdOrUrl) {
    setCalibreStatus('Estrazione metadati e copertina...', 'info');

    const loaderOverlay = document.getElementById('save-loader-overlay');
    const loaderText = loaderOverlay ? loaderOverlay.querySelector('.loader-text') : null;
    const previousLoaderText = loaderText ? loaderText.textContent : '';

    if (loaderText) loaderText.textContent = 'Caricamento dettagli da Calibre...';
    if (loaderOverlay) loaderOverlay.style.display = 'flex';

    try {
        const preferredCollana = calibreCollanaSelect ? calibreCollanaSelect.value : (filters.collana || '');
        const response = await fetch(`/api/calibre/books/${encodeURIComponent(bookIdOrUrl)}?collanaId=${encodeURIComponent(preferredCollana)}`);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Errore durante la lettura del libro da Calibre');
        }

        const data = await response.json();
        currentSelectedCalibreBook = data;

        // Populate Preview Card
        const previewCover = document.getElementById('calibre-preview-cover-img');
        if (previewCover) {
            previewCover.src = `/api/calibre/books/${data.calibreId}/cover?_ts=${Date.now()}`;
        }
        const previewTitle = document.getElementById('calibre-preview-title');
        if (previewTitle) previewTitle.textContent = data.title_ita;
        const previewAuthor = document.getElementById('calibre-preview-author');
        if (previewAuthor) previewAuthor.textContent = data.author;
        const previewMeta = document.getElementById('calibre-preview-meta');
        if (previewMeta) {
            previewMeta.textContent = `ID Calibre: ${data.calibreId} | Editore: ${data.editoreNome || 'N/D'} | Data: ${data.date_pub || 'N/D'}`;
        }

        // Populate Form Fields
        document.getElementById('calibre-book-id').value = data.calibreId;
        document.getElementById('calibre-number').value = data.number || '';
        document.getElementById('calibre-title-ita').value = data.title_ita || '';
        document.getElementById('calibre-title-orig').value = data.title_orig || '';
        document.getElementById('calibre-author').value = data.author || '';
        document.getElementById('calibre-date-pub').value = data.date_pub || '';
        document.getElementById('calibre-cover-author').value = data.cover_author || 'N/A';
        document.getElementById('calibre-synopsis').value = data.synopsis || '';
        document.getElementById('calibre-comment').value = data.comment || '';
        document.getElementById('calibre-stars').value = data.stars || 0;
        document.getElementById('calibre-owned').checked = data.owned !== 0;
        document.getElementById('calibre-digital').checked = data.digital !== 0;
        document.getElementById('calibre-read').checked = data.read !== 0;
        document.getElementById('calibre-reprint').checked = data.reprint !== 0;

        if (calibreCollanaSelect && data.collanaId) {
            calibreCollanaSelect.value = String(data.collanaId);
        }

        // Show form view
        if (calibreResultsContainer) calibreResultsContainer.style.display = 'none';
        if (calibreFormContainer) calibreFormContainer.style.display = 'block';
        if (calibreImportSubmitBtn) calibreImportSubmitBtn.style.display = 'inline-block';
        setCalibreStatus('');
    } catch (err) {
        console.error('Error selecting Calibre book:', err);
        setCalibreStatus(err.message, 'error');
        showError(err.message);
    } finally {
        if (loaderText) loaderText.textContent = previousLoaderText;
        if (loaderOverlay) loaderOverlay.style.display = 'none';
    }
}

async function handleCalibreCollanaChange() {
    if (!currentSelectedCalibreBook) return;
    const collanaId = parseInt(calibreCollanaSelect.value, 10);
    if (!Number.isInteger(collanaId) || collanaId <= 0) return;

    try {
        const response = await fetch(`/api/calibre/books/${currentSelectedCalibreBook.calibreId}?collanaId=${collanaId}`);
        if (response.ok) {
            const data = await response.json();
            const numInput = document.getElementById('calibre-number');
            if (numInput && data.number) {
                numInput.value = data.number;
            }
            const titleInput = document.getElementById('calibre-title-ita');
            if (titleInput && data.title_ita) {
                titleInput.value = data.title_ita;
            }
            const authorInput = document.getElementById('calibre-author');
            if (authorInput && data.author) {
                authorInput.value = data.author;
            }
        }
    } catch (err) {
        console.warn('Could not re-calculate collana number suggestion:', err);
    }
}

async function submitCalibreImport() {
    const calibreId = parseInt(document.getElementById('calibre-book-id').value, 10);
    const number = parseInt(document.getElementById('calibre-number').value, 10);
    const titleIta = document.getElementById('calibre-title-ita').value.trim();
    const titleOrig = document.getElementById('calibre-title-orig').value.trim();
    const author = document.getElementById('calibre-author').value.trim();
    const datePub = document.getElementById('calibre-date-pub').value || null;
    const coverAuthor = document.getElementById('calibre-cover-author').value.trim() || 'N/A';
    const collanaId = parseInt(calibreCollanaSelect.value, 10);
    const synopsis = document.getElementById('calibre-synopsis').value.trim();
    const comment = document.getElementById('calibre-comment').value.trim();
    const stars = parseInt(document.getElementById('calibre-stars').value, 10) || 0;
    const owned = document.getElementById('calibre-owned').checked;
    const digital = document.getElementById('calibre-digital').checked;
    const read = document.getElementById('calibre-read').checked;
    const reprint = document.getElementById('calibre-reprint').checked;

    if (!Number.isInteger(number) || number <= 0) {
        showError('Inserisci un numero di collana valido (maggiore di 0)');
        return;
    }
    if (!titleIta) {
        showError('Titolo italiano obbligatorio');
        return;
    }
    if (!author) {
        showError('Autore obbligatorio');
        return;
    }
    if (!Number.isInteger(collanaId) || collanaId <= 0) {
        showError('Seleziona una collana valida');
        return;
    }

    const payload = {
        calibreId,
        number,
        title_ita: titleIta,
        title_orig: titleOrig,
        author,
        date_pub: datePub,
        cover_author: coverAuthor,
        collanaId,
        synopsis,
        comment,
        stars,
        owned,
        digital,
        read,
        reprint
    };

    const loaderOverlay = document.getElementById('save-loader-overlay');
    const loaderText = loaderOverlay ? loaderOverlay.querySelector('.loader-text') : null;
    const previousLoaderText = loaderText ? loaderText.textContent : '';

    if (loaderText) loaderText.textContent = 'Importazione libro da Calibre-Web in corso...';
    if (loaderOverlay) loaderOverlay.style.display = 'flex';

    try {
        const response = await fetch('/api/calibre/import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(result.error || 'Errore durante l\'importazione da Calibre');
        }

        closeCalibreModal();

        // Switch filter to the newly imported collana
        filters.collana = String(collanaId);
        collanaFilter.value = String(collanaId);
        currentPage = 1;
        pageInput.value = currentPage;
        pageInputTop.value = currentPage;
        saveState();

        await loadBooks();

        if (result.book?.id) {
            allBooks = [result.book, ...allBooks.filter(b => b.id !== result.book.id)];
            await showBookDetail(result.book.id);
        }

        showSuccess(`Libro importato con successo da Calibre: ${result.book?.title_ita || titleIta}`);
    } catch (err) {
        console.error('Error importing book from Calibre:', err);
        showError(err.message || 'Errore durante l\'importazione');
    } finally {
        if (loaderText) loaderText.textContent = previousLoaderText;
        if (loaderOverlay) loaderOverlay.style.display = 'none';
    }
}

