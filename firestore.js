const admin = require('firebase-admin');
const Web3 = require('web3');

var FieldValue = admin.firestore.FieldValue;

var serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount)
});

var db = admin.firestore();
exports.db;


function insertTranscation(currencySymbol, email, txn ){
	console.log(`inserting into currencies/${currencySymbol}/${email}/${txn.hash}`)
	var ref = db.collection('currencies').doc(currencySymbol).collection(email).doc(txn.hash).set({
		value : Web3.utils.fromWei(txn.value),
		timestamp: FieldValue.serverTimestamp()
	}).then( (ref) => {
		console.log("Insert successful !");
	})

	

}
exports.insertTranscation = insertTranscation;





