const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const upload = require('../middlewares/uploadMiddleware');
const menuController = require('../controllers/menuController');
const tableController = require('../controllers/tableController');

// Route Kelola Menu
router.get('/menu', menuController.renderMenuManager);
router.post('/menu/create', upload.single('image'), menuController.createMenu);
router.post('/menu/update/:id', upload.single('image'), menuController.updateMenu);
router.post('/menu/delete/:id', menuController.deleteMenu);

// Route Kelola Meja & QR
router.get('/tables', tableController.renderTableManager);
router.post('/tables/create', tableController.createTable);
router.get('/tables/qr/:token', tableController.generateQRCode);


router.get('/dashboard', adminController.renderDashboard);
router.post('/orders/:orderId/verify', adminController.verifyPayment);
router.post('/orders/:orderId/status', adminController.updateOrderStatus);
router.get('/orders/:orderId/print', adminController.renderReceipt);

module.exports = router;