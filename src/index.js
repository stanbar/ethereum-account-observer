const Web3 = require('web3');
const firestore = require('./firestore');
const connection = require('./connection');

const local = {
    ip: 'geth',
    port: '8546'
};
const remote = {
    ip: 'raspberrypi.lan',
    port: '8546'
};

const ip = local.ip;
const port = local.port;

const web3 = new Web3(`ws://${ip}:${port}`);




let wallet = '0xE3D682d14e78a16777043cFBb35244D8dF0d574A';

connection.checkConnection(ip, port).then(function() {
    console.log(`Connected successfully to ws://${ip}:${port} !`);

    const args = process.argv;
    if (args[2] === 'scan' || args[2] === 'scanning') {
        scanBlockRange(2697609, undefined);
    } else
        watch();

}, function(err) {
    console.error(`Can not connect to ws://${ip}:${port}`);
});



function scanBlockRange(startingBlock, stoppingBlock, callback) {
    let maxThreads = 200;

    if (typeof stoppingBlock === 'undefined') {
        stoppingBlock = web3.eth.blockNumber;
        console.log(`scanning blocks from ${startingBlock} to current ${stoppingBlock}`);
    } else
        console.log(`scanning blocks from ${startingBlock} to ${stoppingBlock}`);


    if (startingBlock > stoppingBlock) {
        console.log('Your startingBlock is greater than stoppingBlock');
        return -1;
    }


    let blockNumber = startingBlock,
        gotError = false,
        numThreads = 0,
        startTime = new Date();

    function getPercentComplete(bn) {
        const t = stoppingBlock - startingBlock;
        const n = bn - startingBlock;
        return Math.floor(n / t * 100, 2);
    }

    function exitThread() {
        if (--numThreads === 0) {
            const numBlocksScanned = 1 + stoppingBlock - startingBlock,
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
        if (gotError)
            return exitThread();

        if (blockNumber > stoppingBlock)
            return exitThread();


        const myBlockNumber = blockNumber++;

        printStatus(myBlockNumber, maxThreads,stoppingBlock);

        web3.eth.getBlock(myBlockNumber, true, (error, block) => {

            if (error) {
                gotError = true;
                console.error("Error:", error);
            } else {
                scanBlockCallback(block);
                asyncScanNextBlock();
            }
        });
    }
    function printStatus(myBlockNumber, maxThreads, stoppingBlock){
        if (myBlockNumber % maxThreads === 0 || myBlockNumber === stoppingBlock) {
            const pctDone = getPercentComplete(myBlockNumber);
            process.stdout.write(`\rScanning block ${myBlockNumber} - ${pctDone} %`);
        }
    }

    let nt;
    for (nt = 0; nt < maxThreads && startingBlock + nt <= stoppingBlock; nt++) {
        numThreads++;
        asyncScanNextBlock();
    }

    return nt;
}


function scanBlockCallback(block) {

    if (block.transactions) {
        const blockDate = new Date(block.timestamp);
        console.log(`${blockDate.getHours()}:${blockDate.getMinutes()}:${blockDate.getSeconds()} Scanning Block: ${block.hash} height: ${block.number}  ${block.transactions.length} transactions`)
        for (let i = 0; i < block.transactions.length; i++) {
            const txn = block.transactions[i];
            scanTransactionCallback(txn, block);
        }
    }
}

function scanTransactionCallback(txn, block) {
    //    console.log(JSON.stringify(block, null, 4));
    //    console.log(JSON.stringify(txn, null, 4));
    if (txn.to !== null && txn.to.toLowerCase() === wallet.toLowerCase()) {

        // A transaction credited ether into our wallet
        console.log(`\rTO MY WALLET ${format(txn, true)}`);
        var email = web3.utils.hexToAscii(txn.input);
        firestore.insertTranscation('ETH', email, txn, block);


    } else if (txn.from !== null && txn.from.toLowerCase() === wallet.toLowerCase()) {
        // A transaction debitted ether from our wallet
        console.log(`\rFROM MY WALLET  ${format(txn, true)}`);
    }
}

function format(txn, decode) {
    const ether = web3.utils.fromWei(txn.value);
    return `${txn.hash} ${ether} from: ${txn.from} data: ${decode ? web3.utils.hexToAscii(txn.input) : " "}`
}


function watch() {
    console.log(`Listening ethereum network for newBlockHeaders`);

    var subscription = web3.eth.subscribe('newBlockHeaders')
        .on("data", (blockHeader) => {
            web3.eth.getBlock(blockHeader.number, true, (error, results) => {
                if (!error) {
                    scanBlockCallback(results)
                }
            })
        })
        .on("error", (error) => {
            console.log("newBlockHeaders error");
            console.log(error);
        });

    process.on('SIGINT', function() {
    console.log("Gracefully stopping websocket subscription...");
        subscription.unsubscribe(function(error, success){
            if(success){
                console.log('Successfully unsubscribed!');
                process.exit();
            }
        });
    });

}
