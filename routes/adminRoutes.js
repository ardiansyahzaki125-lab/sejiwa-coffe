const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuth, isGuest } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const menuController = require('../controllers/menuController');
const tableController = require('../controllers/tableController');

// Auth Routes
router.get('/login', isGuest, adminController.renderLogin);
router.post('/login', isGuest, adminController.processLogin);
router.get('/logout', isAuth, adminController.logout);

// Protected Admin Routes (Wajib Login)
router.get('/dashboard', isAuth, adminController.renderDashboard);
router.post('/orders/:orderId/verify', isAuth, adminController.verifyPayment);
router.post('/orders/:orderId/status', isAuth, adminController.updateOrderStatus);
router.get('/orders/:orderId/print', isAuth, adminController.renderReceipt);
router.get('/orders/history', isAuth, adminController.renderOrderHistory);

// Menu Management
router.get('/menu', isAuth, menuController.renderMenuManager);
router.post('/menu/create', isAuth, upload.single('image'), menuController.createMenu);
router.post('/menu/update/:id', isAuth, upload.single('image'), menuController.updateMenu);
router.post('/menu/delete/:id', isAuth, menuController.deleteMenu);

// Table Management
router.get('/tables', isAuth, tableController.renderTableManager);
router.post('/tables/create', isAuth, tableController.createTable);
router.get('/tables/qr/:token', isAuth, tableController.generateQRCode);

module.exports = router;