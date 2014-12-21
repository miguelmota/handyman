# handyman

Web Worker with Promise.

**handyman is a fork of [padolsey/operative](https://github.com/padolsey/operative)**

# Install

```bash
npm install handyman
```

```bash
bower install handyman
```

# Usage

With Promises:

```javascript
var square = handyman(function(number) {
  var deferred = this.defer();

  if (typeof number === 'number' || number instanceof Number) {
    deferred.resolve(Math.pow(number,2));
  } else {
    deferred.reject('Argument must be a number.');
  }
});

square(2).then(function(result) {
  console.log(result); // 4
}, function(error) {
  console.error(error);
});
```

With callbacks:

```javascript
var square = handyman(function(number, callback) {
  var deferred = this.defer();

  if (typeof number === 'number' || number instanceof Number) {
    callback(null, Math.pow(number,2));
  } else {
    callback('Argument must be a number.');
  }

});

square(2, function(error, result) {
  if (error) {
    console.error(error);
  } else {
    console.log(result); // 4
  }
});
```

With dependencies:

```javascript
var square = handyman(function(number) {
  var deferred = this.defer();

  if (_.isNumber(number)) {
    deferred.resolve(Math.pow(number,2));
  } else {
    deferred.reject('Argument must be a number.');
  }
}, [
    'http://cdnjs.cloudflare.com/ajax/libs/lodash.js/2.4.1/lodash.min.js'
]);

square(2).then(function(result) {
  console.log(result); // 4
}, function(error) {
  console.error(error);
});
```

# License

MIT
