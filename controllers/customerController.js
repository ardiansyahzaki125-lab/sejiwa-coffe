const db = require('../config/database');
const { generateDynamicQRIS } = require('../utils/qrisHelper');

exports.renderStart = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).send('QR Code tidak valid atau meja tidak ditemukan.');

        const [tables] = await db.query('SELECT * FROM tables WHERE qr_token = ? AND status = "active"', [token]);
        if (tables.length === 0) return res.status(404).send('Meja tidak ditemukan atau sedang tidak aktif.');

        res.render('customer/start', { table: tables[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.initSession = async (req, res) => {
    try {
        const { customer_name, table_id, qr_token } = req.body;
        req.session.customer = {
            name: customer_name,
            table_id: table_id,
            sessionId: 'SESS-' + Date.now()
        };
        res.redirect(`/customer/menu?token=${qr_token}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.renderMenu = async (req, res) => {
    try {
        if (!req.session.customer) return res.redirect('/customer/start');

        const [categories] = await db.query('SELECT * FROM categories ORDER BY name ASC');
        const [menus] = await db.query('SELECT * FROM menus WHERE status = "available" ORDER BY name ASC');
        const [table] = await db.query('SELECT * FROM tables WHERE id = ?', [req.session.customer.table_id]);

        res.render('customer/menu', {
            customer: req.session.customer,
            table: table[0],
            categories,
            menus
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.processCheckout = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { items, subtotal, tax, service_charge, total } = req.body;
        const customer = req.session.customer;

        if (!customer || !items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Keranjang kosong atau session habis' });
        }

        const orderNumber = `SJW-${Date.now().toString().slice(-6)}`;

        // 1. Insert ke tabel orders
        const [orderResult] = await connection.query(
            `INSERT INTO orders 
            (order_number, customer_name, table_id, session_id, subtotal, tax, service_charge, total, payment_method, payment_status, order_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QRIS', 'PENDING_PAYMENT', 'PENDING')`,
            [orderNumber, customer.name, customer.table_id, customer.sessionId, subtotal, tax || 0, service_charge || 0, total]
        );

        const orderId = orderResult.insertId;

        // 2. Insert detail order items
        for (const item of items) {
            await connection.query(
                `INSERT INTO order_items (order_id, menu_id, menu_name, price, quantity, subtotal, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [orderId, item.menu_id, item.name, item.price, item.qty, item.subtotal, item.notes || '']
            );
        }

        // 3. Insert entri awal pembayaran
        await connection.query(
            `INSERT INTO payments (order_id, payment_method, amount, status) VALUES (?, 'QRIS', ?, 'WAITING_VERIFICATION')`,
            [orderId, total]
        );

        await connection.commit();

        // 4. Emit Notifikasi Real-time ke Dashboard Kasir
        const [tableData] = await db.query('SELECT table_number FROM tables WHERE id = ?', [customer.table_id]);
        req.io.emit('new_order', {
            order_id: orderId,
            order_number: orderNumber,
            customer_name: customer.name,
            table_number: tableData[0].table_number,
            total: total
        });

        res.json({ success: true, orderNumber });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal memproses pesanan' });
    } finally {
        connection.release();
    }
};

exports.renderPayment = async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const [orders] = await db.query(
            `SELECT o.*, t.table_number FROM orders o 
             JOIN tables t ON o.table_id = t.id 
             WHERE o.order_number = ?`,
            [orderNumber]
        );

        if (orders.length === 0) return res.status(404).send('Pesanan tidak ditemukan');

        const order = orders[0];
        const staticQRIS = process.env.QRIS_STATIC_PAYLOAD;

        // Generate QRIS Dinamis Base64 Image
        let qrisImage = null;
        if (staticQRIS) {
            qrisImage = await generateDynamicQRIS(staticQRIS, order.total);
        }

        res.render('customer/payment', { order, qrisImage });
    } catch (error) {
        console.error('Error renderPayment:', error);
        res.status(500).send('Server Error');
    }
};

exports.confirmPayment = async (req, res) => {
    try {
        const { orderNumber } = req.params;
        await db.query(
            `UPDATE orders SET payment_status = "WAITING_VERIFICATION" WHERE order_number = ?`,
            [orderNumber]
        );
        res.redirect(`/customer/order/${orderNumber}/status`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.renderStatus = async (req, res) => {
    try {
        const { orderNumber } = req.params;
        const [orders] = await db.query(
            `SELECT o.*, t.table_number FROM orders o 
             JOIN tables t ON o.table_id = t.id 
             WHERE o.order_number = ?`,
            [orderNumber]
        );

        if (orders.length === 0) return res.status(404).send('Pesanan tidak ditemukan');

        const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [orders[0].id]);

        res.render('customer/status', { order: orders[0], items });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};