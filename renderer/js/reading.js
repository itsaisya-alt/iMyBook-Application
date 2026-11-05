/* reading.js - PAGE 2 (My Reading List) + PAGE 3 (Reading Progress) + app start */


// My reading list (read, update, delete)
let activeFilter = 'all';

const readingList = document.getElementById('readingList');
const listSearch = document.getElementById('listSearch');
const listSort = document.getElementById('listSort');
const statusFilters = document.querySelectorAll('.filter-chip');

// Pop-up: edit the details of a saved book (UPDATE)

function openEditModal(book) {
    const form = el('div', 'edit-form');

    const statusSelect = document.createElement('select');

    ['Want to Read', 'Currently Reading', 'Completed'].forEach(function(status) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        statusSelect.appendChild(option);
    });

    statusSelect.value = book.status;

    const pagesInput = createNumberInput(
        book.pagesNumber > 0 ? book.pagesNumber : '', 1, 'Unknown'
    );

    const readInput = createNumberInput(book.pagesRead, 0, '0');

    const ratingSelect = document.createElement('select');

    for (let stars = 0; stars <= 5; stars++) {
        const option = document.createElement('option');
        option.value = stars;
        option.textContent = stars === 0
            ? 'Not rated'
            : '★'.repeat(stars) + '☆'.repeat(5 - stars);
        ratingSelect.appendChild(option);
    }

    ratingSelect.value = book.myRating;

    const notesInput = document.createElement('textarea');
    notesInput.rows = 3;
    notesInput.maxLength = 300;
    notesInput.placeholder = 'Your thoughts, favourite quotes...';
    notesInput.value = book.notes;

    const notesField = createField('My notes', notesInput);
    notesField.classList.add('field-wide');

    form.append(
        createField('Reading status', statusSelect),
        createField('My rating', ratingSelect),
        createField('Total pages', pagesInput),
        createField('Pages read', readInput),
        notesField
    );

    const formMessage = el('p', 'form-message');
    formMessage.setAttribute('role', 'alert');

    const actions = el('div', 'modal-buttons');

    const cancelButton = el('button', 'btn-secondary', 'Cancel');

    const saveButton = el('button', 'btn-primary', 'Save Changes');

    actions.append(cancelButton, saveButton);

    const body = document.createElement('div');

    const bookName = el('p', 'modal-subtitle', book.title);

    body.append(bookName, form, formMessage, actions);

    const close = openModal('Edit book', body);

    cancelButton.addEventListener('click', close);

    saveButton.addEventListener('click', function() {
        const result = myLibrary.updateBook(book.key, {
            status: statusSelect.value,
            pages: pagesInput.value,
            pagesRead: readInput.value,
            myRating: ratingSelect.value,
            notes: notesInput.value
        });

        if (result.ok) {
            showToast('"' + book.title + '" updated.');
            close();
            displayReadingList();
        } else {
            showFormMessage(formMessage, result.message);
        }
    });
}

// Pop-up: reading planner (CALCULATION)

function openPlannerModal(book) {
    const body = document.createElement('div');

    const bookName = el('p', 'modal-subtitle');

    bookName.textContent = book.pagesNumber > 0
        ? book.title + ' - ' + book.remainingPages + ' pages left'
        : book.title;

    const plannerForm = el('div', 'planner-form');

    const perDayInput = createNumberInput(20, 1, '20');
    const speedInput = createNumberInput(30, 1, '30');

    const calculateButton = el('button', 'btn-primary', 'Calculate');

    plannerForm.append(
        createField('Pages per day', perDayInput),
        createField('Reading speed (pages/hour)', speedInput),
        calculateButton
    );

    const plannerResult = el('div', 'planner-result');
    plannerResult.setAttribute('aria-live', 'polite');

    calculateButton.addEventListener('click', function() {
        const plan = calculateReadingPlan(
            book,
            Number(perDayInput.value),
            Number(speedInput.value)
        );

        plannerResult.innerHTML = '';
        plannerResult.classList.remove('error');

        if (!plan.ok) {
            plannerResult.classList.add('error');
            plannerResult.textContent = plan.message;
            return;
        }

        if (plan.finished) {
            plannerResult.textContent = 'You have already finished this book.';
            return;
        }

        const lines = [
            ['Pages left', plan.remaining + ' pages'],
            ['Days to finish', plan.days + (plan.days === 1 ? ' day' : ' days')],
            ['Daily reading time', plan.minutesPerDay + ' minutes'],
            ['Total reading time', plan.totalHours + ' hours'],
            ['Estimated finish date', plan.finishDate.toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric'
            })]
        ];

        lines.forEach(function(line) {
            const row = el('div', 'result-row');

            const label = el('span', '', line[0]);

            const value = el('strong', '', line[1]);

            row.append(label, value);
            plannerResult.appendChild(row);
        });
    });

    body.append(bookName, plannerForm, plannerResult);

    openModal('Reading planner', body);
}

// Pop-up: full details from the API (Page 2 uses the API too)

async function openDetailsModal(book) {
    const body = document.createElement('div');

    const loading = el('p', 'modal-subtitle', 'Loading details from Open Library...');
    body.appendChild(loading);

    const close = openModal(book.title, body);

    // Only books from Open Library have a "works" key
    if (!book.key.startsWith('/works/')) {
        loading.textContent = 'Details are not available for this book.';
        return;
    }

    try {
        const details = await fetchWorkDetails(book.key);

        body.innerHTML = '';

        const author = el('p', 'book-author', book.author);

        const description = el('p', 'about-text', details.description);

        const lines = el('div', 'info-grid');

        lines.appendChild(createInfoLine('First published:', details.firstPublished));

        // Show the average rating with a clear label and unit
        lines.appendChild(createInfoLine(
            'Reader rating:',
            details.ratingCount > 0
                ? details.ratingAverage.toFixed(1) + ' / 5 (' + details.ratingCount + ' ratings)'
                : 'Not rated yet'
        ));

        body.append(author, description, lines);

        if (details.subjects.length > 0) {
            const subjects = el('div', 'reason-list');

            details.subjects.forEach(function(subject) {
                const chip = el('span', 'reason-chip', subject);
                subjects.appendChild(chip);
            });

            body.appendChild(subjects);
        }

        // CONNECTING PAGE 2 AND PAGE 1
        const moreButton = el('button', 'btn-primary', 'More by this author →');
        moreButton.addEventListener('click', function() {
            findMoreByAuthor(book.author);
        });

        const actions = el('div', 'modal-buttons');
        actions.appendChild(moreButton);

        body.appendChild(actions);

    } catch (error) {
        // Error handling: failed API request
        console.error('Book details error:', error);

        body.replaceChildren(
            createEmptyState(
                'offline',
                'Unable to load details',
                'Please check your internet connection and try again.',
                'Try again',
                function() {
                    close();
                    openDetailsModal(book);
                }
            )
        );
    }
}

// Scroll to a saved book and highlight it (used when coming from Page 1)
function highlightBookInList(bookKey) {
    // Make sure the book is not hidden by a filter or a search word
    activeFilter = 'all';
    listSearch.value = '';

    statusFilters.forEach(function(chip) {
        chip.classList.toggle('selected', chip.dataset.filter === 'all');
    });

    displayReadingList();

    const card = readingList.querySelector('[data-key="' + CSS.escape(bookKey) + '"]');

    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight');

        setTimeout(function() {
            card.classList.remove('highlight');
        }, 2500);
    }
}

// A compact card for one saved book

function createSavedCard(book) {
    const card = el('div', 'library-card');
    card.dataset.key = book.key;
    card.setAttribute('aria-label', book.displayInfo());

    const coverBox = el('div', 'library-cover');
    coverBox.appendChild(createBookCover(book));

    const info = el('div', 'library-info');

    const title = el('h3', '', book.title);

    const author = el('p', 'book-author', book.author);

    // Status badge + the user's star rating
    const badges = el('div', 'badge-row');

    const badge = el('span', 'status-badge');
    badge.dataset.status = book.status;
    badge.textContent = book.status;

    badges.appendChild(badge);

    if (book.myRating > 0) {
        const stars = el('span', 'my-stars', '★'.repeat(book.myRating) + '☆'.repeat(5 - book.myRating));
        stars.title = 'Your rating';
        badges.appendChild(stars);
    }

    // Progress bar
    const progressWrap = el('div', 'mini-progress');

    const progressBar = el('div', 'progress-bar');

    const progressFill = el('div', 'progress-fill');
    progressFill.style.width = book.progressPercent + '%';

    progressBar.appendChild(progressFill);

    const progressText = document.createElement('span');

    if (book.pagesNumber > 0) {
        progressText.textContent =
            book.pagesRead + ' / ' + book.pagesNumber + ' pages (' + book.progressPercent + '%)';
    } else {
        progressText.textContent = 'Total pages unknown';
    }

    progressWrap.append(progressBar, progressText);

    info.append(title, author, badges, progressWrap);

    // Short preview of the user's notes
    if (book.notes !== '') {
        const note = el('p', 'note-snippet', '“' + book.notes + '”');
        info.appendChild(note);
    }

    // Buttons
    const actions = el('div', 'card-actions');

    const editButton = el('button', 'btn-secondary btn-small', 'Edit');
    editButton.addEventListener('click', function() {
        openEditModal(book);
    });

    const plannerButton = el('button', 'btn-secondary btn-small', 'Planner');
    plannerButton.addEventListener('click', function() {
        openPlannerModal(book);
    });

    const deleteButton = el('button', 'btn-danger-outline btn-small', 'Remove');

    deleteButton.addEventListener('click', async function() {
        const confirmDelete = await showConfirm(
            'Remove "' + book.title + '" from your reading list?'
        );

        if (confirmDelete) {
            const result = myLibrary.removeBook(book.key);

            if (result.ok) {
                showToast('"' + book.title + '" was removed.', 'info');
                updateNavCount();
                displayReadingList();
            } else {
                showToast(result.message, 'error');
            }
        }
    });

    const detailsButton = el('button', 'btn-secondary btn-small', 'Details');
    detailsButton.addEventListener('click', function() {
        openDetailsModal(book);
    });

    actions.append(editButton, plannerButton, detailsButton, deleteButton);
    info.appendChild(actions);

    card.append(coverBox, info);

    return card;
}

// Decide which saved books to show (filter + search + sort)
function getVisibleBooks() {
    let books = myLibrary.getBooks().slice();

    // Filter by reading status
    if (activeFilter !== 'all') {
        books = books.filter(function(book) {
            return book.status === activeFilter;
        });
    }

    // Search by title or author
    const searchText = listSearch.value.trim().toLowerCase();

    if (searchText !== '') {
        books = books.filter(function(book) {
            return book.title.toLowerCase().includes(searchText) ||
                book.author.toLowerCase().includes(searchText);
        });
    }

    // Sort
    switch (listSort.value) {
        case 'title':
            books.sort(function(a, b) {
                return a.title.localeCompare(b.title);
            });
            break;
        case 'progress':
            books.sort(function(a, b) {
                return b.progressPercent - a.progressPercent;
            });
            break;
        default:
            books.sort(function(a, b) {
                return b.dateAdded - a.dateAdded;
            });
    }

    return books;
}

function displayReadingList() {
    const savedBooks = myLibrary.getBooks();

    updateNavCount();

    // Show the number of books beside each filter
    statusFilters.forEach(function(chip) {
        const filter = chip.dataset.filter;

        const count = filter === 'all'
            ? savedBooks.length
            : savedBooks.filter(function(book) {
                return book.status === filter;
            }).length;

        chip.textContent =
            (filter === 'all' ? 'All' : filter) + ' (' + count + ')';
    });

    readingList.innerHTML = '';

    // Empty list
    if (savedBooks.length === 0) {
        readingList.appendChild(
            createEmptyState(
                'book',
                'Your reading list is empty',
                'Save books from Discover Books and they will appear here.',
                'Discover books',
                function() { showPage('discovery'); }
            )
        );
        return;
    }

    const visibleBooks = getVisibleBooks();

    // Nothing matches the filter or search
    if (visibleBooks.length === 0) {
        readingList.appendChild(
            createEmptyState('search', 'No books match', 'Try another filter or search word.')
        );
        return;
    }

    const grid = el('div', 'library-grid');

    visibleBooks.forEach(function(book, index) {
        const card = createSavedCard(book);

        card.style.setProperty('--i', index);
        grid.appendChild(card);
    });

    readingList.appendChild(grid);
}

// Filter chips
statusFilters.forEach(function(chip) {
    chip.addEventListener('click', function() {
        statusFilters.forEach(function(item) {
            item.classList.remove('selected');
        });

        chip.classList.add('selected');
        activeFilter = chip.dataset.filter;

        displayReadingList();
    });
});

listSearch.addEventListener('input', displayReadingList);
listSort.addEventListener('change', displayReadingList);


// Reading progress (statistics + reading goals)
const progressContent = document.getElementById('progressContent');

// A reading session that is running right now (null when stopped)
let readingSession = null;

// Pieces of the screen that the timer updates every second
let goalUi = null;

// The book the user is reading now (most recently added "Currently Reading")
function findCurrentBook() {
    const reading = myLibrary.getBooks().filter(function(book) {
        return book.status === 'Currently Reading';
    });

    reading.sort(function(a, b) {
        return b.dateAdded - a.dateAdded;
    });

    return reading[0] || null;
}

function startReading(book) {
    readingSession = {
        bookKey: book.key,
        bookTitle: book.title,
        startTime: Date.now(),
        timerId: setInterval(refreshGoalDisplay, 1000)
    };

    displayProgress();
}

function stopReading() {
    if (!readingSession) {
        return;
    }

    clearInterval(readingSession.timerId);

    const seconds = Math.round((Date.now() - readingSession.startTime) / 1000);

    readingSession = null;

    if (seconds < 1) {
        showToast('That session was too short to save.', 'warning');
    } else {
        myGoals.addSeconds(toDateKey(new Date()), seconds);
        showToast('Saved ' + formatTime(seconds) + ' of reading. Well done!');
    }

    displayProgress();
}

// Show today's time and the progress bar (runs every second while reading)
function refreshGoalDisplay() {
    if (!goalUi || !goalUi.time.isConnected) {
        return;
    }

    let seconds = myGoals.getSeconds(toDateKey(new Date()));

    if (readingSession) {
        seconds += Math.round((Date.now() - readingSession.startTime) / 1000);
    }

    const goalSeconds = myGoals.dailyGoal * 60;

    // Calculation: percentage of today's goal (never more than 100)
    let percent = (seconds / goalSeconds) * 100;

    if (percent > 100) {
        percent = 100;
    }

    goalUi.time.textContent = formatTime(seconds);
    goalUi.fill.style.width = percent + '%';

    if (seconds >= goalSeconds) {
        goalUi.caption.textContent = 'Daily goal reached (' + myGoals.dailyGoal + ' minutes)';
    } else {
        goalUi.caption.textContent = 'of your ' + myGoals.dailyGoal + '-minute goal';
    }
}


// Pop-ups: change goals / add minutes

function openGoalSettingsModal() {
    const form = el('div', 'goal-form');

    const dailyInput = createNumberInput(myGoals.dailyGoal, 1, '5');
    const yearlyInput = createNumberInput(myGoals.yearlyGoal, 1, '4');

    form.append(
        createField('Daily goal (minutes)', dailyInput),
        createField('Yearly goal (books)', yearlyInput)
    );

    const message = el('p', 'form-message');
    message.setAttribute('role', 'alert');

    const actions = el('div', 'modal-buttons');

    const cancelButton = el('button', 'btn-secondary', 'Cancel');

    const saveButton = el('button', 'btn-primary', 'Save Goals');

    actions.append(cancelButton, saveButton);

    const body = document.createElement('div');
    body.append(form, message, actions);

    const close = openModal('Set your goals', body);

    cancelButton.addEventListener('click', close);

    saveButton.addEventListener('click', function() {
        const result = myGoals.setGoals(
            Number(dailyInput.value),
            Number(yearlyInput.value)
        );

        if (result.ok) {
            showToast(result.message);
            close();
            displayProgress();
        } else {
            showFormMessage(message, result.message);
        }
    });
}

function openLogMinutesModal() {
    const minutesInput = createNumberInput('', 1, 'e.g. 20');

    const hint = el('p', 'modal-subtitle', 'Read without the timer? Add your minutes for today.');

    const message = el('p', 'form-message');
    message.setAttribute('role', 'alert');

    const actions = el('div', 'modal-buttons');

    const cancelButton = el('button', 'btn-secondary', 'Cancel');

    const addButton = el('button', 'btn-primary', 'Add Minutes');

    actions.append(cancelButton, addButton);

    const body = document.createElement('div');
    body.append(hint, createField('Minutes read', minutesInput), message, actions);

    const close = openModal('Log reading time', body);

    cancelButton.addEventListener('click', close);

    addButton.addEventListener('click', function() {
        const minutes = Number(minutesInput.value);

        // Input validation
        if (minutesInput.value.trim() === '' || !Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
            showFormMessage(message, 'Enter a whole number of minutes from 1 to 600.');
            return;
        }

        myGoals.addSeconds(toDateKey(new Date()), minutes * 60);
        showToast('Added ' + minutes + ' minutes to today.');
        close();
        displayProgress();
    });
}

// Pop-up: mark a book as finished (this is an UPDATE in CRUD)
function openLogBookModal() {
    // Only books that are not completed yet
    const unfinished = myLibrary.getBooks().filter(function(book) {
        return book.status !== 'Completed';
    });

    if (unfinished.length === 0) {
        showToast('No unfinished books. Save a book first.', 'info');
        return;
    }

    const bookSelect = document.createElement('select');

    unfinished.forEach(function(book) {
        const option = document.createElement('option');
        option.value = book.key;
        option.textContent = book.title;
        bookSelect.appendChild(option);
    });

    const hint = el('p', 'modal-subtitle', 'Finished a book? Choose it and mark it as completed.');

    const message = el('p', 'form-message');
    message.setAttribute('role', 'alert');

    const actions = el('div', 'modal-buttons');
    const cancelButton = el('button', 'btn-secondary', 'Cancel');
    const doneButton = el('button', 'btn-primary', 'Mark as Completed');
    actions.append(cancelButton, doneButton);

    const body = document.createElement('div');
    body.append(hint, createField('Book', bookSelect), message, actions);

    const close = openModal('Log a finished book', body);

    cancelButton.addEventListener('click', close);

    doneButton.addEventListener('click', function() {
        const book = myLibrary.findBook(bookSelect.value);

        // Completed means every page is read
        const result = myLibrary.updateBook(book.key, {
            status: 'Completed',
            pages: book.pagesNumber > 0 ? String(book.pagesNumber) : '',
            pagesRead: String(book.pagesNumber),
            myRating: book.myRating,
            notes: book.notes
        });

        if (result.ok) {
            showToast('"' + book.title + '" marked as completed.');
            close();
            displayProgress();
        } else {
            showFormMessage(message, result.message);
        }
    });
}

// Cards

function createProgressCard(extraClass) {
    const card = el('section', 'card goal-card');

    if (extraClass) {
        card.classList.add(extraClass);
    }

    return card;
}

// Four number cards: total, want to read, reading, completed
function buildOverviewCards() {
    const savedBooks = myLibrary.getBooks();

    function countStatus(status) {
        return savedBooks.filter(function(book) {
            return book.status === status;
        }).length;
    }

    const statistics = [
        { title: 'Total Books', number: savedBooks.length, tone: 'wine' },
        { title: 'Want to Read', number: countStatus('Want to Read'), tone: 'gold' },
        { title: 'Currently Reading', number: countStatus('Currently Reading'), tone: 'blue' },
        { title: 'Completed', number: countStatus('Completed'), tone: 'green' }
    ];

    const grid = el('div', 'statistics-grid');

    statistics.forEach(function(stat, index) {
        const card = document.createElement('div');
        card.classList.add('stat-card', 'tone-' + stat.tone);
        card.style.setProperty('--i', index);

        const number = el('h2', '', stat.number);

        const label = el('p', '', stat.title);

        card.append(number, label);
        grid.appendChild(card);
    });

    return grid;
}

function buildTodayCard() {
    const card = createProgressCard('today-card');

    const title = el('h3', '', 'Today\u2019s Reading');
    const time = el('div', 'today-time');
    const caption = el('div', 'today-caption');

    const progressBar = el('div', 'progress-bar progress-bar-large');
    const fill = el('div', 'progress-fill');
    progressBar.appendChild(fill);

    // Start / Stop button
    const readButton = el('button', 'keep-reading');
    const buttonTitle = document.createElement('strong');
    const buttonSub = document.createElement('span');

    const currentBook = findCurrentBook();

    if (readingSession) {
        readButton.classList.add('running');
        buttonTitle.textContent = 'Stop & Save';
        buttonSub.textContent = 'Reading: ' + readingSession.bookTitle;

        readButton.addEventListener('click', stopReading);

    } else if (currentBook) {
        buttonTitle.textContent = 'Keep Reading';
        buttonSub.textContent = currentBook.title;

        readButton.addEventListener('click', function() {
            startReading(currentBook);
        });

    } else {
        buttonTitle.textContent = 'Start a book';
        buttonSub.textContent = 'Set a book to "Currently Reading" first';

        readButton.addEventListener('click', function() {
            showToast('Open My Reading List and set a book to "Currently Reading".', 'info');
            showPage('reading');
        });
    }

    readButton.append(buttonTitle, buttonSub);

    // Small buttons under the main button
    const links = el('div', 'goal-links');

    const goalsButton = el('button', 'link-button', 'Edit goals');
    goalsButton.addEventListener('click', openGoalSettingsModal);

    const logButton = el('button', 'link-button', 'Log minutes');
    logButton.addEventListener('click', openLogMinutesModal);

    links.append(goalsButton, logButton);

    card.append(title, time, caption, progressBar, readButton, links);

    goalUi = { time: time, caption: caption, fill: fill };

    return card;
}

function buildYearlyCard() {
    // Same layout as the "Today's Reading" card
    const card = createProgressCard('today-card');

    const year = new Date().getFullYear();
    const goal = myGoals.yearlyGoal;

    // Count the books finished this year
    let finished = 0;

    myLibrary.getBooks().forEach(function(book) {
        if (book.completedYear === year) {
            finished++;
        }
    });

    let percent = Math.round((finished / goal) * 100);

    if (percent > 100) {
        percent = 100;
    }

    const title = el('h3', '', 'Books Read This Year');
    const count = el('div', 'today-time', finished + ' / ' + goal);
    const caption = el('div', 'today-caption', 'books finished in ' + year);

    const progressBar = el('div', 'progress-bar progress-bar-large');
    const fill = el('div', 'progress-fill');
    fill.style.width = percent + '%';
    progressBar.appendChild(fill);

    // Button (same style as Keep Reading) that opens the reading list
    const listButton = el('button', 'keep-reading');
    const buttonTitle = document.createElement('strong');
    const buttonSub = document.createElement('span');

    if (finished >= goal) {
        buttonTitle.textContent = 'Goal reached!';
        buttonSub.textContent = 'You finished ' + finished + ' book(s) in ' + year;
    } else {
        buttonTitle.textContent = (goal - finished) + ' more book(s) to go';
        buttonSub.textContent = 'Open My Reading List';
    }

    listButton.append(buttonTitle, buttonSub);

    listButton.addEventListener('click', function() {
        showPage('reading');
    });

    // Small buttons under the main button
    const links = el('div', 'goal-links');

    const goalsButton = el('button', 'link-button', 'Edit goals');
    goalsButton.addEventListener('click', openGoalSettingsModal);

    const logBookButton = el('button', 'link-button', 'Log books');
    logBookButton.addEventListener('click', openLogBookModal);

    links.append(goalsButton, logBookButton);

    card.append(title, count, caption, progressBar, listButton, links);

    return card;
}

// Totals calculated from the saved books
function buildSummaryCard() {
    const savedBooks = myLibrary.getBooks();

    let completed = 0;
    let pagesRead = 0;
    let pagesLeft = 0;
    let ratingTotal = 0;
    let ratedCount = 0;

    savedBooks.forEach(function(book) {
        if (book.status === 'Completed') {
            completed++;
        }

        pagesRead += book.pagesRead;
        pagesLeft += book.remainingPages;

        if (book.myRating > 0) {
            ratingTotal += book.myRating;
            ratedCount++;
        }
    });

    // Calculate completion percentage
    let completionPercentage = 0;

    if (savedBooks.length > 0) {
        completionPercentage = Math.round((completed / savedBooks.length) * 100);
    }

    let averageRating = 'Not rated yet';

    if (ratedCount > 0) {
        averageRating = (ratingTotal / ratedCount).toFixed(1) + ' / 5';
    }

    const card = createProgressCard('summary-card');

    const title = el('h3', '', 'Your Library at a Glance');

    const progressText = el('p', 'summary-text');

    if (savedBooks.length === 0) {
        progressText.textContent = 'Your reading journey starts here. Save your first book!';
    } else {
        progressText.textContent = completionPercentage + '% of your saved books completed';
    }

    const progressBar = el('div', 'progress-bar progress-bar-large');
    const progressFill = el('div', 'progress-fill');
    progressFill.style.width = completionPercentage + '%';
    progressBar.appendChild(progressFill);

    const factsGrid = el('div', 'facts-grid');

    const facts = [
        ['Pages read', pagesRead + ' pages'],
        ['Pages still to read', pagesLeft + ' pages'],
        ['Average rating', averageRating]
    ];

    facts.forEach(function(fact) {
        const box = el('div', 'fact-box');

        box.append(el('span', '', fact[0]), el('strong', '', fact[1]));
        factsGrid.appendChild(box);
    });

    card.append(title, progressText, progressBar, factsGrid);

    return card;
}

// Build the whole Reading Progress page
function displayProgress() {
    progressContent.innerHTML = '';

    const topRow = el('div', 'goals-grid');
    topRow.append(buildTodayCard(), buildYearlyCard());

    progressContent.append(
        buildOverviewCards(),
        topRow,
        buildSummaryCard()
    );

    // Fill in the time and bar now that everything is on the screen
    refreshGoalDisplay();
}


// Start the app
updateNavCount();
displayBookStore();
restoreRecommendations();