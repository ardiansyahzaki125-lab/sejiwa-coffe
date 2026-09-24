const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const menuController = require('../controllers/menuController');
const tableController = require('../controllers/tableController');

// Middleware Auth
const isAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/admin/login');
};

// Route Tambah Meja Baru
router.post('/tables/create', isAuth, adminController.createTable);

// Route Lihat/Cetak QR Meja
router.get('/tables/qr/:token', isAuth, adminController.renderTableQR);

// Auth Routes
router.get('/login', adminController.renderLogin);
router.post('/login', adminController.processLogin);
router.get('/logout', adminController.logout);

// Dashboard & History
router.get('/dashboard', isAuth, adminController.renderDashboard);
router.get('/orders/history', isAuth, adminController.renderOrderHistory);
router.get('/order/:orderId/detail', isAuth, adminController.getOrderDetail);

// Kelola Menu & Meja (Menggunakan Controller Asli Milikmu)
const renderMenuHandler = menuController.renderMenu || menuController.index || menuController.getAllMenus || adminController.renderMenus;
const renderTableHandler = tableController.renderTables || tableController.index || tableController.getAllTables || adminController.renderTables;

router.get('/menu', isAuth, renderMenuHandler);
router.get('/menus', isAuth, renderMenuHandler);
router.get('/tables', isAuth, renderTableHandler);

// Order Actions
router.post('/order/:orderId/verify-payment', isAuth, adminController.verifyPayment);
router.post('/order/:orderId/update-status', isAuth, adminController.updateOrderStatus);
router.delete('/order/:orderId/delete', isAuth, adminController.deleteOrder);

// Thermal Print Receipt
router.get('/order/:orderId/receipt', isAuth, adminController.renderReceipt);

module.exports = router;