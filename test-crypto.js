const CryptoJS = require('crypto-js');
const sampleData = Array.from({length: 5000}, (_, i) => ({ date: '2023-01-01', price: Math.random() * 100 }));
console.time('cryptojs-enc');
const enc = CryptoJS.AES.encrypt(JSON.stringify(sampleData), 'secret').toString();
console.timeEnd('cryptojs-enc');
console.time('cryptojs-dec');
const bytes = CryptoJS.AES.decrypt(enc, 'secret');
JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
console.timeEnd('cryptojs-dec');
