var squareWithPromise = handyman(function(number) {
  var deferred = this.defer();

  if (typeof number === 'number' || number instanceof Number) {
    deferred.resolve(Math.pow(number,2));
  } else {
    deferred.reject('Argument must be a number.');
  }
});

squareWithPromise(2).then(function(result) {
  console.log(result); // 4
}, function(error) {
  console.error(error);
});

var squareWithCallback = handyman(function(number, callback) {
  var deferred = this.defer();

  if (_.isNumber(number)) {
    callback(null, Math.pow(number,2));
  } else {
    callback('Argument must be a number.');
  }

}, [
    'http://cdnjs.cloudflare.com/ajax/libs/lodash.js/2.4.1/lodash.min.js'
]);

squareWithCallback(2, function(error, result) {
  if (error) {
    console.error(error);
  } else {
    console.log(result); // 4
  }
});

/*
// TODO:
var task = handyman('task.js');

task().then(function(result) {
  console.log(result);
}, function(error) {
  console.error(error);
});
*/
