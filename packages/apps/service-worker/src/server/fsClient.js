(function () {
  window.fs = {};

  const request = function (operation, params, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `./fs/${operation}`, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) callback(null, xhr.responseText);
      else callback(`HTTP ${xhr.status}: ${xhr.responseText}`);
    };
    xhr.onabort = function () {
      callback('Abort');
    };
    xhr.ontimeout = function () {
      callback('Timeout');
    };
    xhr.onerror = function () {
      callback('Error on Connection');
    };
    xhr.send(params.toString());
  };

  const encodedFile = function (operation, filename, encoding, value, callback) {
    if (typeof filename !== 'string') throw 'Type Error in fs';
    if (encoding !== 'utf-8' && encoding !== 'base64') throw 'Type Error in fs';
    const params = new URLSearchParams({ type: encoding, name: filename });
    if (value !== undefined) params.set('value', value);
    request(operation, params, callback);
  };

  fs.readFile = function (filename, encoding, callback) {
    encodedFile('readFile', filename, encoding, undefined, callback);
  };

  fs.writeFile = function (filename, value, encoding, callback) {
    if (typeof value !== 'string') throw 'Type Error in fs.writeFile';
    encodedFile('writeFile', filename, encoding, value, callback);
  };

  fs.writeMultiFiles = function (filenames, values, callback) {
    request(
      'writeMultiFiles',
      new URLSearchParams({
        name: filenames.join(';'),
        value: values.join(';'),
      }),
      callback,
    );
  };

  fs.readdir = function (path, callback) {
    request('listFile', new URLSearchParams({ name: path }), function (error, value) {
      if (error) return callback(error, null);
      try {
        callback(null, JSON.parse(value));
      } catch {
        callback('Invalid /listFile', null);
      }
    });
  };

  fs.mkdir = function (path, callback) {
    request('makeDir', new URLSearchParams({ name: path }), callback);
  };

  fs.moveFile = function (src, dest, callback) {
    request('moveFile', new URLSearchParams({ src: src, dest: dest }), callback);
  };

  fs.deleteFile = function (path, callback) {
    request('deleteFile', new URLSearchParams({ name: path }), callback);
  };
})();
