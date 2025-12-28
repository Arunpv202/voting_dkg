const express = require('express');
const router = express.Router();
const dkgController = require('../controllers/dkgController');

router.get('/status/:election_id', dkgController.getDkgStatus);
router.get('/authorities/:election_id', dkgController.getAuthorities);
router.post('/start-round1', dkgController.triggerRound1); // Internal or dev use
router.post('/round1/submit', dkgController.submitPublicKey);
router.post('/round2/submit', dkgController.submitRound2);
router.get('/shares/:election_id/:authority_id', dkgController.getShares);
// router.post('/finalize', dkgController.computeElectionKeys);

module.exports = router;
