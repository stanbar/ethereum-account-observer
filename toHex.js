/**
 * Ascii to hex helper method
 */

const Web3 = require('web3');
let value = process.argv[2];
console.log(Web3.utils.asciiToHex(value));
