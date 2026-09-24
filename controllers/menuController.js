const db = require('../config/database');
const fs = require('fs');
const path = require('path');

exports.renderMenuManager = async (req, res) => {
    try {
        const [categories] = await db.query('SELECT * FROM categories ORDER BY name ASC');
        const [menus] = await db.query(`
            SELECT m.*, c.name as category_name 
            FROM menus m 
            JOIN categories c ON m.category_id = c.id 
            ORDER BY m.id DESC
        `);
        res.render('admin/menu', { categories, menus });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

exports.createMenu = async (req, res) => {
    try {
        const { category_id, name, description, price, status } = req.body;
        const image = req.file ? req.file.filename : 'default.png';

        await db.query(
            'INSERT INTO menus (category_id, name, description, price, image, status) VALUES (?, ?, ?, ?, ?, ?)',
            [category_id, name, description, price, image, status || 'available']
        );
        res.redirect('/admin/menu');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal menambah menu');
    }
};

exports.updateMenu = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_id, name, description, price, status } = req.body;

        let query = 'UPDATE menus SET category_id = ?, name = ?, description = ?, price = ?, status = ? WHERE id = ?';
        let params = [category_id, name, description, price, status, id];

        if (req.file) {
            query = 'UPDATE menus SET category_id = ?, name = ?, description = ?, price = ?, status = ?, image = ? WHERE id = ?';
            params = [category_id, name, description, price, status, req.file.filename, id];
        }

        await db.query(query, params);
        res.redirect('/admin/menu');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal memperbarui menu');
    }
};

exports.deleteMenu = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM menus WHERE id = ?', [id]);
        res.redirect('/admin/menu');
    } catch (error) {
        console.error(error);
        res.status(500).send('Gagal menghapus menu');
    }
};