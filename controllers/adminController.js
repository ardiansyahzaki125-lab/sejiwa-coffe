const db = require('../config/database');
const bcrypt = require('bcryptjs');

// 1. Auth Operations
exports.renderLogin = (req, res) => {
    res.render('admin/login', { error: null });
};

exports.processLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.render('admin/login', { error: 'Username dan password wajib diisi!' });
        }
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.render('admin/login', { error: 'Username atau password salah!' });
        }
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.render('admin/login', { error: 'Username atau password salah!' });
        }
        req.session.user = { id: user.id, name: user.name, username: user.username, role: user.role };
        return res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Error processLogin:', error);
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
             WHERE o.order_status NOT IN ('COMPLETED', 'CANCELLED') 
             ORDER BY o.created_at DESC`
        );

        if (newOrders.length > 0) {
            const orderIds = newOrders.map(order => order.id);
            const [items] = await db.query(`SELECT * FROM order_items WHERE order_id IN (?)`, [orderIds]);
            newOrders.forEach(order => {
                order.items = items.filter(item => item.order_id === order.id);
            });
        }

        const [counts] = await db.query(`
            SELECT 
                SUM(CASE WHEN payment_status = 'WAITING_VERIFICATION' AND order_status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END) as waiting_verify,
                SUM(CASE WHEN order_status = 'PROCESSING' THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN order_status = 'READY' THEN 1 ELSE 0 END) as ready,
                SUM(CASE WHEN order_status = 'COMPLETED' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as completed
            FROM orders
        `);

        res.render('admin/dashboard', { orders: newOrders, summary: counts[0] || {} });
    } catch (error) {
        console.error('Error renderDashboard:', error);
        res.status(500).send('Server Error');
    }
};

// 3. Verifikasi Pembayaran (Approve / Reject)
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

        if (req.io) {
            req.io.emit('order_status_updated', { orderId, action });
        }

        return res.json({ success: true, message: 'Verifikasi berhasil' });
    } catch (error) {
        console.error('Error verifyPayment:', error);
        return res.status(500).json({ success: false, message: 'Gagal memproses verifikasi' });
    }
};

// 4. Update Status Pesanan
exports.updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        await db.query(`UPDATE orders SET order_status = ? WHERE id = ?`, [status, orderId]);

        if (req.io) {
            req.io.emit('order_status_updated', { orderId, status });
        }

        return res.json({ success: true, message: 'Status berhasil diperbarui' });
    } catch (error) {
        console.error('Error updateOrderStatus:', error);
        return res.status(500).json({ success: false, message: 'Gagal merubah status' });
    }
};

// 5. Hapus Pesanan Coba-coba (Hard Delete)
exports.deleteOrder = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const { orderId } = req.params;

        await connection.query(`DELETE FROM order_items WHERE order_id = ?`, [orderId]);
        await connection.query(`DELETE FROM payments WHERE order_id = ?`, [orderId]);
        await connection.query(`DELETE FROM orders WHERE id = ?`, [orderId]);

        await connection.commit();

        if (req.io) {
            req.io.emit('order_status_updated', { orderId });
        }

        return res.json({ success: true, message: 'Pesanan berhasil dihapus' });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleteOrder:', error);
        return res.status(500).json({ success: false, message: 'Gagal menghapus pesanan' });
    } finally {
        connection.release();
    }
};

// 6. Cetak Struk
exports.renderReceipt = async (req, res) => {
    try {
        const { orderId } = req.params;
        const [orders] = await db.query(
            `SELECT o.*, t.table_number FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.id = ?`,
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

// 7. Riwayat Pesanan
exports.renderOrderHistory = async (req, res) => {
    try {
        const { search, status, date } = req.query;
        let query = `SELECT o.*, t.table_number FROM orders o JOIN tables t ON o.table_id = t.id WHERE 1=1`;
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

// 8. Get Order Detail (Modal Pop-up)
exports.getOrderDetail = async (req, res) => {
    try {
        const { orderId } = req.params;
        const [orders] = await db.query(
            `SELECT o.*, t.table_number FROM orders o JOIN tables t ON o.table_id = t.id WHERE o.id = ?`,
            [orderId]
        );
        if (orders.length === 0) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan' });
        const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
        res.json({ success: true, order: orders[0], items });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Render Halaman Cetak QR Code Meja
exports.renderTableQR = async (req, res) => {
    try {
        const { token } = req.params;
        const [tables] = await db.query('SELECT * FROM tables WHERE qr_token = ?', [token]);

        if (tables.length === 0) {
            return res.status(404).send('Meja tidak ditemukan.');
        }

        const table = tables[0];
        // URL lengkap yang akan dibuka pelanggan saat scan QR di meja
        const scanUrl = `${req.protocol}://${req.get('host')}/customer/start?token=${table.qr_token}`;

        res.render('admin/table-qr', { table, scanUrl });
    } catch (error) {
        console.error('Error renderTableQR:', error);
        res.status(500).send('Server Error');
    }
};

// Tambah Meja Baru & Otomatis Generate Token QR
exports.createTable = async (req, res) => {
    try {
        let { table_number } = req.body;
        
        if (!table_number) {
            return res.status(400).send('Nomor meja wajib diisi.');
        }

        // Format nomor meja (misal input "4" otomatis jadi "04")
        const num = parseInt(table_number, 10);
        const formattedNumber = isNaN(num) ? table_number : String(num).padStart(2, '0');
        const qrToken = `TOKEN-MEJA-${formattedNumber}`;

        // Insert ke database
        await db.query(
            `INSERT INTO tables (table_number, qr_token, status) VALUES (?, ?, 'active')`,
            [formattedNumber, qrToken]
        );

        res.redirect('/admin/tables');
    } catch (error) {
        console.error('Error createTable:', error);
        res.status(500).send('Server Error');
    }
};

// Render Halaman Kelola Menu
exports.renderMenus = async (req, res) => {
    try {
        const [menus] = await db.query(`
            SELECT m.*, c.name as category_name, c.type as category_type 
            FROM menus m 
            LEFT JOIN categories c ON m.category_id = c.id 
            ORDER BY m.name ASC
        `);
        
        const [categories] = await db.query('SELECT * FROM categories ORDER BY name ASC');

        res.render('admin/menu', { menus, categories });
    } catch (error) {
        console.error('Error renderMenus:', error);
        res.status(500).send('Server Error');
    }
};

// Fallback Handlers untuk Menu & Tables
exports.renderMenus = async (req, res) => {
    try {
        const [menus] = await db.query(`
            SELECT m.*, c.name as category_name FROM menus m 
            LEFT JOIN categories c ON m.category_id = c.id ORDER BY m.id DESC
        `);
        const [categories] = await db.query('SELECT * FROM categories ORDER BY name ASC');
        res.render('admin/menu', { menus, categories });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.renderTables = async (req, res) => {
    try {
        const [tables] = await db.query('SELECT * FROM tables ORDER BY table_number ASC');
        res.render('admin/tables', { tables });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};