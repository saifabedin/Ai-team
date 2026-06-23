"use strict";
const { create } = require('@wppconnect-team/wppconnect');

async function start() {
  try {
    const client = await create({
      session: 'fixmyleads',
      catchQR: (base64Qr, asciiQR) => {
        console.log('QR CODE (scan this in WhatsApp):');
        console.log(asciiQR);
        // Save QR as image
        const fs = require('fs');
        const base64Data = base64Qr.replace(/^data:image\/png;base64,/, '');
        fs.writeFileSync('/tmp/whatsapp-qr.png', base64Data, 'base64');
        console.log('QR saved to /tmp/whatsapp-qr.png');
      },
      logLevel: 'warn',
      browserArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('WhatsApp client created!');
    console.log('Session: fixmyleads');
    console.log('Phone:', client.waUser?.id || 'not connected yet');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

start();
