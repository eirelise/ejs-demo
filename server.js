const express = require('express');
const app = express();

// set the view engine to ejs
app.set('view engine', 'ejs');

// use res.render to load up an ejs view file

const path = require("path");

const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./users.db");

const bcrypt = require('bcrypt');

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Handle form submit
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body; // ✅ THIS LINE IS REQUIRED

  if (!username || !email || !password) {
    return res.send("All fields required");

}
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
      [username, email, hashedPassword],
      function (err) {
        if (err) {
          console.error(err);
          return res.send("Error creating user");
        }

        res.send("User created successfully!");
      }
    );
    res.redirect('/login');
  } catch (err) {

    console.error(err);
    if (err.message.includes("UNIQUE")) {
  return res.send("Username or email already exists");
  res.send("Server error");
}

  }
});
app.post('/login', (req, res) => {
    const { identifier, password } = req.body; // 'identifier' can be email or username

    // Query both columns
    const sql = `SELECT * FROM users WHERE username = ? OR email = ?`;

    db.get(sql, [identifier, identifier], async (err, user) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }

        if (!user) {
            return res.send("Invalid username or email");
        }

        // Now compare the password
        try {
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                res.send("Success! You are logged in.");
            } else {
                res.send("Invalid password");
            }
        } catch (error) {
            res.status(500).send("Error comparing passwords");
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));
// index page
app.get('/', function(req, res) {
    const mascots = [
    { name: 'Sammy', organization: "DigitalOcean", birth_year: 2012},
    { name: 'Tux', organization: "Linux", birth_year: 1996},
    { name: 'Moby Dock', organization: "Docker", birth_year: 2013}
  ];
  const tagline = "No programming concept is complete without a cute animal mascot.";


  res.render('pages/index', {
    mascots: mascots,
    tagline: String(req.query.tagline || '')
  });
});

// about page
app.get('/about', function(req, res) {
  res.render('pages/about', {
    tagline: String(req.query.tagline || '')
  });
});

app.get('/login', function(req, res) {
  res.render('pages/login', {
    tagline: String(req.query.tagline || '')
  });
});

app.get('/register', function(req, res) {
  res.render('pages/register', {
    tagline: String(req.query.tagline || '')
  });
});
app.listen(8080, () => console.log('Server is listening on port 8080'));