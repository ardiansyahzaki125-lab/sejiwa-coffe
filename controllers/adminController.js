const db = require('../config/database');
const bcrypt = require('bcryptjs');

// 1. Auth Operations
exports.renderLogin = (req, res) => {
    res.render('admin/login', { error: null });
};

exports.processLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`\n--- PERCOBAAN LOGIN ---`);
        console.log(`Input User: "${username}" | Input Pass: "${password}"`);

        if (!username || !password) {
            return res.render('admin/login', { error: 'Username dan password wajib diisi!' });
        }

        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);

        if (users.length === 0) {
            console.log('❌ User tidak ditemukan di DB!');
            return res.render('admin/login', { error: 'Username atau password salah!' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`✔ User Ditemukan. Match Password: ${isMatch}`);

        if (!isMatch) {
            console.log('❌ Password Tidak Match!');
            return res.render('admin/login', { error: 'Username atau password salah!' });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role
        };

        console.log('🚀 LOGIN BERHASIL! Redirect ke dashboard...');
        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('⚠️ Error processLogin:', error);
        return res.render('admin/login', { error: 'Terjadi kesalahan sistem.' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.redirect('/admin/login');
    });
};

// 2. Dashboard Operations
exports.renderDashboard = async (req, res) => {
    try {
        const [newOrders] = await db.query(
            `SELECT o.*, t.table_number FROM orders o 
             JOIN tables t ON o.table_id = t.id 
             WHERE o.order_status != "COMPLETED" AND o.order_status != "CANCELLED" 
             ORDER BY o.created_at DESC`
        );

        const [counts] = await db.query(`
            SELECT 
                SUM(CASE WHEN payment_status = 'WAITING_VERIFICATION' THEN 1 ELSE 0 END) as waiting_verify,
                SUM(CASE WHEN order_status = 'PROCESSING' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN order_status = 'READY' THEN 1 ELSE 0 END) as ready,
                SUM(CASE WHEN order_status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
            FROM orders WHERE DATE(created_at) = CURDATE()
        `);

        res.render('admin/dashboard', { orders: newOrders, summary: counts[0] || {} });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// 3. Order & Payment Operations
exports.verifyPayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action } = req.body;

        if (action === 'approve') {
            await db.query(
                `UPDATE orders SET payment_status = 'PAID', order_status = 'PROCESSING' WHERE id = ?`,
                [orderId]
            );
            await db.query(
                `UPDATE payments SET status = 'VERIFIED', verified_at = NOW() WHERE order_id = ?`,
                [orderId]
            );
        } else {
            await db.query(
                `UPDATE orders SET payment_status = 'PAYMENT_REJECTED', order_status = 'CANCELLED' WHERE id = ?`,
                [orderId]
            );
            await db.query(
                `UPDATE payments SET status = 'REJECTED', verified_at = NOW() WHERE order_id = ?`,
                [orderId]
            );
        }

        req.io.emit('order_status_updated', { orderId, action });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal verifikasi pembayaran' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        await db.query(`UPDATE orders SET order_status = ? WHERE id = ?`, [status, orderId]);
        req.io.emit('order_status_updated', { orderId, status });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal mengubah status' });
    }
};

// 4. Print Thermal Receipt
exports.renderReceipt = async (req, res) => {
    try {
        const { orderId } = req.params;
        const [orders] = await db.query(
            `SELECT o.*, t.table_number FROM orders o 
             JOIN tables t ON o.table_id = t.id 
             WHERE o.id = ?`,
            [orderId]
        );

        if (orders.length === 0) return res.status(404).send('Order tidak ditemukan');

        const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

        res.render('admin/print-receipt', { order: orders[0], items });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

// 5. Order History & Search
exports.renderOrderHistory = async (req, res) => {
    try {
        const { search, status, date } = req.query;
        let query = `
            SELECT o.*, t.table_number 
            FROM orders o 
            JOIN tables t ON o.table_id = t.id 
            WHERE 1=1
        `;
        let params = [];

        if (search) {
            query += ` AND (o.order_number LIKE ? OR o.customer_name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (status) {
            query += ` AND o.order_status = ?`;
            params.push(status);
        }

        if (date) {
            query += ` AND DATE(o.created_at) = ?`;
            params.push(date);
        }

        query += ` ORDER BY o.created_at DESC LIMIT 100`;

        const [orders] = await db.query(query, params);
        res.render('admin/orders-history', { orders, query: req.query });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};