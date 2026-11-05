# iMybook - Reading Book Application

A desktop application built with **Electron**, HTML, CSS and JavaScript (OOP).
Course: CSC2923 Object Oriented Programming - Final Project, Session 2 2026/2027.

## Features

| Page | What it does |
|------|--------------|
| **Discover Books** | Search by title / author (results appear right under the search box), **Browse Store** (featured collection, Top Rated list, category shelves) and **Suggest For Me** (genre, length, era and author) |
| **My Reading List** | Create, view, update and delete saved books (status, pages read, rating, notes) + reading planner calculation |
| **Reading Progress** | Reading timer with daily goal bar, yearly book goal and a summary of the reading list |

## APIs used

- **Open Library Search API** (`openlibrary.org/search.json`) - title, author, genre/subject, year, pages, rating
- **Open Library Covers API** (`covers.openlibrary.org`) - book covers

No API key is needed. An internet connection is required.

## How to run

Requirements: [Node.js](https://nodejs.org) (LTS).

```bash
git clone <repository-url>
cd imybook
npm install
npm start
```

## Project structure (where to find things)

```
imybook/
├── main.js              # Electron main process (creates the window)
├── package.json         # dependencies and run scripts
└── renderer/
    ├── index.html       # the 3 pages (layout)
    ├── style.css        # styling
    └── js/
        ├── core.js       # shared: OOP classes, helper functions, API requests (JSON)
        ├── discover.js   # PAGE 1: cards, suggestion logic, navigation, search/suggest/store
        └── reading.js    # PAGE 2 (reading list) + PAGE 3 (progress) + app start
```

## How Page 1 and Page 2 are connected

- **Navigation:** `showPage()` in `discover.js` shows one page and hides the others.
- **Page 1 -> Page 2:** after a book is saved, the Save button becomes "View in My Reading List" and calls `goToReadingList()`.
- **Page 2 -> Page 1:** the "More by this author" button in the Details window calls `findMoreByAuthor()`, which searches the API again.
- **Shared data:** both pages use the same `myLibrary` object. `saveToStorage()` writes it as JSON (`JSON.stringify`) and `loadBooks()` reads it back (`JSON.parse`) from Local Storage.
- **Both pages use the API:** Page 1 uses `fetchSearchResults()`, `fetchGenreBooks()`, `fetchStoreBooks()`. Page 2 uses `fetchWorkDetails()`.

## OOP classes

- `Book` - parent class (private fields `#`, getters, setters)
- `SavedBook extends Book` - reading status, progress, rating, notes
- `RecommendedBook extends Book` - adds the reasons for a suggestion
- `ReadingLibrary` - CRUD and Local Storage
- `ReadingGoals` - reading goals and daily reading log

## Data storage

All user data is kept in Local Storage: `myReadingList`, `myRecommendations`, `myReadingGoals`.
