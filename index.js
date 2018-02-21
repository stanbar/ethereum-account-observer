var Web3 = require('web3');
let firestore = require('./firestore')

console.log(`Connecting to geth on RPC @ ${gethServer.host}:${gethServer.port}`);
var web3 = new Web3('ws://raspberrypi.lan:8546');
console.log('Connected successfuly !');


let wallet = '0xE3D682d14e78a16777043cFBb35244D8dF0d574A';

const args = process.argv;
if (args[2] === 'scan' || args[2] === 'scanning'){
    scanBlockRange(2697609, undefined);
}else if (args[2] === 'watch' || args[2] === 'listen')
    watch();
else console.log("parameter required");


function scanBlockRange(startingBlock, stoppingBlock, callback) {
    
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

    // If they didn't provide an explicit stopping block, then read
    // ALL of the blocks up to the current one.

    if (typeof stoppingBlock === 'undefined') {
        stoppingBlock = web3.eth.blockNumber;
        console.log(`scanning blocks from ${startingBlock} to current ${stoppingBlock}`);
    }else
    console.log(`scanning blocks from ${startingBlock} to ${stoppingBlock}`);


    // If they asked for a starting block that's after the stopping block,
    // that is an error (or they're waiting for more blocks to appear,
    // which hasn't yet happened).

    if (startingBlock > stoppingBlock) {
        console.log('Your startingBlock is greater than stoppingBlock')
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


function scanBlockCallback(block) {

    if (block.transactions) {
        console.log(`scanning ${block.transactions.length} transactions`)
        for (var i = 0; i < block.transactions.length; i++) {
            var txn = block.transactions[i];
            scanTransactionCallback(txn, block);
        }
    }
}

function scanTransactionCallback(txn, block) {
    //    console.log(JSON.stringify(block, null, 4));
    //    console.log(JSON.stringify(txn, null, 4));
        console.log(`\r${format(txn,block, false)}`);
        if (txn.to != null && txn.to.toLowerCase() == wallet.toLowerCase()) {
            
            // A transaction credited ether into this wallet
            console.log(`\rTO MY WALLET ${format(txn,block, true)}`);
            var email = web3.utils.hexToAscii(txn.input);
            firestore.insertTranscation('ETH',email, txn);

            

        } else if (txn.from != null && txn.from.toLowerCase() == wallet.toLowerCase()) {
            // A transaction debitted ether from this wallet
            console.log(`\rFROM MY WALLET  ${format(txn,block, true)}`);
        }
    }
    function format(txn,block,decode){
        const ether = web3.utils.fromWei(txn.value);
        return `${block.timestamp} nonce: ${txn.nonce} +${ether} from: ${txn.from} data: ${formatInput(txn.input,decode)}`
    }
    
    function formatInput(rawInput,decode){
        const text = decode ? web3.utils.hexToAscii(rawInput) : rawInput;
        return text.length > 30 ? text.substr(0,30) : text;
    }


function watch() {
    console.log('Started subscription')
    web3.eth.subscribe('newBlockHeaders')
    .on("data", (blockHeader) => {
        web3.eth.getBlock(blockHeader.number, true, (error, results) => {
            if(!error){
                scanBlockCallback(results)
            }
        })
    })
    .on("error", (error) => {
        console.log("newBlockHeaders error")
        console.log(error);
    });

    web3.eth.subscribe('syncing')
    .on("data", (blockHeader) => {
        console.log("syncing data")
        console.log(blockHeader);
    })
    .on("changed", (isSyncing) => {
        console.log(`syncing changed ${isSyncing}`)
    });
    
}
