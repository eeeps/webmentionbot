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
  
  fs.appendFile('/posts.txt', 'hi there ', function (err) {
    if (err) throw err;
  });
  
  console.log('Saved!');
  
  reply.send( 'hi')
  
});

// Run the server!
fastify.listen(3000, function (err, address) {
  if (err) {
    fastify.log.error(err)
    process.exit(1)
  }
  // Server is now listening on ${address}
});