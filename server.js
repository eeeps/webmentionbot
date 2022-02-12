// Require the framework and instantiate it

// CommonJs
const fastify = require('fastify')({
  logger: true,
  trustProxy: true // needed to get ips...
});


const fs = require('fs');

// Declare a route
fastify.get('/', async function( request, reply ) {

  await fs.readFile( 'receivedBeacons.json', 'utf8', function( err, data ) {
    if ( err ) throw err;
    reply.send( data );
  } );
  
} );

fastify.post( '/post', function( request, reply ) {
  
  const oldLogString = fs.readFileSync( 'receivedBeacons.json', 'utf8' ),
        oldLog = JSON.parse( oldLogString );
  
  const parsedBody = JSON.parse( request.body );
  const newLogItem = {
    time: new Date(),
    // ip: request.ips[ request.ips.length - 1 ],
    // userAgent: request.headers[ "user-agent" ],
    pageURL: parsedBody.pageURL,
    variants: parsedBody.variants,
    success: parsedBody.success
  };
  
  const newLog = [ newLogItem ].concat( oldLog ),
        logString = JSON.stringify( newLog, null, 2 );
  
  fs.writeFile( 'receivedBeacons.json', logString, function( err ) {
    if ( err ) throw err;
  } );
  
  reply.send( JSON.stringify( newLogItem, null, 2 ) ); // helped me test...
  
} );

// Run the server!
fastify.listen( 3000, function ( err, address ) {
  if ( err ) {
    fastify.log.error( err );
    process.exit( 1 );
  }
  // Server is now listening on ${address}
} );