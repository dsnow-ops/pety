'use strict';
// uniCloud transaction.doc().get() returns one document, not a query array.
// Missing/malformed transport responses must not be interpreted as no account.
module.exports = function transactionDocument(result) {
  if (!result || !Object.prototype.hasOwnProperty.call(result, 'data') ||
      (result.data !== null && (typeof result.data !== 'object' || Array.isArray(result.data)))) {
    throw Object.assign(new Error('Invalid transaction document response'), { code: 'TRANSACTION_DOCUMENT_INVALID' });
  }
  return result.data;
};
