let Web3 = require('web3');

let localConfig = {
    host: 'localhost',
    port: 8545
};
let infuraRopstenConfig = {
    host: 'https://ropsten.infura.io/O6ZVPclySRINaTvCz9kP',
    port: 8545
};
let raspberryRopstenConfig = {
    host: 'http://192.168.1.237',
    port: 8545
};
let ropstenWallet = '0xE3D682d14e78a16777043cFBb35244D8dF0d574A';
let localhostWallet = '0x6159cb40989fda935aecd46ca09a67914022d545';


let gethServer = raspberryRopstenConfig;
let wallet = ropstenWallet.toLowerCase();

let firstBlockNumber = 2659549;
let lastBlockNumber = 2590387;

/**
 * Maximum number of threads to create.
 *
 * The higher you set this, the faster the scan will run.  However if
 * you set it too high, you will overload the geth server and/or your
 * client machine and you may start getting networking errors.
 *
 * Generally speaking on a dual-core CPU that runs both geth
 * and this scanning client, I can scan ~ 300 blocks/second,
 * but in so doing, the CPU maxed at 100%.
 *
 * On the same dual-core CPU, settings higher than 200 threads
 * actually SLOW DOWN the processing since the I/O overhead exceeds
 * the capabilities of the machine.  Your results may vary.
 *
 * @type {number}
 */
let maxThreads = 200;


if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    console.log(`Connecting to geth on RPC @ ${gethServer.host}:${gethServer.port}`);
    // set the provider you want from Web3.providers
    web3 = new Web3(new Web3.providers.HttpProvider(`${gethServer.host}:${gethServer.port}`));
}
let eth = web3.eth;

function scanTransactionCallback(txn, block) {
//    console.log(JSON.stringify(block, null, 4));
//    console.log(JSON.stringify(txn, null, 4));
    console.log(`\r${format(txn,block, false)}`);
    if (txn.to === wallet) {
        // A transaction credited ether into this wallet
        console.log(`\r MY WALLET ${format(txn,block, true)}`);
    } else if (txn.from === wallet) {
        // A transaction debitted ether from this wallet
        console.log(`\rMY WALLET  ${format(txn,block, true)}`);
    }
}
function format(txn,block,decode){
    const ether = web3.fromWei(txn.value, 'ether');
    return `${block.timestamp} nonce: ${txn.nonce} +${ether} from: ${txn.from} data: ${formatInput(txn.input,decode)}`
}

function formatInput(rawInput,decode){
    const text = decode ? web3.toAscii(rawInput) : rawInput;
    return text.length > 30 ? text.substr(0,30) : text;
}


function scanBlockCallback(block) {

    if (block.transactions) {
        for (var i = 0; i < block.transactions.length; i++) {
            var txn = block.transactions[i];
            scanTransactionCallback(txn, block);
        }
    }
}

function scanBlockRange(startingBlock, stoppingBlock, callback) {

    // If they didn't provide an explicit stopping block, then read
    // ALL of the blocks up to the current one.

    if (typeof stoppingBlock === 'undefined') {
        stoppingBlock = web3.eth.blockNumber;
    }

    // If they asked for a starting block that's after the stopping block,
    // that is an error (or they're waiting for more blocks to appear,
    // which hasn't yet happened).

    if (startingBlock > stoppingBlock) {
        return -1;
    }

    let blockNumber = startingBlock,
        gotError = false,
        numThreads = 0,
        startTime = new Date();

    function getPercentComplete(bn) {
        var t = stoppingBlock - startingBlock,
            n = bn - startingBlock;
        return Math.floor(n / t * 100, 2);
    }

    function exitThread() {
        if (--numThreads == 0) {
            var numBlocksScanned = 1 + stoppingBlock - startingBlock,
                stopTime = new Date(),
                duration = (stopTime.getTime() - startTime.getTime()) / 1000,
                blocksPerSec = Math.floor(numBlocksScanned / duration, 2),
                msg = `Scanned to block ${stoppingBlock} (${numBlocksScanned} in ${duration} seconds; ${blocksPerSec} blocks/sec).`,
                len = msg.length,
                numSpaces = process.stdout.columns - len,
                spaces = Array(1 + numSpaces).join(" ");

            process.stdout.write("\r" + msg + spaces + "\n");
            if (callback) {
                callback(gotError, stoppingBlock);
            }
        }
        return numThreads;
    }

    function asyncScanNextBlock() {

        // If we've encountered an error, stop scanning blocks
        if (gotError) {
            return exitThread();
        }

        // If we've reached the end, don't scan more blocks
        if (blockNumber > stoppingBlock) {
            return exitThread();
        }

        // Scan the next block and assign a callback to scan even more
        // once that is done.
        var myBlockNumber = blockNumber++;

        // Write periodic status update so we can tell something is happening
        if (myBlockNumber % maxThreads == 0 || myBlockNumber == stoppingBlock) {
            var pctDone = getPercentComplete(myBlockNumber);
            process.stdout.write(`\rScanning block ${myBlockNumber} - ${pctDone} %`);
        }

        // Async call to getBlock() means we can run more than 1 thread
        // at a time, which is MUCH faster for scanning.

        web3.eth.getBlock(myBlockNumber, true, (error, block) => {

            if (error) {
                // Error retrieving this block
                gotError = true;
                console.error("Error:", error);
            } else {
                scanBlockCallback(block);
                asyncScanNextBlock();
            }
        });
    }

    var nt;
    for (nt = 0; nt < maxThreads && startingBlock + nt <= stoppingBlock; nt++) {
        numThreads++;
        asyncScanNextBlock();
    }

    return nt; // number of threads spawned (they'll continue processing)
}

function watch() {
    const filter = eth.filter('latest');
    filter.watch(function (error, result) {
        web3.eth.getBlock(result, true, (error, block) => {
            if (error) {
                // Error retrieving this block
                gotError = true;
                console.error("Error:", error);
            } else {
                scanBlockCallback(block);
            }
        });
    });
}


const args = process.argv;
if (args[2] === 'scan' || args[2] === 'scanning')
    scanBlockRange(firstBlockNumber, undefined);
else if (args[2] === 'watch' || args[2] === 'listen')
    watch();
else console.log("parameter required");