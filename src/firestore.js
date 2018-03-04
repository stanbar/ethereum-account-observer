const admin = require('firebase-admin');
const Web3 = require('web3');

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

function insertTranscation(currencySymbol, userID, txn, block){
	console.log(`inserting into payments/${currencySymbol}/${userID}/${txn.hash}`);
	return db.collection('payments').doc(currencySymbol).collection(userID).doc(txn.hash).set({
		value : Web3.utils.fromWei(txn.value),
		timestamp: block.timestamp
	}).then( (ref) => {
		console.log("Insert successful !");
	})
}
exports.insertTranscation = insertTranscation;




