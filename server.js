const express = require('express');
const app = express();

// set the view engine to ejs
app.set('view engine', 'ejs');

// use res.render to load up an ejs view file

const path = require("path");

const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./fafo.db");

const bcrypt = require('bcrypt');

const session = require('express-session');

app.use(session({
    secret: 'min_hemmelige_kode', // Bytt denne til noe unikt
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Sett til true hvis du bruker HTTPS
}));


// Middleware: krever innlogging
function sjekkInnlogging(req, res, next) {
    if (req.session && req.session.userid) {
        // Brukeren er logget inn! Gå videre til neste steg.
        return next();
    } else {
        // Brukeren er IKKE logget inn. Send dem til login-siden.
        res.redirect('/login');
    }
}

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE CHECK(length(username) >= 3),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL CHECK(length(password) >= 6),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    pfp BLOB DEFAULT '/public/placeholder.png'
  )
`);

module.exports = db;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Handle form submit
app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

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
          if (err.message.includes("UNIQUE")) {
            return res.send("Brukernavn eller e-post eksisterer allerede");
          }
          return res.send("Feil ved opprettelse av bruker");
        }
        // Etter suksess, send dem til login-siden
        res.redirect('/login');
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
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

// app.post('/login', (req, res) => {
//     const { identifier, password } = req.body;
//     const sql = `SELECT * FROM users WHERE username = ? OR email = ?`;

//     db.get(sql, [identifier, identifier], async (err, user) => {
//         if (err) return res.status(500).send("Databasefeil");
//         if (!user) return res.send("Ugyldig brukernavn eller e-post");

//         try {
//             const isMatch = await bcrypt.compare(password, user.password);
//             if (isMatch) {
//                 // --- HER SKJER INNLOGGINGEN ---
//                 req.session.userid = user.id; // Lagre ID i session
//                 res.redirect('/'); // Send dem til forsiden!
//             } else {
//                 res.send("Feil passord");
//             }
//         } catch (error) {
//             res.status(500).send("Feil ved sammenligning av passord");
//         }
//     });
// });
app.use(express.static(path.join(__dirname, 'public')));
// index page



app.get('/', sjekkInnlogging, function(req, res) {
    // 1. Call the database directly
    // The third argument is the "callback" function (err, rows)
    db.all('SELECT id, username, pfp, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
        
        // 2. Check for errors first
        if (err) {
            console.error(err.message);
            return res.status(500).send("Database error");
        }

        const tagline = "No programming concept is complete without a cute animal mascot.";

        // 4. Render the page INSIDE the callback
        // We use 'rows' (the result from the DB) as our 'fafo' data
        res.render('pages/index', {
          user: req.userid,
          fafo: rows,
          title: 'User List',
          tagline: tagline
        });
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
app.get('/logout', (req, res) => {
    req.session.destroy(); // Sletter session-dataen
    res.redirect('/login');
});
app.listen(8080, () => console.log('Server is listening on port 8080'));