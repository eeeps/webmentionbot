
// fastify
const fastify = require( 'fastify' )( {
  logger: true,
//  trustProxy: true // needed to get ips...
} );

// handle posts with formbodys
fastify.register( require( 'fastify-formbody' ) );


// receive posts

fastify.post('/', (req, reply) => {
  reply.send(req.body)
})



fastify.listen( 3000, function ( err, address ) {
  if ( err ) {
    fastify.log.error( err );
    process.exit( 1 );
  }
} );

