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
    created_at DATETIME DEFAULT CURRENT_DATE,
    pfp BLOB DEFAULT '/placeholder.png',
    displayName TEXT,
    description TEXT
  )
`);

// Add displayName column if it doesn't exist (for existing databases)
db.run(`ALTER TABLE users ADD COLUMN description TEXT`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding description column:', err.message);
  }
});

module.exports = db;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Handle form submit
app.post("/register", async (req, res) => {
  const { username, email, password, pfp } = req.body;

  if (!username || !email || !password) {
    return res.send("All fields required");
  }

  const pfpValue = pfp && pfp.trim() ? pfp.trim() : '/placeholder.png';

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, email, password, pfp) VALUES (?, ?, ?, ?)`,
      [username, email, hashedPassword, pfpValue],
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
                req.session.userid = user.id;
                res.redirect('/');
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



app.get('/', sjekkInnlogging, function(req, res) {
    // First, get the current user's data
    db.get('SELECT id, username, email, pfp, created_at, displayName FROM users WHERE id = ?', [req.session.userid], (err, currentUser) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Database error");
        }

        if (!currentUser) {
            req.session.destroy();
            return res.redirect('/login');
        }

        // Now get all users for the list
        db.all('SELECT id, username, pfp, created_at FROM users ORDER BY created_at DESC', [], (err, rows) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send("Database error");
            }

            const tagline = "No programming concept is complete without a cute animal mascot.";

            res.render('pages/index', {
                user: currentUser,  // Pass full current user object (for header)
                fafo: rows,         // All users list
                title: 'User List',
                tagline: tagline
            });
        });
    });
});

// about page
app.get('/about', sjekkInnlogging, function(req, res) {
  // Get the current user's full data
  db.get('SELECT id, username, email, pfp, created_at, displayName FROM users WHERE id = ?', [req.session.userid], (err, user) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send("Database error");
    }

    if (!user) {
      req.session.destroy();
      return res.redirect('/login');
    }

    res.render('pages/about', {
      user: user,
      tagline: String(req.query.tagline || '')
    });
  });
});
app.get('/profile', sjekkInnlogging, function(req, res) {
    // Get the current user's full data
    db.get('SELECT id, username, email, pfp, created_at, displayName, description FROM users WHERE id = ?', [req.session.userid], (err, user) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Database error");
        }

        if (!user) {
            // User not found, clear session and redirect to login
            req.session.destroy();
            return res.redirect('/login');
        }

        res.render('pages/profile', {
            tagline: String(req.query.tagline || ''),
            user: user // Pass the full user object
        });
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
app.post('/profile/update', sjekkInnlogging, (req, res) => {
    const userId = req.session.userid;
    const { username, displayName, description, pfp } = req.body;

    if (!username || !pfp || !userId) {
        return res.status(400).send('Username and profile image required');
    }

    const cleanUsername = username.trim();
    const cleanDisplay = displayName ? displayName.trim() : null;
    const cleanDescription = description ? description.trim() : null;
    const cleanPfp = pfp.trim() || '/placeholder.png';

    db.run(
        'UPDATE users SET username = ?, displayName = ?, description = ?, pfp = ? WHERE id = ?',
        [cleanUsername, cleanDisplay, cleanDescription, cleanPfp, userId],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.send('Username already taken');
                }
                console.error(err.message);
                return res.status(500).send('Database error; could not update profile');
            }
            res.redirect('/profile');
        }
    );
});

app.post('/profile/delete', sjekkInnlogging, (req, res) => {
    const userId = req.session.userid;

    if (!userId) {
        return res.redirect('/login');
    }

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Database error, could not delete account');
        }

        req.session.destroy(err => {
            if (err) {
                console.error(err);
            }
            res.redirect('/login');
        });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy(); // Sletter session-dataen
    res.redirect('/login');
});
app.listen(8080, () => console.log('Server is listening on port 8080'));