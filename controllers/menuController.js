const db = require('../config/database');

// Render Halaman Kelola Menu
exports.renderMenus = async (req, res) => {
    try {
        const [menus] = await db.query(`
            SELECT m.*, c.name as category_name, c.type as category_type 
            FROM menus m 
            LEFT JOIN categories c ON m.category_id = c.id 
            ORDER BY m.id DESC
        `);
        const [categories] = await db.query('SELECT * FROM categories ORDER BY name ASC');
        res.render('admin/menu', { menus, categories });
    } catch (error) {
        console.error('Error renderMenus:', error);
        res.status(500).send('Server Error');
    }
};

// Tambah Menu Baru + Upload File Foto
exports.createMenu = async (req, res) => {
    try {
        const { name, category_id, price, status } = req.body;
        const image = req.file ? req.file.filename : null;

        if (!name || !price || !category_id) {
            return res.status(400).json({ success: false, message: 'Nama, kategori, dan harga wajib diisi!' });
        }

        await db.query(
            `INSERT INTO menus (name, category_id, price, status, image) VALUES (?, ?, ?, ?, ?)`,
            [name, category_id, price, status || 'available', image]
        );

        res.json({ success: true, message: 'Menu berhasil ditambahkan' });
    } catch (error) {
        console.error('Error createMenu:', error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan menu' });
    }
};

// Update Menu + Upload File Foto Baru (opsional)
exports.updateMenu = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category_id, price, status, existing_image } = req.body;

        let image = existing_image || null;
        if (req.file) {
            image = req.file.filename;
        }

        await db.query(
            `UPDATE menus SET name = ?, category_id = ?, price = ?, status = ?, image = ? WHERE id = ?`,
            [name, category_id, price, status, image, id]
        );

        res.json({ success: true, message: 'Menu berhasil diperbarui' });
    } catch (error) {
        console.error('Error updateMenu:', error);
        res.status(500).json({ success: false, message: 'Gagal mengupdate menu' });
    }
};

// Hapus Menu
exports.deleteMenu = async (req, res) => {
    try {
        const { id } = req.params;
        try {
            await db.query(`UPDATE order_items SET menu_id = NULL WHERE menu_id = ?`, [id]);
        } catch (fkErr) {
            console.log('FK info:', fkErr.message);
        }

        const [result] = await db.query(`DELETE FROM menus WHERE id = ?`, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
        }

        return res.json({ success: true, message: 'Menu berhasil dihapus' });
    } catch (error) {
        console.error('Error deleteMenu:', error);
        return res.status(500).json({ success: false, message: 'Gagal menghapus menu' });
    }
};