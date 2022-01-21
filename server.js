// Require the framework and instantiate it

// CommonJs
const fastify = require('fastify')({
  logger: true
});


const fs = require('fs');

// Declare a route
fastify.get('/', function (request, reply) {
  reply.send({ hello: 'world' })
});

fastify.post('/', function( request, reply ) {
  
  fs.appendFile('posts.txt', 'hi there ', function (err) {
    if (err) throw err;
  });
  
  console.log('Saved!');
  
  reply.send( JSON.stringify({
    time: new Date(),
    ip: request.ip,
    userAgent: request.headers["user-agent"],
    body: request.body
  }, null, 2 ) );
  
});

// Run the server!
fastify.listen(3000, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
});