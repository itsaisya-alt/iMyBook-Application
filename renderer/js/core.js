/* core.js - shared code: OOP classes, helper functions, API requests */


// Book class (parent class)
class Book {
    #key;
    #title;
    #author;
    #genre;
    #year;
    #pages;
    #cover;
    #coverUrls;
    #apiRating;

    constructor(bookData = {}) {
        this.#key = bookData.key || '';
        this.#title = bookData.title || 'Unknown Title';
        this.#author = bookData.author || 'Unknown Author';
        this.#genre = bookData.genre || 'Not available';
        this.#year = bookData.year || 'Not available';
        this.#pages = bookData.pages || 'Not available';
        this.#cover = bookData.cover || '';
        this.#coverUrls = bookData.coverUrls || [];
        this.#apiRating = bookData.apiRating || 0;
    }

    // Getters
    get key() {
        return this.#key;
    }

    get title() {
        return this.#title;
    }

    get author() {
        return this.#author;
    }

    get genre() {
        return this.#genre;
    }

    get year() {
        return this.#year;
    }

    get pages() {
        return this.#pages;
    }

    get cover() {
        return this.#cover;
    }

    get coverUrls() {
        return this.#coverUrls;
    }

    get apiRating() {
        return this.#apiRating;
    }

    // Pages as a number (0 when the API does not know the page count)
    get pagesNumber() {
        return Number(this.#pages) > 0 ? Number(this.#pages) : 0;
    }

    // Setters (with simple validation)
    set title(newTitle) {
        if (newTitle && newTitle.trim() !== '') {
            this.#title = newTitle;
        }
    }

    set pages(newPages) {
        if (Number(newPages) > 0) {
            this.#pages = Number(newPages);
        } else {
            this.#pages = 'Not available';
        }
    }

    // Method
    displayInfo() {
        return this.#title + ' by ' + this.#author;
    }

    // Convert book object into normal data
    toJSON() {
        return {
            key: this.#key,
            title: this.#title,
            author: this.#author,
            genre: this.#genre,
            year: this.#year,
            pages: this.#pages,
            cover: this.#cover,
            coverUrls: this.#coverUrls,
            apiRating: this.#apiRating
        };
    }
}


// Saved book class (child class)
class SavedBook extends Book {
    #status;
    #pagesRead;
    #myRating;
    #notes;
    #dateAdded;
    #dateCompleted;

    constructor(bookData = {}) {
        super(bookData);

        this.#status = bookData.status || 'Want to Read';
        this.#pagesRead = Number(bookData.pagesRead) || 0;
        this.#myRating = Number(bookData.myRating) || 0;
        this.#notes = bookData.notes || '';
        this.#dateAdded = bookData.dateAdded || Date.now();
        this.#dateCompleted = Number(bookData.dateCompleted) || 0;
    }

    get status() {
        return this.#status;
    }

    set status(newStatus) {
        const validStatuses = [
            'Want to Read',
            'Currently Reading',
            'Completed'
        ];

        if (validStatuses.includes(newStatus)) {
            this.#status = newStatus;
        }
    }

    get pagesRead() {
        return this.#pagesRead;
    }

    get myRating() {
        return this.#myRating;
    }

    get notes() {
        return this.#notes;
    }

    get dateAdded() {
        return this.#dateAdded;
    }

    // The year this book was finished (0 if it is not completed).
    get completedYear() {
        if (this.#status !== 'Completed') {
            return 0;
        }

        return new Date(this.#dateCompleted || this.#dateAdded).getFullYear();
    }

    get dateCompleted() {
        return this.#dateCompleted || this.#dateAdded;
    }

    // Calculation: reading progress in percent
    get progressPercent() {
        if (this.pagesNumber === 0) {
            return 0;
        }

        return Math.min(
            100,
            Math.round((this.#pagesRead / this.pagesNumber) * 100)
        );
    }

    // Calculation: pages that are still unread
    get remainingPages() {
        return Math.max(0, this.pagesNumber - this.#pagesRead);
    }

    // Private method (abstraction): checks every value before anything is changed
    #validate(details) {
        // 1. Validate total pages
        const totalText = String(details.pages).trim();
        const total = totalText === '' ? 0 : Number(totalText);

        if (totalText !== '' &&
            (!Number.isInteger(total) || total < 1 || total > 20000)) {
            return {
                ok: false,
                message: 'Total pages must be a whole number between 1 and 20000.'
            };
        }

        // 2. Validate pages read
        const readText = String(details.pagesRead).trim();
        const read = readText === '' ? 0 : Number(readText);

        if (!Number.isInteger(read) || read < 0) {
            return {
                ok: false,
                message: 'Pages read must be a whole number (0 or more).'
            };
        }

        if (total === 0 && read > 0) {
            return {
                ok: false,
                message: 'Please enter the total number of pages first.'
            };
        }

        if (total > 0 && read > total) {
            return {
                ok: false,
                message: 'Pages read cannot be more than the total pages (' + total + ').'
            };
        }

        // 3. Validate rating and notes
        const rating = Number(details.myRating);

        if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
            return { ok: false, message: 'Rating must be 0 (not rated) or 1 to 5 stars.' };
        }

        if (details.notes.length > 300) {
            return { ok: false, message: 'Notes can be up to 300 characters only.' };
        }

        return { ok: true, total: total, read: read, rating: rating };
    }

    // Update the user's own details. Returns { ok, message }.
    update(details) {
        const check = this.#validate(details);

        if (!check.ok) {
            return check;
        }

        const total = check.total;
        let read = check.read;
        const rating = check.rating;

        // 4. Decide the final status (control statements)
        let status = details.status;

        if (status === 'Completed' && total > 0) {
            read = total;                       // completed = every page read
        } else if (total > 0 && read === total) {
            status = 'Completed';               // every page read = completed
        } else if (read > 0 && status === 'Want to Read') {
            status = 'Currently Reading';       // started reading
        }

        // 5. Everything is valid, so save the changes
        this.pages = total;
        this.#pagesRead = read;
        this.#myRating = rating;
        this.#notes = details.notes.trim();

        // Remember the day the book was finished
        if (status === 'Completed' && this.#status !== 'Completed') {
            this.#dateCompleted = Date.now();
        } else if (status !== 'Completed') {
            this.#dateCompleted = 0;
        }

        this.status = status;

        return { ok: true, message: 'Changes saved.' };
    }

    // Polymorphism: override parent method
    displayInfo() {
        return super.displayInfo() + ' - ' + this.#status;
    }

    toJSON() {
        const data = super.toJSON();

        data.status = this.#status;
        data.pagesRead = this.#pagesRead;
        data.myRating = this.#myRating;
        data.notes = this.#notes;
        data.dateAdded = this.#dateAdded;
        data.dateCompleted = this.#dateCompleted;

        return data;
    }
}


// Recommended book class (child class)
class RecommendedBook extends Book {
    #reasons;

    constructor(bookData = {}) {
        super(bookData);

        // Why the suggestion logic chose this book
        this.#reasons = bookData.reasons || [];
    }

    get reasons() {
        return this.#reasons;
    }

    // Polymorphism: override parent method
    displayInfo() {
        return 'Recommended: ' + super.displayInfo();
    }

    toJSON() {
        const data = super.toJSON();

        data.reasons = this.#reasons;

        return data;
    }
}


// Reading library class (CRUD + local storage)
class ReadingLibrary {
    #books;

    constructor() {
        this.#books = [];
        this.loadBooks();
    }

    // Read: load books from Local Storage
    loadBooks() {
        try {
            const savedData =
                JSON.parse(localStorage.getItem('myReadingList')) || [];

            this.#books = savedData.map(function(book) {
                return new SavedBook(book);
            });

        } catch (error) {
            console.error('Unable to load reading list:', error);
            this.#books = [];
        }
    }

    // Read: get saved books
    getBooks() {
        return this.#books;
    }

    findBook(bookKey) {
        return this.#books.find(function(book) {
            return book.key === bookKey;
        });
    }

    // Save books to Local Storage
    saveToStorage() {
        try {
            localStorage.setItem(
                'myReadingList',
                JSON.stringify(this.#books)
            );
            return true;
        } catch (error) {
            console.error('Unable to save reading list:', error);
            return false;
        }
    }

    // Create: add a book
    addBook(book) {
        if (this.findBook(book.key)) {
            return {
                ok: false,
                message: '"' + book.title + '" is already in your reading list.'
            };
        }

        const bookData = book.toJSON();
        bookData.status = 'Want to Read';

        const newBook = new SavedBook(bookData);

        this.#books.push(newBook);

        if (!this.saveToStorage()) {
            this.#books.pop();
            return { ok: false, message: 'Could not save the book. Storage may be full.' };
        }

        return { ok: true, message: '"' + book.title + '" was added to your reading list.' };
    }

    // Update: change details (status, pages, progress, rating, notes)
    updateBook(bookKey, details) {
        const book = this.findBook(bookKey);

        if (!book) {
            return { ok: false, message: 'Book not found.' };
        }

        const result = book.update(details);

        if (result.ok && !this.saveToStorage()) {
            // Saving failed, so load the last saved list again
            this.loadBooks();
            return { ok: false, message: 'Could not save your changes. Storage may be full.' };
        }

        return result;
    }

    // Delete: remove a book
    removeBook(bookKey) {
        const oldBooks = this.#books;

        this.#books = this.#books.filter(function(book) {
            return book.key !== bookKey;
        });

        if (!this.saveToStorage()) {
            this.#books = oldBooks;
            return { ok: false, message: 'Could not remove the book. Please try again.' };
        }

        return { ok: true, message: 'The book was removed.' };
    }

    // Count how many saved books each author has (uses a Map)
    getAuthorCounts() {
        const counts = new Map();

        this.#books.forEach(function(book) {
            const mainAuthor = book.author.split(',')[0].trim().toLowerCase();
            counts.set(mainAuthor, (counts.get(mainAuthor) || 0) + 1);
        });

        return counts;
    }
}


// Create ReadingLibrary object
const myLibrary = new ReadingLibrary();


// Reading goals class
class ReadingGoals {
    #dailyGoal;     // minutes per day
    #yearlyGoal;    // books per year
    #log;           // Map: date text -> seconds read that day

    constructor() {
        this.#dailyGoal = 5;
        this.#yearlyGoal = 4;
        this.#log = new Map();
        this.load();
    }

    load() {
        try {
            const data = JSON.parse(localStorage.getItem('myReadingGoals'));

            if (data) {
                this.#dailyGoal = Number(data.dailyGoal) || 5;
                this.#yearlyGoal = Number(data.yearlyGoal) || 4;
                this.#log = new Map(data.log || []);
            }
        } catch (error) {
            console.error('Unable to load reading goals:', error);
        }
    }

    save() {
        try {
            localStorage.setItem('myReadingGoals', JSON.stringify({
                dailyGoal: this.#dailyGoal,
                yearlyGoal: this.#yearlyGoal,
                log: Array.from(this.#log.entries())
            }));
        } catch (error) {
            console.error('Unable to save reading goals:', error);
        }
    }

    get dailyGoal() {
        return this.#dailyGoal;
    }

    get yearlyGoal() {
        return this.#yearlyGoal;
    }

    // Update goals. Returns { ok, message }
    setGoals(daily, yearly) {
        if (!Number.isInteger(daily) || daily < 1 || daily > 600) {
            return { ok: false, message: 'Daily goal must be a whole number from 1 to 600 minutes.' };
        }

        if (!Number.isInteger(yearly) || yearly < 1 || yearly > 365) {
            return { ok: false, message: 'Yearly goal must be a whole number from 1 to 365 books.' };
        }

        this.#dailyGoal = daily;
        this.#yearlyGoal = yearly;
        this.save();

        return { ok: true, message: 'Goals saved.' };
    }

    // Add reading time to a day
    addSeconds(dateKey, seconds) {
        this.#log.set(dateKey, (this.#log.get(dateKey) || 0) + seconds);
        this.save();
    }

    getSeconds(dateKey) {
        return this.#log.get(dateKey) || 0;
    }
}

const myGoals = new ReadingGoals();


// Feedback: toast and confirm box
// (used instead of alert() and confirm())
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');

    const toast = document.createElement('div');
    toast.classList.add('toast', 'toast-' + type);
    toast.textContent = message;

    container.appendChild(toast);

    // Remove the toast automatically after 3 seconds
    setTimeout(function() {
        toast.classList.add('toast-hide');

        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 3000);
}

// Shows an inline message under a form. Pass '' to clear it.
function showFormMessage(element, message, type = 'error') {
    element.textContent = message;
    element.className = 'form-message ' + (message ? 'show ' + type : '');
}

// Returns a Promise: true when the user clicks Yes, false otherwise
function showConfirm(message, confirmText = 'Yes, remove') {
    return new Promise(function(resolve) {
        const overlay = document.createElement('div');
        overlay.classList.add('modal-overlay');

        const box = document.createElement('div');
        box.classList.add('modal-box');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');

        const text = document.createElement('p');
        text.textContent = message;

        const buttons = document.createElement('div');
        buttons.classList.add('modal-buttons');

        const cancelButton = document.createElement('button');
        cancelButton.classList.add('btn-secondary');
        cancelButton.textContent = 'Cancel';

        const okButton = document.createElement('button');
        okButton.classList.add('btn-danger');
        okButton.textContent = confirmText;

        function close(answer) {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            resolve(answer);
        }

        function onKey(event) {
            if (event.key === 'Escape') {
                close(false);
            }
        }

        cancelButton.addEventListener('click', function() { close(false); });
        okButton.addEventListener('click', function() { close(true); });

        overlay.addEventListener('click', function(event) {
            if (event.target === overlay) {
                close(false);
            }
        });

        document.addEventListener('keydown', onKey);

        buttons.append(cancelButton, okButton);
        box.append(text, buttons);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        cancelButton.focus();
    });
}


// Message box with an icon (empty list or error)
const emptyIcons = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    offline: '<path d="M2 8.8a15 15 0 0 1 4-2.5M22 8.8a15 15 0 0 0-8-3.7M5 12.9a10 10 0 0 1 5-2.7M19 12.9a10 10 0 0 0-2-1.6M8.5 16.4a5 5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/><path d="M3 3l18 18"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>'
};

function createEmptyState(iconName, title, text, buttonText, buttonAction) {
    const box = document.createElement('div');
    box.classList.add('empty-state');

    const icon = document.createElement('div');
    icon.classList.add('empty-icon');
    icon.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + emptyIcons[iconName] + '</svg>';

    const heading = document.createElement('h3');
    heading.textContent = title;

    const message = document.createElement('p');
    message.textContent = text;

    box.append(icon, heading, message);

    if (buttonText) {
        const button = document.createElement('button');
        button.classList.add('btn-primary');
        button.textContent = buttonText;
        button.addEventListener('click', buttonAction);
        box.appendChild(button);
    }

    return box;
}


// Small helpers (pop-up windows, form fields)
// Short way to create an element: el('p', 'book-author', 'Some text')
function el(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}

// Opens a pop-up window. Returns a function that closes it.
function openModal(title, bodyElement) {
    const overlay = document.createElement('div');
    overlay.classList.add('modal-overlay');

    const box = document.createElement('div');
    box.classList.add('modal-box', 'modal-wide');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');

    const header = document.createElement('div');
    header.classList.add('modal-header');

    const heading = document.createElement('h3');
    heading.textContent = title;

    const closeButton = document.createElement('button');
    closeButton.classList.add('modal-close');
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.textContent = '×';

    header.append(heading, closeButton);

    function close() {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
    }

    function onKey(event) {
        if (event.key === 'Escape') {
            close();
        }
    }

    closeButton.addEventListener('click', close);

    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            close();
        }
    });

    document.addEventListener('keydown', onKey);

    box.append(header, bodyElement);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Put the cursor in the first input (if there is one)
    const firstInput = box.querySelector('input, select, textarea');

    if (firstInput) {
        firstInput.focus();
    }

    return close;
}

// Closes every pop-up window (used when changing page)
function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
        overlay.remove();
    });
}

// Create one small labelled form field
function createField(labelText, inputElement) {
    const label = document.createElement('label');
    label.classList.add('field');

    const text = document.createElement('span');
    text.textContent = labelText;

    label.append(text, inputElement);

    return label;
}

function createNumberInput(value, min, placeholder) {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = min;
    input.step = 1;
    input.value = value;
    input.placeholder = placeholder || '';

    return input;
}

// Grey shimmer boxes shown while the API is loading
function showSkeletons(container, count, className) {
    container.innerHTML = '';

    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('div');
        skeleton.classList.add('skeleton', className);
        container.appendChild(skeleton);
    }
}


// Date and time helpers
// Today's date as text, e.g. "2026-11-05" (used as the key of the reading log)
function toDateKey(date) {
    return date.getFullYear() + '-' + twoDigits(date.getMonth() + 1) + '-' + twoDigits(date.getDate());
}

// 5 -> "05"
function twoDigits(number) {
    if (number < 10) {
        return '0' + number;
    }

    return String(number);
}

// Seconds -> "m:ss"
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);

    return minutes + ':' + twoDigits(totalSeconds % 60);
}


// Create book object from API data (JSON processing)
const API_FIELDS =
    'key,title,author_name,subject,cover_i,cover_edition_key,isbn,first_publish_year,number_of_pages_median,ratings_average';

function createBookObject(book) {
    const title = book.title || 'Unknown Title';

    const author = book.author_name
        ? book.author_name.slice(0, 2).join(', ')
        : 'Unknown Author';

    // Keep only short, readable subject names
    let genre = 'Not available';

    if (book.subject) {
        const cleanSubjects = book.subject.filter(function(subject) {
            return subject.length <= 28;
        });

        if (cleanSubjects.length > 0) {
            genre = cleanSubjects.slice(0, 3).join(', ');
        }
    }

    const year = book.first_publish_year || 'Not available';

    const pages = book.number_of_pages_median || 'Not available';

    const apiRating = book.ratings_average
        ? Math.round(book.ratings_average * 10) / 10
        : 0;

    // Open Library gives several cover addresses.
    // "?default=false" gives an error (404) when a cover is missing, so the next address is tried.
    const coverUrls = [];

    if (book.cover_i) {
        coverUrls.push(
            `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg?default=false`
        );
    }

    if (book.cover_edition_key) {
        coverUrls.push(
            `https://covers.openlibrary.org/b/olid/${book.cover_edition_key}-M.jpg?default=false`
        );
    }

    if (book.isbn && book.isbn.length > 0) {
        coverUrls.push(
            `https://covers.openlibrary.org/b/isbn/${book.isbn[0]}-M.jpg?default=false`
        );
    }

    return new Book({
        key: book.key || title + author,
        title: title,
        author: author,
        genre: genre,
        year: year,
        pages: pages,
        apiRating: apiRating,
        cover: coverUrls[0] || '',
        coverUrls: coverUrls
    });
}


// API requests
// Search (Page 1)

// type is "q" (title or author), "title" or "author"
async function fetchSearchResults(type, search) {
    const url =
        `https://openlibrary.org/search.json?${type}=${encodeURIComponent(search)}&fields=${API_FIELDS}&limit=10`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Unable to retrieve books.');
    }

    // JSON processing: turn the response text into a JavaScript object
    const data = await response.json();

    return data.docs || [];
}

// Suggest For Me (Page 1)

// Get a list of books for one genre from Open Library
async function fetchGenreBooks(genre, author, page) {
    let url =
        `https://openlibrary.org/search.json?q=subject:${encodeURIComponent(genre)}&fields=${API_FIELDS}&limit=40&page=${page}`;

    if (author !== '') {
        url += `&author=${encodeURIComponent(author)}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Unable to retrieve recommendations.');
    }

    const data = await response.json();

    return data.docs || [];
}

// Browse Store (Page 1)

// Remember loaded sections so they are not downloaded again (Map)
const storeCache = new Map();


async function fetchStoreBooks(query) {
    if (storeCache.has(query)) {
        return storeCache.get(query);
    }

    const url =
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&fields=${API_FIELDS}&limit=40`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error('Unable to load this section.');
    }

    const data = await response.json();

    const books = (data.docs || [])
        .filter(function(bookData) {
            return bookData.title && bookData.author_name;
        })
        .map(function(bookData) {
            return createBookObject(bookData);
        });

    // Books that have a cover come first
    const withCover = books.filter(function(book) {
        return book.coverUrls.length > 0;
    });

    const result = withCover.length >= 6 ? withCover : books;

    storeCache.set(query, result);

    return result;
}

// Book details (Page 2 also uses the API)

// Gets the details of one book from the Open Library "works" API.
async function fetchWorkDetails(workKey) {
    // Request 1: the book details
    const workResponse = await fetch(`https://openlibrary.org${workKey}.json`);

    // Request 2: the ratings (optional, so a failure must not stop the details)
    let ratingResponse = null;

    try {
        ratingResponse = await fetch(`https://openlibrary.org${workKey}/ratings.json`);
    } catch (error) {
        console.log('Ratings not available:', error);
    }

    if (!workResponse.ok) {
        throw new Error('Unable to load book details.');
    }

    const work = await workResponse.json();

    // The description can be plain text or an object with a value
    let description = 'No description is available for this book.';

    if (typeof work.description === 'string') {
        description = work.description;
    } else if (work.description && work.description.value) {
        description = work.description.value;
    }

    // Remove the extra links Open Library adds after the description
    description = description.split('----------')[0].trim();

    if (description.length > 700) {
        description = description.slice(0, 700).trim() + '...';
    }

    // The ratings are optional
    let ratingAverage = 0;
    let ratingCount = 0;

    if (ratingResponse && ratingResponse.ok) {
        const ratingData = await ratingResponse.json();

        if (ratingData.summary && ratingData.summary.count > 0) {
            ratingAverage = Math.round(ratingData.summary.average * 10) / 10;
            ratingCount = ratingData.summary.count;
        }
    }

    return {
        description: description,
        subjects: (work.subjects || []).slice(0, 6),
        firstPublished: work.first_publish_date || 'Not available',
        ratingAverage: ratingAverage,
        ratingCount: ratingCount
    };
}
