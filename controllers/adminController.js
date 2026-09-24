const db = require('../config/database');

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

        res.render('admin/dashboard', { orders: newOrders, summary: counts[0] });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { action } = req.body; // 'approve' atau 'reject'

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
        const { status } = req.body; // 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED'

        await db.query(`UPDATE orders SET order_status = ? WHERE id = ?`, [status, orderId]);
        req.io.emit('order_status_updated', { orderId, status });

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Gagal mengubah status' });
    }
};

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