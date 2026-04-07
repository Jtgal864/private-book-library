async function loadBooks(search = '') {
  const bookList = document.getElementById('bookList');
  if (!bookList) return;

  const res = await fetch(`/api/books?search=${encodeURIComponent(search)}`);
  const books = await res.json();

  if (!books.length) {
    bookList.innerHTML = '<p>No books found.</p>';
    return;
  }

  bookList.innerHTML = books.map(book => `
    <div class="book-card">
      <img src="${book.cover_image || 'https://via.placeholder.com/300x450?text=No+Cover'}" alt="${book.title}">
      <h3>${book.title}</h3>
      <p><strong>Author:</strong> ${book.author}</p>
      <p><strong>Genre:</strong> ${book.genre || 'N/A'}</p>
      <a href="/book?id=${book.id}">View Details</a>
    </div>
  `).join('');
}

async function loadBookDetail() {
  const bookDetail = document.getElementById('bookDetail');
  if (!bookDetail) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    bookDetail.innerHTML = '<p>No book selected.</p>';
    return;
  }

  const res = await fetch(`/api/books/${id}`);
  if (!res.ok) {
    bookDetail.innerHTML = '<p>Book not found.</p>';
    return;
  }

  const book = await res.json();

  bookDetail.innerHTML = `
    <h1>${book.title}</h1>
    <img class="cover-preview" src="${book.cover_image || 'https://via.placeholder.com/300x450?text=No+Cover'}" alt="${book.title}">
    <p><strong>Author:</strong> ${book.author}</p>
    <p><strong>Genre:</strong> ${book.genre || 'N/A'}</p>
    <p><strong>Description:</strong> ${book.description || 'No description provided.'}</p>
    ${book.file_path ? `<p><a href="${book.file_path}" target="_blank">Open / Download Book File</a></p>` : '<p>No file uploaded.</p>'}
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');

  if (searchBtn && searchInput) {
    loadBooks();

    searchBtn.addEventListener('click', () => {
      loadBooks(searchInput.value);
    });
  }

  loadBookDetail();
});