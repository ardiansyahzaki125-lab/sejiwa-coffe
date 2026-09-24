// Mengalihkan alamat utama (/) langsung ke login admin
app.get('/', (req, res) => {
    res.redirect('/admin/login');
});
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const db = require('./config/database');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 2. Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: process.env.SESSION_SECRET || 'sejiwa_secret_key_123',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 hari
}));

// 3. Attach Socket.IO to Request Object
app.use((req, res, next) => {
    req.io = io;
    next();
});

// 4. Real-time Socket.IO Connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// 5. Import Routes
const customerRoutes = require('./routes/customerRoutes');
const adminRoutes = require('./routes/adminRoutes');

// 6. Use Routes
app.use('/customer', customerRoutes);
app.use('/admin', adminRoutes);

// Root Route: Direct Redirect ke Customer Start
app.get('/', (req, res) => {
    res.redirect('/customer/start');
});

// 7. Auto Reset & Hash Akun Admin
async function initAdminUser() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        // Hapus admin lama jika ada
        await db.query('DELETE FROM users WHERE username = "admin"');
        
        // Buat ulang dengan hash valid
        await db.query(
            'INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)',
            ['Kasir Sejiwa', 'admin', hashedPassword, 'admin']
        );
        console.log('✅ READY: Username -> admin | Password -> admin123');
    } catch (error) {
        console.error('⚠️ Gagal auto-reset admin:', error.message);
    }
}

// 8. Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    await initAdminUser();
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});