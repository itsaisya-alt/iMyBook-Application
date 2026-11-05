/* discover.js - PAGE 1 (Discover Books) + cards, suggestion logic, navigation */


// Display book cover
// Every book gets a designed cover first. A real cover is shown on top if it loads.
const coverColours = [
    ['#6e2f3f', '#b4576b'],
    ['#264653', '#2a9d8f'],
    ['#3d405b', '#6d6fa3'],
    ['#7a4e2d', '#c68b59'],
    ['#2f4b3a', '#6a9a75'],
    ['#5a3d6b', '#9a6fb0'],
    ['#1f3a5f', '#4f83b8'],
    ['#8a3b2a', '#d4795f']
];

// Turn a title into a number, so the same book always gets the same colour
function pickColourPair(text) {
    let total = 0;

    for (let i = 0; i < text.length; i++) {
        total += text.charCodeAt(i) * (i + 1);
    }

    return coverColours[total % coverColours.length];
}

function createGeneratedCover(book) {
    const colours = pickColourPair(book.title);

    const cover = el('div', 'generated-cover');
    cover.style.background =
        `linear-gradient(155deg, ${colours[0]}, ${colours[1]})`;

    const title = el('span', 'gc-title', book.title);

    const line = el('span', 'gc-line');

    const author = el('span', 'gc-author', book.author);

    cover.append(title, line, author);

    return cover;
}

function createBookCover(book) {
    const frame = el('div', 'cover-frame');

    // Layer 1: the designed cover (always there)
    frame.appendChild(createGeneratedCover(book));

    // Layer 2: the real cover picture (shown only when it loads properly)
    const cover = document.createElement('img');
    cover.alt = book.title + ' book cover';
    cover.decoding = 'async';
    frame.appendChild(cover);

    const coverUrls = book.coverUrls && book.coverUrls.length > 0
        ? book.coverUrls
        : book.cover
            ? [book.cover]
            : [];

    let currentCover = 0;
    function tryNextCover() {
        currentCover++;

        if (currentCover < coverUrls.length) {
            cover.src = coverUrls[currentCover];
        }
        // If no picture works, the designed cover stays visible
    }

    cover.addEventListener('load', function() {
        // A 1x1 picture means "no cover", so treat it as a failure
        if (cover.naturalWidth <= 1 || cover.naturalHeight <= 1) {
            tryNextCover();
            return;
        }

        frame.classList.add('has-image');
    });

    cover.addEventListener('error', function() {
        tryNextCover();
    });

    if (coverUrls.length > 0) {
        cover.src = coverUrls[0];
    }

    return frame;
}


// Display book card
function createInfoLine(label, value) {
    const line = el('p', 'info-line');

    const labelText = el('span', '', label);

    line.append(labelText, ' ' + value);

    return line;
}

// The Save button. After saving, the same button takes the user to PAGE 2.
function createSaveButton(book) {
    const saveButton = el('button', 'btn-primary btn-save');

    // If the book is already saved, show it straight away
    let isSaved = myLibrary.findBook(book.key) !== undefined;

    function updateLabel() {
        saveButton.textContent = isSaved
            ? '✓ Saved · View in My Reading List →'
            : '＋ Save to My Reading List';

        saveButton.classList.toggle('saved', isSaved);
    }

    updateLabel();

    saveButton.addEventListener('click', function() {
        // CONNECTING PAGE 1 AND PAGE 2: a saved book opens the reading list
        if (isSaved) {
            goToReadingList(book.key);
            return;
        }

        const result = myLibrary.addBook(book);

        showToast(result.message, result.ok ? 'success' : 'warning');
        updateNavCount();

        if (result.ok) {
            isSaved = true;
            updateLabel();
        }
    });

    return saveButton;
}

function createRatingBadge(book) {
    const badge = el('span', 'rating-badge', '★ ' + book.apiRating.toFixed(1));
    badge.title = 'Average reader rating from Open Library';

    return badge;
}

function createBookCard(book, cardType) {
    const card = document.createElement('div');

    card.classList.add(
        cardType === 'recommendation'
            ? 'recommendation-card'
            : 'book-card'
    );

    // Polymorphism: each class has its own displayInfo()
    card.setAttribute('aria-label', book.displayInfo());

    // Display book cover
    card.appendChild(createBookCover(book));

    const info = document.createElement('div');

    info.classList.add(
        cardType === 'recommendation' ? 'recommendation-info' : 'book-info'
    );

    const title = document.createElement(
        cardType === 'recommendation' ? 'h4' : 'h3'
    );

    title.textContent = book.title;

    const author = el('p', 'book-author', book.author);

    info.append(title, author);

    if (cardType === 'search') {
        const details = el('div', 'info-grid');

        details.append(
            createInfoLine('Genre:', book.genre),
            createInfoLine('Published:', book.year),
            createInfoLine(
                'Pages:',
                book.pagesNumber > 0 ? book.pagesNumber : 'Not available'
            )
        );

        info.appendChild(details);

        if (book.apiRating > 0) {
            info.appendChild(createRatingBadge(book));
        }

        info.appendChild(createSaveButton(book));
    }

    if (cardType === 'recommendation') {
        const meta = el('p', 'rec-meta');

        const metaParts = [];

        if (book.year !== 'Not available') {
            metaParts.push(book.year);
        }

        if (book.pagesNumber > 0) {
            metaParts.push(book.pagesNumber + ' pages');
        }

        meta.textContent = metaParts.join(' · ');

        info.appendChild(meta);

        // Why was this book suggested?
        if (book.reasons && book.reasons.length > 0) {
            const reasonList = el('div', 'reason-list');

            book.reasons.slice(0, 3).forEach(function(reason) {
                const reasonChip = el('span', 'reason-chip', reason);
                reasonList.appendChild(reasonChip);
            });

            info.appendChild(reasonList);
        }

        info.appendChild(createSaveButton(book));
    }

    card.appendChild(info);

    return card;
}


// Calculation: reading plan
// Uses API data (total pages) + user input (pages per day, reading speed)
function calculateReadingPlan(book, pagesPerDay, pagesPerHour) {
    // Boundary case: the API may not know the number of pages
    if (book.pagesNumber === 0) {
        return {
            ok: false,
            message: 'Enter the total number of pages above and save it first.'
        };
    }

    // Input validation
    if (!Number.isInteger(pagesPerDay) || pagesPerDay < 1 || pagesPerDay > 1000) {
        return {
            ok: false,
            message: 'Pages per day must be a whole number from 1 to 1000.'
        };
    }

    if (!Number.isInteger(pagesPerHour) || pagesPerHour < 1 || pagesPerHour > 200) {
        return {
            ok: false,
            message: 'Reading speed must be a whole number from 1 to 200 pages per hour.'
        };
    }

    // Boundary case: the book is already finished
    const remaining = book.remainingPages;

    if (remaining === 0) {
        return { ok: true, finished: true };
    }

    // Calculations
    const days = Math.ceil(remaining / pagesPerDay);
    const minutesPerDay = Math.round((Math.min(pagesPerDay, remaining) / pagesPerHour) * 60);
    const totalHours = Math.round((remaining / pagesPerHour) * 10) / 10;

    const finishDate = new Date();
    finishDate.setDate(finishDate.getDate() + days);

    return {
        ok: true,
        finished: false,
        remaining: remaining,
        days: days,
        minutesPerDay: minutesPerDay,
        totalHours: totalHours,
        finishDate: finishDate
    };
}


// Suggestion logic (student-written control statements)
// Give one book a score and a list of reasons based on the user's choices
function scoreBook(book, preferences, authorCounts) {
    let score = 0;
    const reasons = [];

    let lengthMatches = true;
    let eraMatches = true;
    let authorMatches = true;

    // Condition 1: book length (switch)
    const pages = book.pagesNumber;

    if (pages > 0) {
        switch (preferences.length) {
            case 'short':
                lengthMatches = pages <= 250;
                break;
            case 'medium':
                lengthMatches = pages > 250 && pages <= 450;
                break;
            case 'long':
                lengthMatches = pages > 450;
                break;
            default:
                lengthMatches = true;
        }

        if (lengthMatches && preferences.length !== 'any') {
            score += 3;
            reasons.push(pages + ' pages');
        }
    } else if (preferences.length !== 'any') {
        // Page count unknown, so the length cannot be confirmed
        lengthMatches = false;
    }

    // Condition 2: era (if...else)
    const year = Number(book.year);

    if (year > 0) {
        if (preferences.era === 'classic') {
            eraMatches = year < 1980;
        } else if (preferences.era === 'modern') {
            eraMatches = year >= 1980;
        }

        if (eraMatches && preferences.era !== 'any') {
            score += 3;
            reasons.push(preferences.era === 'classic' ? 'Classic (' + year + ')' : 'Modern (' + year + ')');
        }
    } else if (preferences.era !== 'any') {
        eraMatches = false;
    }

    // Condition 3: favourite author
    if (preferences.author !== '') {
        if (book.author.toLowerCase().includes(preferences.author)) {
            score += 5;
            reasons.push('By your favourite author');
        } else {
            authorMatches = false;
        }
    }

    // Bonus: reader rating
    if (book.apiRating >= 4) {
        score += 3;
        reasons.push('Highly rated ' + book.apiRating.toFixed(1) + '/5');
    } else if (book.apiRating >= 3.5) {
        score += 1;
        reasons.push('Well rated ' + book.apiRating.toFixed(1) + '/5');
    }

    // Bonus: author already in the user's reading list
    const mainAuthor = book.author.split(',')[0].trim().toLowerCase();

    if (authorCounts.has(mainAuthor)) {
        score += 2;
        reasons.push('You saved another book by this author');
    }

    // Bonus: books with a cover look better
    if (book.coverUrls.length > 0) {
        score += 1;
    }

    return {
        book: book,
        score: score,
        reasons: reasons,
        matchesAll: lengthMatches && eraMatches && authorMatches
    };
}

// Choose the best books. Returns { picks, message }
function suggestBooks(candidates, preferences, savedBooks, authorCounts) {
    // Remove books that are already saved or have no clear author
    const freshBooks = candidates.filter(function(book) {
        const alreadySaved = savedBooks.some(function(savedBook) {
            return savedBook.key === book.key;
        });

        return !alreadySaved && book.author !== 'Unknown Author';
    });

    if (freshBooks.length === 0) {
        return {
            picks: [],
            message: 'No suitable books were found. Try another genre or remove some filters.'
        };
    }

    const scored = freshBooks.map(function(book) {
        return scoreBook(book, preferences, authorCounts);
    });

    // Highest score first
    scored.sort(function(a, b) {
        return b.score - a.score;
    });

    // Best case: books that match everything the user asked for
    const exactMatches = scored.filter(function(item) {
        return item.matchesAll;
    });

    let chosen;
    let message = '';

    if (exactMatches.length > 0) {
        chosen = exactMatches;
    } else {
        // Fallback: nothing matched every choice, so show the closest books
        chosen = scored;
        message = 'No book matched all your choices, so here are the closest matches.';
    }

    const picks = chosen.slice(0, 6).map(function(item) {
        const bookData = item.book.toJSON();
        bookData.reasons = item.reasons;

        return new RecommendedBook(bookData);
    });

    return { picks: picks, message: message };
}


// Navigation (3 pages)
const discoveryBtn = document.getElementById('discoveryBtn');
const readingBtn = document.getElementById('readingBtn');
const progressBtn = document.getElementById('progressBtn');

const discoveryPage = document.getElementById('discoveryPage');
const readingPage = document.getElementById('readingPage');
const progressPage = document.getElementById('progressPage');

const navCount = document.getElementById('navCount');

function showPage(pageName) {
    discoveryPage.style.display = pageName === 'discovery' ? 'block' : 'none';
    readingPage.style.display = pageName === 'reading' ? 'block' : 'none';
    progressPage.style.display = pageName === 'progress' ? 'block' : 'none';

    discoveryBtn.classList.toggle('active', pageName === 'discovery');
    readingBtn.classList.toggle('active', pageName === 'reading');
    progressBtn.classList.toggle('active', pageName === 'progress');

    // Refresh the page each time it is opened
    if (pageName === 'reading') {
        displayReadingList();
    }

    if (pageName === 'progress') {
        displayProgress();
    }
}

discoveryBtn.addEventListener('click', function() {
    showPage('discovery');
});

readingBtn.addEventListener('click', function() {
    showPage('reading');
});

progressBtn.addEventListener('click', function() {
    showPage('progress');
});

// Small number beside "My Reading List"
function updateNavCount() {
    navCount.textContent = myLibrary.getBooks().length;
}


// Connecting Page 1 and Page 2
// Both pages share myLibrary (saved in Local Storage as JSON).
// These two functions move the user between the pages.
// PAGE 1 -> PAGE 2: open the reading list and highlight the saved book
function goToReadingList(bookKey) {
    closeAllModals();
    showPage('reading');
    highlightBookInList(bookKey);
}

// PAGE 2 -> PAGE 1: search the API again for more books by the same author
function findMoreByAuthor(authorName) {
    closeAllModals();
    showPage('discovery');

    searchInput.value = authorName.split(',')[0].trim();
    searchType.value = 'author';
    searchBooks();
}


// Discover page: tabs
// Search results, Browse Store and Suggest For Me share one page.
const searchPanel = document.getElementById('searchPanel');
const browsePanel = document.getElementById('browsePanel');
const suggestPanel = document.getElementById('suggestPanel');
const tabButtons = document.querySelectorAll('.tab-btn');

let activeTab = 'browse';

function showDiscoverTab(tabName) {
    activeTab = tabName;

    searchPanel.style.display = 'none';
    browsePanel.style.display = tabName === 'browse' ? 'block' : 'none';
    suggestPanel.style.display = tabName === 'suggest' ? 'block' : 'none';

    tabButtons.forEach(function(button) {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });
}

// Search results replace the tab content, right under the search box
function showSearchResultsPanel() {
    searchPanel.style.display = 'block';
    browsePanel.style.display = 'none';
    suggestPanel.style.display = 'none';

    tabButtons.forEach(function(button) {
        button.classList.remove('active');
    });
}

tabButtons.forEach(function(button) {
    button.addEventListener('click', function() {
        showDiscoverTab(button.dataset.tab);
    });
});


// Search books using open library API
const searchInput = document.getElementById('searchInput');
const searchType = document.getElementById('searchType');
const searchBtn = document.getElementById('searchBtn');
const searchMessage = document.getElementById('searchMessage');
const searchTitle = document.getElementById('searchTitle');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const bookResults = document.getElementById('bookResults');

async function searchBooks() {
    const search = searchInput.value.trim();

    // Error handling 1: invalid (empty or too short) input
    if (search === '') {
        showFormMessage(searchMessage, 'Please enter a book title or author.');
        searchInput.focus();
        return;
    }

    if (search.length < 2) {
        showFormMessage(searchMessage, 'Please type at least 2 characters.');
        return;
    }

    showFormMessage(searchMessage, '');

    searchTitle.textContent = 'Searching for "' + search + '"...';
    showSearchResultsPanel();
    showSkeletons(bookResults, 3, 'skeleton-card');

    searchBtn.disabled = true;

    try {
        // Ask the API (see core.js) - the dropdown decides the search type
        const docs = await fetchSearchResults(searchType.value, search);

        // Error handling 2: empty results
        if (docs.length === 0) {
            searchTitle.textContent = 'No results for "' + search + '"';

            bookResults.replaceChildren(
                createEmptyState('search', 'No books found', 'Try another title or author name.')
            );
            return;
        }

        searchTitle.textContent =
            docs.length + ' results for "' + search + '"';

        bookResults.innerHTML = '';

        docs.forEach(function(bookData, index) {
            const book = createBookObject(bookData);
            const card = createBookCard(book, 'search');

            card.style.setProperty('--i', index);
            bookResults.appendChild(card);
        });

    } catch (error) {
        // Error handling 3: failed API request
        console.error('Book search error:', error);

        searchTitle.textContent = 'Search failed';

        bookResults.replaceChildren(
            createEmptyState(
                'offline',
                'Unable to retrieve books',
                'Please check your internet connection and try again.',
                'Try again',
                searchBooks
            )
        );

    } finally {
        searchBtn.disabled = false;
    }
}

searchBtn.addEventListener('click', searchBooks);

// Press Enter to search
searchInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        searchBooks();
    }
});

// Clear the error message while the user types again
searchInput.addEventListener('input', function() {
    showFormMessage(searchMessage, '');
});

// "Clear search" goes back to the tab the user was on
clearSearchBtn.addEventListener('click', function() {
    searchInput.value = '';
    showDiscoverTab(activeTab);
});

// Quick search examples
document.querySelectorAll('.try-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
        searchInput.value = chip.dataset.query;
        searchType.value = 'q';
        searchBooks();
    });
});


// Suggest for me (genre chips + recommendation system)
const recommendBtn = document.getElementById('recommendBtn');
const recommendMessage = document.getElementById('recommendMessage');
const lengthSelect = document.getElementById('lengthSelect');
const eraSelect = document.getElementById('eraSelect');
const authorInput = document.getElementById('authorInput');

const recommendationResults =
    document.getElementById('recommendationResults');

let selectedGenre = '';

const genreChips = document.querySelectorAll('.genre-chip');

genreChips.forEach(function(chip) {
    chip.addEventListener('click', function() {

        // Remove selected style from other chips
        genreChips.forEach(function(item) {
            item.classList.remove('selected');
        });

        // Select clicked genre
        chip.classList.add('selected');
        selectedGenre = chip.dataset.genre;

        showFormMessage(recommendMessage, '');
    });
});

// Show recommended books on the screen
function displayRecommendations(picks, genre, message, scrollToResults) {
    recommendationResults.innerHTML = '';

    const heading = el('h3', 'store-title', 'Recommended ' + genre + ' books for you');
    recommendationResults.appendChild(heading);

    if (message !== '') {
        const note = el('p', 'result-note', message);
        recommendationResults.appendChild(note);
    }

    const bookGrid = el('div', 'recommendation-grid');

    picks.forEach(function(recommendedBook, index) {
        const card = createBookCard(recommendedBook, 'recommendation');

        card.style.setProperty('--i', index);
        bookGrid.appendChild(card);
    });

    recommendationResults.appendChild(bookGrid);

    // Scroll to the results
    if (scrollToResults) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

recommendBtn.addEventListener('click', async function() {

    // Error handling: no genre selected
    if (selectedGenre === '') {
        showFormMessage(recommendMessage, 'Please choose a genre first.');
        return;
    }

    showFormMessage(recommendMessage, '');

    const preferences = {
        genre: selectedGenre,
        length: lengthSelect.value,
        era: eraSelect.value,
        author: authorInput.value.trim().toLowerCase()
    };

    recommendationResults.innerHTML = '';

    const loadingGrid = el('div', 'recommendation-grid');
    showSkeletons(loadingGrid, 3, 'skeleton-rec');
    recommendationResults.appendChild(loadingGrid);

    recommendBtn.disabled = true;

    try {
        // A random page gives different books every time
        const page = Math.floor(Math.random() * 3) + 1;
        let docs = await fetchGenreBooks(preferences.genre, preferences.author, page);

        // If that page is empty, go back to page 1
        if (docs.length === 0 && page !== 1) {
            docs = await fetchGenreBooks(preferences.genre, preferences.author, 1);
        }

        // Convert JSON data into Book objects (keep books with a title)
        const candidates = docs
            .filter(function(bookData) {
                return bookData.title && bookData.author_name;
            })
            .map(function(bookData) {
                return createBookObject(bookData);
            });

        // Our own suggestion logic chooses the books
        const result = suggestBooks(
            candidates,
            preferences,
            myLibrary.getBooks(),
            myLibrary.getAuthorCounts()
        );

        // Store the suggestions in Local Storage
        try {
            localStorage.setItem(
                'myRecommendations',
                JSON.stringify({
                    genre: preferences.genre,
                    message: result.message,
                    books: result.picks.map(function(book) {
                        return book.toJSON();
                    })
                })
            );
        } catch (storageError) {
            console.error('Unable to save recommendations:', storageError);
            showToast('Suggestions could not be saved for next time.', 'error');
        }

        // Error handling: no suitable suggestion
        if (result.picks.length === 0) {
            recommendationResults.replaceChildren(
                createEmptyState('help', 'No suitable books found', result.message)
            );
            return;
        }

        displayRecommendations(result.picks, preferences.genre, result.message, true);

    } catch (error) {
        // Error handling: failed API request
        console.error('Recommendation error:', error);

        recommendationResults.replaceChildren(
            createEmptyState(
                'offline',
                'Unable to load recommendations',
                'Please check your internet connection and try again.'
            )
        );

    } finally {
        recommendBtn.disabled = false;
    }
});

// Show the last suggestions again when the app is reopened
function restoreRecommendations() {
    try {
        const stored = JSON.parse(localStorage.getItem('myRecommendations'));

        if (stored && stored.books && stored.books.length > 0) {
            const picks = stored.books.map(function(bookData) {
                return new RecommendedBook(bookData);
            });

            displayRecommendations(picks, stored.genre, stored.message || '', false);
        }
    } catch (error) {
        console.error('Unable to restore recommendations:', error);
    }
}


// Browse store (featured collection, top rated and shelves)
// Each section has its own Open Library search (array of objects)
const storeSectionList = [
    { id: 'toprated', title: 'Top Rated', query: 'subject:classics', style: 'ranked' },
    { id: 'fiction', title: 'Fiction & Literature', query: 'subject:fiction', style: 'shelf' },
    { id: 'kids', title: 'Kids & Young Adult', query: 'subject:"young adult"', style: 'shelf' },
    { id: 'mystery', title: 'Mystery & Thriller', query: 'subject:mystery', style: 'shelf' },
    { id: 'scifi', title: 'Science Fiction & Fantasy', query: 'subject:"science fiction"', style: 'shelf' }
];

// The featured collection changes every day
const featuredGenres = ['biography', 'history', 'romance', 'horror', 'fantasy'];

const storeContent = document.getElementById('storeContent');

let storeBuilt = false;

// Pop-up with the full details of one book

function showBookDetails(book) {
    const content = el('div', 'details-content');

    const coverBox = el('div', 'details-cover');
    coverBox.appendChild(createBookCover(book));

    const text = el('div', 'details-text');

    const title = el('h4', '', book.title);

    const author = el('p', 'book-author', book.author);

    const lines = el('div', 'info-grid');
    lines.append(
        createInfoLine('Genre:', book.genre),
        createInfoLine('Published:', book.year),
        createInfoLine('Pages:', book.pagesNumber > 0 ? book.pagesNumber : 'Not available')
    );

    text.append(title, author, lines);

    if (book.apiRating > 0) {
        text.appendChild(createRatingBadge(book));
    }

    text.appendChild(createSaveButton(book));

    content.append(coverBox, text);

    openModal('Book details', content);
}

// Small building blocks

// One clickable cover (used in shelves and in the featured collection)
function createCoverButton(book, className) {
    const button = document.createElement('button');
    button.classList.add(className);
    button.setAttribute('aria-label', 'View details of ' + book.title);

    button.appendChild(createBookCover(book));

    button.addEventListener('click', function() {
        showBookDetails(book);
    });

    return button;
}

function createSectionHeading(title) {
    const heading = el('h3', 'store-title', title);

    return heading;
}

// Message shown inside a section when it fails, with a Try again button
function showSectionProblem(section, message, retry) {
    const box = el('div', 'section-problem');

    const text = el('p', '', message);

    const retryButton = el('button', 'btn-secondary', 'Try again');
    retryButton.addEventListener('click', retry);

    box.append(text, retryButton);

    section.querySelector('.section-body').replaceChildren(box);
}

// Featured collection (tilted covers on a banner)

async function buildFeaturedCollection(section) {
    // Pick today's genre (changes every day)
    const dayNumber = Math.floor(Date.now() / 86400000);
    const genre = featuredGenres[dayNumber % featuredGenres.length];

    const body = section.querySelector('.section-body');

    const label = section.querySelector('.featured-name');
    label.textContent = genre.charAt(0).toUpperCase() + genre.slice(1);

    try {
        const books = await fetchStoreBooks('subject:' + genre);

        if (books.length === 0) {
            showSectionProblem(section, 'No books found for this collection.', function() {
                buildFeaturedCollection(section);
            });
            return;
        }

        const collage = el('div', 'featured-collage');

        books.slice(0, 5).forEach(function(book) {
            collage.appendChild(createCoverButton(book, 'featured-cover'));
        });

        body.replaceChildren(collage);

    } catch (error) {
        console.error('Featured collection error:', error);

        showSectionProblem(section, 'Unable to load the featured collection.', function() {
            buildFeaturedCollection(section);
        });
    }
}

// Top rated (ranked list)

function buildRankedList(books) {
    // Sort by the reader rating, highest first (our own sorting logic)
    const ranked = books
        .filter(function(book) {
            return book.apiRating > 0;
        })
        .sort(function(a, b) {
            return b.apiRating - a.apiRating;
        })
        .slice(0, 5);

    // Boundary case: the API gave no ratings, so use the original order
    const finalList = ranked.length > 0 ? ranked : books.slice(0, 5);

    const list = el('div', 'ranked-list');

    finalList.forEach(function(book, index) {
        const row = el('button', 'ranked-row');
        row.style.setProperty('--i', index);

        const number = el('span', 'rank-number', index + 1);

        const coverBox = el('div', 'ranked-cover');
        coverBox.appendChild(createBookCover(book));

        const info = el('div', 'ranked-info');

        const title = el('strong', '', book.title);

        const author = el('span', '', book.author);

        info.append(title, author);

        if (book.apiRating > 0) {
            const rating = el('em', '', '★ ' + book.apiRating.toFixed(1));
            info.appendChild(rating);
        }

        row.append(coverBox, number, info);

        row.addEventListener('click', function() {
            showBookDetails(book);
        });

        list.appendChild(row);
    });

    return list;
}

// Shelf (row of covers you can scroll sideways)

function buildShelf(books) {
    const shelf = el('div', 'shelf');

    books.slice(0, 12).forEach(function(book, index) {
        const item = el('div', 'shelf-item');
        item.style.setProperty('--i', index);

        item.appendChild(createCoverButton(book, 'shelf-cover'));

        const title = el('p', 'shelf-title', book.title);

        const author = el('p', 'shelf-author', book.author);

        item.append(title, author);
        shelf.appendChild(item);
    });

    return shelf;
}

// Fill one normal section with books
async function loadStoreSection(sectionInfo, section) {
    const body = section.querySelector('.section-body');

    body.innerHTML = '';

    const skeleton = el('div', 'skeleton skeleton-shelf');
    body.appendChild(skeleton);

    try {
        const books = await fetchStoreBooks(sectionInfo.query);

        if (books.length === 0) {
            showSectionProblem(section, 'No books found in this section.', function() {
                loadStoreSection(sectionInfo, section);
            });
            return;
        }

        body.replaceChildren(
            sectionInfo.style === 'ranked' ? buildRankedList(books) : buildShelf(books)
        );

    } catch (error) {
        console.error('Store section error:', error);

        showSectionProblem(section, 'Unable to load "' + sectionInfo.title + '". Check your connection.', function() {
            loadStoreSection(sectionInfo, section);
        });
    }
}

// Build the whole Browse tab (only once)
function displayBookStore() {
    if (storeBuilt) {
        return;
    }

    storeBuilt = true;
    storeContent.innerHTML = '';

    // Featured collection banner
    const featured = el('section', 'store-section');

    featured.innerHTML =
        '<p class="eyebrow">FEATURED COLLECTION</p>' +
        '<h3 class="featured-name store-title"></h3>' +
        '<div class="section-body"><div class="skeleton skeleton-banner"></div></div>';

    storeContent.appendChild(featured);
    buildFeaturedCollection(featured);

    // Normal sections
    storeSectionList.forEach(function(sectionInfo) {
        const section = el('section', 'store-section');

        section.appendChild(createSectionHeading(sectionInfo.title));

        const body = el('div', 'section-body');
        section.appendChild(body);

        storeContent.appendChild(section);

        loadStoreSection(sectionInfo, section);
    });
}
