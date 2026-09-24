const db = require('../config/database');
const QRCode = require('qrcode');
const crypto = require('crypto');

exports.renderTableManager = async (req, res) => {
    try {
        const [tables] = await db.query('SELECT * FROM tables ORDER BY table_number ASC');
        res.render('admin/tables', { tables });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.createTable = async (req, res) => {
    try {
        const { table_number } = req.body;
        const qr_token = 'TOKEN-' + crypto.randomBytes(8).toString('hex').toUpperCase();

        await db.query(
            'INSERT INTO tables (table_number, qr_token, status) VALUES (?, ?, "active")',
            [table_number, qr_token]
        );
        res.redirect('/admin/tables');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal menambah meja');
    }
};

exports.generateQRCode = async (req, res) => {
    try {
        const { token } = req.params;
        const orderUrl = `${req.protocol}://${req.get('host')}/customer/start?token=${token}`;
        
        const qrImage = await QRCode.toDataURL(orderUrl);
        res.send(`<div style="text-align:center; padding: 40px; font-family: sans-serif;">
            <h2>QR Code Meja</h2>
            <img src="${qrImage}" style="width:250px;"><br><br>
            <p><strong>URL Target:</strong> ${orderUrl}</p>
            <button onclick="window.print()">Cetak QR Code</button>
        </div>`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal membuat QR Code');
    }
};