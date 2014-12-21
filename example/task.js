var end = 1e+8,
  halfway = 5e+7,
  tmp = 1;


self.postMessage('starting.');

while(end) {
  end -= 1;
  tmp += end;
  if (end === halfway) {
    self.postMessage('halfway there, `tmp` is now ' + tmp + '.');
  }
}

self.postMessage('add done.');
