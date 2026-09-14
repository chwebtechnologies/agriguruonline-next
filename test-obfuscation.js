const fs = require('fs');

const SECRET = 'agriguru2026';
function fastEncrypt(data) {
    const str = JSON.stringify(data);
    let result = '';
    for(let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) ^ SECRET.charCodeAt(i % SECRET.length));
    }
    return Buffer.from(result).toString('base64');
}

function fastDecrypt(base64Str) {
    const str = Buffer.from(base64Str, 'base64').toString('utf8');
    let result = '';
    for(let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) ^ SECRET.charCodeAt(i % SECRET.length));
    }
    return JSON.parse(result);
}

const sampleData = Array.from({length: 5000}, (_, i) => ({ date: '2023-01-01', price: Math.random() * 100 }));
console.time('fastEncrypt');
const enc = fastEncrypt(sampleData);
console.timeEnd('fastEncrypt');
console.time('fastDecrypt');
fastDecrypt(enc);
console.timeEnd('fastDecrypt');
