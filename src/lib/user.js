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
          .then((signature) => {
            return axios.put(`${org.info.endpoint}auth/session`, {
              action: 'register',
              secret: secretCode,
              signature,
            });
          })
          .then((result) => {
            // Save to list of connections
            this.credentials[result.data.hashId] = {
              peerDid: this.connections[org.did].peerDid,
              did: org.did,
              subject: result.data.signedCredential,
            };
            resolve(this.connections[org.did].peerDid);
          })
          .catch(() => {
            resolve(false);
          });
      }
    });
  }

  /*
   * Claim a notification -> get a certificate
   *
   * @param {object} org Organization
   * @param {string} notId Notification ID
   */
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

  findCredential(did, capability) {
    for (const item in this.credentials) {
      if (this.credentials[item].did === did
        && this.credentials[item].subject.credentialSubject.capability.type === capability) {
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
  async login(org, capability, _sessionIdString = '') {
    const did = org.info.did.split(':').pop();
    const sessionIdString = (_sessionIdString === '')
      ? (await this.orgs[did].getSession(capability)).sessionIdString
      : _sessionIdString;
    const signature = await this.signSession(sessionIdString, did, this.connections[did]);
    const postData = {
      action: 'login',
      signature,
      approved: true,
      credential: (capability === 'peerdid') ? false : this.findCredential(did, capability),
    };
    return new Promise((resolve) => {
      axios.put(`${this.orgs[did].info.endpoint}auth/session`, postData)
        .then((session) => {
          this.sessions[did] = session.data;
          const sessionType = (capability === 'peerdid')
            ? false
            : this.sessions[did].signedCredential.credentialSubject.capability.type;
          return org.setSession(
            this.sessions[did].tokenApi,
            sessionType,
          );
        })
        .then(() => resolve(this.sessions[did]))
        .catch(() => {
          resolve(false);
        });
    });
  }

  /**
  * Connection wit a connection String
  * @param {string} connectionString QR Code
  * */
  async loginConnectionString(connectionString, capability) {
    const connStr = connectionString.split('-');
    const org = await this.caelum.getOrganizationFromDid(connStr[2]);
    return this.login(org, capability, connStr[1]);
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
