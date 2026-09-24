const QRCode = require('qrcode');

function convertCRC16(str) {
    let crc = 0xFFFF;
    for (let c = 0; c < str.length; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    let hex = (crc & 0xFFFF).toString(16).toUpperCase();
    return hex.padStart(4, '0');
}

exports.generateDynamicQRIS = async (staticQrisBase, amount) => {
    try {
        let qris = staticQrisBase.substring(0, staticQrisBase.indexOf('6304'));
        let formattedAmount = Math.round(amount).toString();
        let amountTag = '54' + formattedAmount.length.toString().padStart(2, '0') + formattedAmount;

        qris = qris.replace('010211', '010212');

        let fullStringWithoutCRC = qris + amountTag + '6304';
        let crc = convertCRC16(fullStringWithoutCRC);
        let dynamicQrisString = fullStringWithoutCRC + crc;

        return await QRCode.toDataURL(dynamicQrisString);
    } catch (error) {
        console.error('Error generating dynamic QRIS:', error);
        throw error;
    }
};