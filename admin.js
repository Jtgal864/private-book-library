async function checkAdmin() {
  const res = await fetch('/api/admin/check');
  const data = await res.json();

  const loginSection = document.getElementById('loginSection');
  const adminSection = document.getElementById('adminSection');

  if (data.isAdmin) {
    loginSection.style.display = 'none';
    adminSection.style.display = 'block';
    loadAdminBooks();
  } else {
    loginSection.style.display = 'block';
    adminSection.style.display = 'none';
  }
}

async function login() {
  const password = document.getElementById('adminPassword').value;
  const msg = document.getElementById('loginMsg');

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  if (res.ok) {
    msg.textContent = 'Login successful.';
    checkAdmin();
  } else {
    msg.textContent = 'Invalid password.';
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  checkAdmin();
}

async function addBook(e) {
  e.preventDefault();

  const form = document.getElementById('bookForm');
  const formData = new FormData(form);
  const msg = document.getElementById('bookMsg');

  const res = await fetch('/api/books', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (res.ok) {
    msg.textContent = 'Book added successfully.';
    form.reset();
    loadAdminBooks();
  } else {
    msg.textContent = data.error || 'Failed to add book.';
  }
}

async function loadAdminBooks() {
  const container = document.getElementById('adminBookList');
  const res = await fetch('/api/books');
  const books = await res.json();

  if (!books.length) {
    container.innerHTML = '<p>No books yet.</p>';
    return;
  }

  container.innerHTML = books.map(book => `
    <div class="book-card" style="margin-bottom: 1rem;">
      <h3>${book.title}</h3>
      <p><strong>Author:</strong> ${book.author}</p>
      <button class="small-btn" onclick="deleteBook(${book.id})">Delete</button>
    </div>
  `).join('');
}

async function deleteBook(id) {
  if (!confirm('Delete this book?')) return;

  const res = await fetch(`/api/books/${id}`, {
    method: 'DELETE'
  });

  if (res.ok) {
    loadAdminBooks();
  } else {
    alert('Failed to delete book.');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('bookForm').addEventListener('submit', addBook);

  checkAdmin();
});