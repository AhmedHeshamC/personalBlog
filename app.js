// Add proper error handling and debugging
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

// Debug logging
console.log('Starting blog application...');

try {
    const app = express();
    const ARTICLES_DIR = path.join(__dirname, 'articles');
    
    // Check if articles directory exists
    if (!fs.existsSync(ARTICLES_DIR)) {
        console.error(`Articles directory not found: ${ARTICLES_DIR}`);
        fs.mkdirSync(ARTICLES_DIR, { recursive: true });
        console.log('Created articles directory');
    }
    
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    const ADMIN_USER = 'admin';
    const ADMIN_PASS = 'password123'; // Change as needed

    // Session and body parser middleware
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(session({
        secret: 'blog_secret_key',
        resave: false,
        saveUninitialized: false
    }));

    // Authentication middleware
    function requireAuth(req, res, next) {
        if (req.session && req.session.authenticated) {
            return next();
        }
        res.redirect('/login');
    }

    // Login routes
    app.get('/login', (req, res) => {
        res.render('login', { error: null });
    });

    app.post('/login', (req, res) => {
        const { username, password } = req.body;
        if (username === ADMIN_USER && password === ADMIN_PASS) {
            req.session.authenticated = true;
            return res.redirect('/admin/dashboard');
        }
        res.render('login', { error: 'Invalid credentials' });
    });

    app.get('/logout', (req, res) => {
        req.session.destroy(() => {
            res.redirect('/login');
        });
    });

    // Home Page: List all articles
    app.get('/', (req, res) => {
        fs.readdir(ARTICLES_DIR, (err, files) => {
            if (err) {
                console.error('Error reading articles directory:', err);
                return res.status(500).send('Error reading articles');
            }
            
            const articles = [];
            files.forEach(file => {
                try {
                    if (!file.endsWith('.json')) return;
                    
                    const filePath = path.join(ARTICLES_DIR, file);
                    const data = fs.readFileSync(filePath, 'utf-8');
                    const article = JSON.parse(data);
                    articles.push({
                        id: path.parse(file).name,
                        title: article.title,
                        date: article.date
                    });
                } catch (err) {
                    console.error(`Error processing article ${file}:`, err);
                }
            });
            
            // Sort by date descending
            articles.sort((a, b) => new Date(b.date) - new Date(a.date));
            res.render('home', { articles });
        });
    });
    
    // Article Page: Show single article
    app.get('/article/:id', (req, res) => {
        const filePath = path.join(ARTICLES_DIR, req.params.id + '.json');
        if (!fs.existsSync(filePath)) return res.status(404).send('Article not found');
        
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            const article = JSON.parse(data);
            res.render('article', { article });
        } catch (err) {
            console.error(`Error reading article ${req.params.id}:`, err);
            res.status(500).send('Error reading article');
        }
    });
    
    // Create a special test route
    app.get('/test', (req, res) => {
        res.send('Server is working!');
    });

    // Admin Dashboard
    app.get('/admin/dashboard', requireAuth, (req, res) => {
        fs.readdir(ARTICLES_DIR, (err, files) => {
            if (err) {
                return res.status(500).send('Error reading articles');
            }
            const articles = [];
            files.forEach(file => {
                try {
                    if (!file.endsWith('.json')) return;
                    const filePath = path.join(ARTICLES_DIR, file);
                    const data = fs.readFileSync(filePath, 'utf-8');
                    const article = JSON.parse(data);
                    articles.push({
                        id: path.parse(file).name,
                        title: article.title,
                        date: article.date
                    });
                } catch (err) {}
            });
            articles.sort((a, b) => new Date(b.date) - new Date(a.date));
            res.render('dashboard', { articles });
        });
    });

    // Add Article
    app.get('/admin/add', requireAuth, (req, res) => {
        res.render('add', { error: null });
    });

    app.post('/admin/add', requireAuth, (req, res) => {
        const { title, content, date } = req.body;
        if (!title || !content || !date) {
            return res.render('add', { error: 'All fields are required' });
        }
        const id = 'article' + Date.now();
        const filePath = path.join(ARTICLES_DIR, id + '.json');
        const article = { title, content, date };
        fs.writeFile(filePath, JSON.stringify(article, null, 4), err => {
            if (err) return res.status(500).send('Error saving article');
            res.redirect('/admin/dashboard');
        });
    });

    // Edit Article
    app.get('/admin/edit/:id', requireAuth, (req, res) => {
        const filePath = path.join(ARTICLES_DIR, req.params.id + '.json');
        if (!fs.existsSync(filePath)) return res.status(404).send('Article not found');
        const data = fs.readFileSync(filePath, 'utf-8');
        const article = JSON.parse(data);
        res.render('edit', { article, id: req.params.id, error: null });
    });

    app.post('/admin/edit/:id', requireAuth, (req, res) => {
        const { title, content, date } = req.body;
        if (!title || !content || !date) {
            return res.render('edit', { article: { title, content, date }, id: req.params.id, error: 'All fields are required' });
        }
        const filePath = path.join(ARTICLES_DIR, req.params.id + '.json');
        if (!fs.existsSync(filePath)) return res.status(404).send('Article not found');
        const article = { title, content, date };
        fs.writeFile(filePath, JSON.stringify(article, null, 4), err => {
            if (err) return res.status(500).send('Error saving article');
            res.redirect('/admin/dashboard');
        });
    });

    // Delete Article
    app.post('/admin/delete/:id', requireAuth, (req, res) => {
        const filePath = path.join(ARTICLES_DIR, req.params.id + '.json');
        if (!fs.existsSync(filePath)) return res.status(404).send('Article not found');
        fs.unlink(filePath, err => {
            if (err) return res.status(500).send('Error deleting article');
            res.redirect('/admin/dashboard');
        });
    });
    
    // Use a try-catch around server startup
    try {
        const server = app.listen(3000, () => {
            console.log('Blog running at http://localhost:3000');
        });
        
        // Handle server errors
        server.on('error', (err) => {
            console.error('Server error:', err);
        });
    } catch (err) {
        console.error('Failed to start server:', err);
    }
} catch (err) {
    console.error('Fatal application error:', err);
}
