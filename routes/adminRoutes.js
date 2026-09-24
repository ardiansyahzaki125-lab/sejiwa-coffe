const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

const adminController = require('../controllers/adminController');
const menuController = require('../controllers/menuController');
const tableController = require('../controllers/tableController');

// Konfigurasi Multer untuk Upload Gambar Menu
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images/menus/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'menu-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Middleware Auth
const isAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/admin/login');
};

// Auth Routes
router.get('/login', adminController.renderLogin);
router.post('/login', adminController.processLogin);
router.get('/logout', adminController.logout);

// Dashboard & History
router.get('/dashboard', isAuth, adminController.renderDashboard);
router.get('/orders/history', isAuth, adminController.renderOrderHistory);
router.get('/order/:orderId/detail', isAuth, adminController.getOrderDetail);

// CRUD Kelola Menu (Dengan Middleware Upload File Multer)
router.get('/menu', isAuth, menuController.renderMenus);
router.get('/menus', isAuth, menuController.renderMenus);
router.post('/menu/create', isAuth, upload.single('image_file'), menuController.createMenu);
router.post('/menu/:id/update', isAuth, upload.single('image_file'), menuController.updateMenu);
router.delete('/menu/:id/delete', isAuth, menuController.deleteMenu);

// Kelola Meja & QR
router.get('/tables', isAuth, adminController.renderTables);
router.get('/tables/qr/:token', isAuth, adminController.renderTableQR);
router.post('/tables/create', isAuth, adminController.createTable);

// Order Actions
router.post('/order/:orderId/verify-payment', isAuth, adminController.verifyPayment);
router.post('/order/:orderId/update-status', isAuth, adminController.updateOrderStatus);
router.delete('/order/:orderId/delete', isAuth, adminController.deleteOrder);
router.get('/order/:orderId/receipt', isAuth, adminController.renderReceipt);

module.exports = router;