const express = require('express');
const path = require('path');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express(); // <--- Inisialisasi app
const server = http.createServer(app);
const io = new Server(server);

// Middleware Socket.io untuk Controller
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Body Parser & Static Folder
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View Engine EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session Configuration
app.use(session({
    secret: 'sejiwa_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ==========================================
// REDIRECT HALAMAN UTAMA KE LOGIN ADMIN
// ==========================================
app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

// Routes Import
const adminRoutes = require('./routes/adminRoutes');
const customerRoutes = require('./routes/customerRoutes');

app.use('/admin', adminRoutes);
app.use('/customer', customerRoutes);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
});

// Route Pendek untuk Langsung Buka Meja 01
app.get('/m1', (req, res) => {
    res.redirect('/customer/start?token=TOKEN-MEJA-01');
});

// Route Pendek untuk Langsung Buka Meja 02
app.get('/m2', (req, res) => {
    res.redirect('/customer/start?token=TOKEN-MEJA-02');
});

// Route Dinamis untuk Semua Meja (/meja/01, /meja/02, dll)
app.get('/meja/:no', (req, res) => {
    const tableNum = req.params.no.padStart(2, '0');
    res.redirect(`/customer/start?token=TOKEN-MEJA-${tableNum}`);
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});