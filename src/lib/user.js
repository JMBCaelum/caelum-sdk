const axios = require('axios');
const Blockchain = require('../utils/substrate');
const Crypto = require('../utils/crypto');
const SDK = require('./sdk');
const W3C = require('../utils/zenroom');

/**
 * User
 */
module.exports = class User {
  /**
   * Constructor. It creates a User object.
   */
  constructor(caelum, connections, credentials, orgs) {
    this.caelum = caelum;
    this.connections = connections;
    this.credentials = credentials;
    this.orgs = orgs;
    this.sessions = {};
  }

  /**
   * open an SDK Instance.
   */
  openSdK(did) {
    // Must be loggedIn
    const sdk = new SDK(this.caelum, did, this.sessions[did].tokenApi, this.orgs[did].endpoint);
    return sdk;
  }

  /*
   * Sign a session
   *
   * @param {string} sessionIdString Session String ID
   * @param {string} did Org. DID
   * @param {string} peerDid Peer DID.
   * @return {object} Signed VC for the session.
   */
  async signSession(sessionIdString, did, keys) {
    const credential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential', 'Session'],
      issuer: `did:peerdid:${keys.Organization.keypair.public_key}`,
      credentialSubject: { did: `did:caelum:${did}`, sessionIdString },
      issuanceDate: new Date().toISOString(),
    };
    const issuer = { Issuer: { keypair: keys.Organization.keypair , PublicKeyUrl: 'did:caelum' }};
    const signedCredential = await W3C.signCredential(credential, issuer);
    return signedCredential;
  }

  /**
   * Register a new organization
   *
   * @param {object} org Organization to register with
   * @param {string} sessionId Session ID
   * @param {string} secretCode Secret Code
   */
  async register(org, sessionIdString, secretCode) {
    return new Promise((resolve, reject) => {
      // Create new keys for the peerDID (connection ID)
      if (this.connections[org.did]) reject(new Error('organization already exists'));
      else {
        this.orgs[org.did] = org;
        this.connections[org.did] = {};
        this.caelum.newCertificateKeys()
          .then((keys) => {
            this.connections[org.did] = keys;
            return this.signSession(sessionIdString, org.did, keys);
          })
          .then((signature) => axios.put(`${org.info.endpoint}auth/session`, {
            action: 'register',
            secret: secretCode,
            signature,
          }))
          .then((result) => {
            // Save to list of connections
            this.credentials[result.data.hashId] = {
              peerDid: this.connections[org.did].peerDid,
              did: org.did,
              subject: result.data.signedCredential,
            };
			console.log(this.credentials);
            resolve(this.connections[org.did].peerDid);
          })
          .catch((err) => {
			  console.log('ERR', err.message);
			  resolve(false);
		  });
      }
    });
  }

  async claim(org, notId) {
    const credential = await org.sdk.call('auth', 'claim', { params: [notId] });

    this.credentials[credential.hashId] = {
      peerDid: credential.user.peerDid,
      did: org.did,
      subject: credential.signedCredential,
    };
    return credential.signedCredential;
  }

  /**
   * Register a new organization
   *
   * @param {object} org Organization to register with
   * @param {string} sessionId Session ID
   * @param {string} secretCode Secret Code
   */
  async registerConnectionString(connectionString, secretCode) {
    const connStr = connectionString.split('-');
    const org = await this.caelum.getOrganizationFromDid(connStr[2], connStr[1]);
    return this.register(org, connStr[1], secretCode);
  }

  findCredential(did, capacity) {
    for (const item in this.credentials) {
      if (this.credentials[item].did === did
        && this.credentials[item].subject.credentialSubject.capacity === capacity) {
        return this.credentials[item].subject;
      }
    }
    return false;
  }

  /**
   * Register a new organization
   *
   * @param {srting} did Organization to register with
   * @param {string} sessionId Session ID
   */
  async login(did, capacity, _sessionId = 0) {
    const sessionId = (_sessionId === 0) ? (await this.orgs[did].getSession(capacity)).sessionId : _sessionId;
    const governanceKey = await Blockchain.getKeys(this.connections[did].governance);
    const signature = Crypto.u8aToHex(Crypto.signMessage(sessionId, governanceKey.keyPair));

    const postData = {
      action: 'login',
      peerDid: this.connections[did].peerDid,
      sessionId,
      signature,
      challenge: Crypto.hash(Crypto.random()),
      approved: true,
      credential: (capacity === 'peerdid') ? false : this.findCredential(did, capacity),
    };
    return new Promise((resolve) => {
      axios.put(`${this.orgs[did].endpoint}auth/session`, postData)
        .then((session) => {
          this.sessions[did] = session.data;
          resolve(this.sessions[did]);
        })
        .catch((e) => {
          console.log(e);
          resolve(false);
        });
    });
  }

  /**
  * Connection wit a connection String
  * @param {string} connectionString QR Code
  * */
  async loginConnectionString(connectionString, capacity) {
    const connStr = connectionString.split('-');
    return this.login(connStr[2], capacity, connStr[1]);
  }

  /**
  * export
  * */
  async export() {
    const json = JSON.stringify(
      { connections: this.connections, credentials: this.credentials },
    );
    return json;
  }
};
