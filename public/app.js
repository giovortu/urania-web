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
    read: false,
    digital: false,
    search: ''
};

// DOM Elements
const booksList = document.getElementById('books-list');
const searchInput = document.getElementById('search-input');
const collanaFilter = document.getElementById('collana-filter');
const ownedFilter = document.getElementById('owned-filter');
const readFilter = document.getElementById('read-filter');
const digitalFilter = document.getElementById('digital-filter');
const resetFiltersBtn = document.getElementById('reset-filters');
const viewListBtn = document.getElementById('view-list');
const viewGridBtn = document.getElementById('view-grid');
const booksListSection = document.getElementById('books-list-section');
const bookDetailSection = document.getElementById('book-detail-section');
const backBtn = document.getElementById('back-btn');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const closeSidebar = document.getElementById('close-sidebar');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');
const closeModalBtn = document.querySelector('.close-modal');
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

// State management for localStorage
function saveState() {
    const state = {
        collana: collanaFilter.value,
        viewMode: currentViewMode,
        currentPage: currentPage,
        itemsPerPage: itemsPerPage
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
            
            // Restore filters (without triggering loadBooks yet)
            filters = {
                collana: collanaFilter.value,
                owned: ownedFilter.checked,
                read: readFilter.checked,
                digital: digitalFilter.checked
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
    // Gestione della cronologia del browser
    window.addEventListener('popstate', (event) => {
        if (event.state) {
            if (event.state.view === 'list') {
                showBooksList(false);
            } else if (event.state.view === 'detail' && event.state.bookId) {
                showBookDetail(event.state.bookId, false);
            }
        } else {
            // Nessuno stato, mostra la lista
            showBooksList(false);
        }
    });
    
    // Imposta lo stato iniziale
    const hash = window.location.hash;
    if (hash.startsWith('#book/')) {
        const bookId = parseInt(hash.split('/')[1]);
        if (bookId) {
            await loadCollane();
            restoreState();
            attachEventListeners();
            attachMobileMenuListeners();
            await loadBooks();
            await showBookDetail(bookId, false);
            return;
        }
    }
    
    // Caricamento normale
    history.replaceState({ view: 'list' }, '', '#list');
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
        filters.search = e.target.value;
        currentPage = 1; // Reset to first page when searching
        pageInput.value = currentPage;
        pageInputTop.value = currentPage;
        saveState();
        applyFilters();
    });
    collanaFilter.addEventListener('change', () => {
        saveState();
        applyFilters();
    });
    ownedFilter.addEventListener('change', applyFilters);
    readFilter.addEventListener('change', applyFilters);
    digitalFilter.addEventListener('change', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    viewListBtn.addEventListener('click', () => switchViewMode('list'));
    viewGridBtn.addEventListener('click', () => switchViewMode('grid'));
    backBtn.addEventListener('click', showBooksList);
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    saveBtn.addEventListener('click', saveBook);
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
            ...(filters.collana && { collana: filters.collana }),
            ...(filters.owned && { owned: 'true' }),
            ...(filters.read && { read: 'true' }),
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

// Load collections
async function loadCollane(forceRefresh = false) {
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
        
        collanaFilter.innerHTML = '<option value="">Tutte le collane</option>';
        collane.forEach(collana => {
            const option = document.createElement('option');
            option.value = collana;
            option.textContent = collana;
            collanaFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading collections:', error);
    }
}

// Apply filters
function applyFilters() {
    filters = {
        collana: collanaFilter.value,
        owned: ownedFilter.checked,
        read: readFilter.checked,
        digital: digitalFilter.checked,
        search: filters.search
    };

    currentPage = 1;
    pageInput.value = 1;
    pageInputTop.value = 1;
    loadBooks();
}

// Reset filters
function resetFilters() {
    searchInput.value = '';
    collanaFilter.value = '';
    ownedFilter.checked = false;
    readFilter.checked = false;
    digitalFilter.checked = false;
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

    if (book.owned) {
        badges.innerHTML += '<span class="badge owned">Nella collezione</span>';
    }
    if (book.read) {
        badges.innerHTML += '<span class="badge read">Letto</span>';
    } else {
        badges.innerHTML += '<span class="badge not-read">Non letto</span>';
    }
    if (book.digital) {
        badges.innerHTML += '<span class="badge digital">Digitale</span>';
    }
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
        
        // Reload books list to sync
        loadBooks();
        
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
async function showBookDetail(bookId, addToHistory = true) {
    currentBookId = bookId;
    
    // Aggiungi alla cronologia del browser
    if (addToHistory) {
        history.pushState({ view: 'detail', bookId: bookId }, '', `#book/${bookId}`);
    }
    
    try {
        const response = await fetch(`/api/books/${bookId}`);
        if (!response.ok) throw new Error('Failed to load book');
        const book = await response.json();

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
                            <span class="detail-value">${book.editore || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Collana:</span>
                            <span class="detail-value">${book.collana || 'N/A'}</span>
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

            ${book.synopsis ? `
            <div class="detail-section">
                <h3>Sinossi</h3>
                <p>${book.synopsis}</p>
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
            ...(filters.read && { read: 'true' }),
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
                    prevBtn.onclick = () => {
                        showBookDetail(prevBook.id, true);
                    };
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
                    nextBtn.onclick = () => {
                        showBookDetail(nextBook.id, true);
                    };
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
async function showBooksList(addToHistory = true) {
    // Aggiungi alla cronologia del browser
    if (addToHistory) {
        history.pushState({ view: 'list' }, '', '#list');
    }
    
    // Se c'è un libro corrente, trova la pagina che lo contiene
    if (currentBookId) {
        try {
            const params = new URLSearchParams({
                ...(filters.collana && { collana: filters.collana }),
                ...(filters.owned && { owned: 'true' }),
                ...(filters.read && { read: 'true' }),
                ...(filters.digital && { digital: 'true' })
            });
            
            const response = await fetch(`/api/books/${currentBookId}/position?${params}`);
            if (response.ok) {
                const data = await response.json();
                currentPage = Math.floor(data.position / itemsPerPage) + 1;
                pageInput.value = currentPage;
                pageInputTop.value = currentPage;
            }
        } catch (error) {
            console.error('Error finding book page:', error);
        }
    }
    
    booksListSection.style.display = 'block';
    bookDetailSection.style.display = 'none';
    
    // Ricarica la lista per mostrare la pagina corretta
    await loadBooks();
    
    currentBookId = null;
}
