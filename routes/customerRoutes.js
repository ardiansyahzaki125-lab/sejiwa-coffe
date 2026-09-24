const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.get('/start', customerController.renderStart);
router.post('/start', customerController.initSession);
router.get('/menu', customerController.renderMenu);
router.post('/checkout', customerController.processCheckout);
router.get('/payment/:orderNumber', customerController.renderPayment);
router.post('/payment/:orderNumber/confirm', customerController.confirmPayment);
router.get('/order/:orderNumber/status', customerController.renderStatus);

module.exports = router;